-- ===================== Debts: when the debt happened =====================
alter table public.debts add column incurred_at timestamptz not null default now();
update public.debts set incurred_at = created_at;
create index debts_customer_incurred_idx on public.debts (customer_id, incurred_at desc);

create or replace function public.debts_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sc public.shop_customers;
begin
  new.created_at := now();
  new.created_by := auth.uid();
  new.incurred_at := coalesce(new.incurred_at, now());
  if new.incurred_at > now() + interval '5 minutes' then raise exception 'DEBT_IN_FUTURE'; end if;
  if new.incurred_at < now() - interval '5 years' then raise exception 'DEBT_TOO_OLD'; end if;
  if new.customer_id is not null then
    select * into sc from public.shop_customers where barber_id = new.barber_id and customer_id = new.customer_id;
    if not found then raise exception 'CUSTOMER_NOT_IN_SHOP'; end if;
    new.customer_name := sc.display_name;
    new.link_code := null;
    new.linked_at := now();
  else
    new.link_code := public.generate_debt_link_code();
    new.linked_at := null;
  end if;
  return new;
end $$;

-- ===================== Notifications (in-app) =====================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('appointment_cancelled_by_customer', 'appointment_cancelled_by_barber')),
  title text not null,
  body text,
  starts_at timestamptz,
  timezone text,
  appointment_id uuid references public.appointments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_appointment_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b public.barbers;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    select * into b from public.barbers where id = new.barber_id;
    if new.cancelled_by is distinct from b.owner_id then
      insert into public.notifications (user_id, kind, title, body, starts_at, timezone, appointment_id)
      values (b.owner_id, 'appointment_cancelled_by_customer', 'ألغى زبون موعده',
              new.customer_name || ' — ' || new.service, new.starts_at, b.timezone, new.id);
    elsif new.customer_id is not null then
      insert into public.notifications (user_id, kind, title, body, starts_at, timezone, appointment_id)
      values (new.customer_id, 'appointment_cancelled_by_barber', 'ألغى الحلاق موعدك',
              b.shop_name || ' — ' || new.service, new.starts_at, b.timezone, new.id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.notify_appointment_cancelled() from public, anon, authenticated;
create trigger appointments_notify_cancelled after update on public.appointments
  for each row execute function public.notify_appointment_cancelled();

-- ===================== Public shop search =====================
alter table public.barbers add column is_public boolean not null default false;

create or replace function public.ar_normalize(t text)
returns text language sql immutable set search_path = public as $$
  select lower(translate(coalesce(t, ''), 'أإآٱىةـ', 'اااايه'));
$$;

-- Only shops whose barber turned on public visibility. Returns public details only.
create or replace function public.search_public_shops(p_query text default '')
returns table (id uuid, shop_name text, barber_name text, area text, address text, timezone text,
               open_time time, close_time time, slot_minutes int, days_off int[], services jsonb)
language sql stable security definer set search_path = public as $$
  with q as (
    select replace(replace(replace(public.ar_normalize(btrim(left(coalesce(p_query, ''), 60))), '\', '\\'), '%', '\%'), '_', '\_') as v
  )
  select b.id, b.shop_name, b.barber_name, b.area, b.address, b.timezone, b.open_time, b.close_time, b.slot_minutes, b.days_off,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
                       order by s.sort_order, s.created_at)
      from public.services s where s.barber_id = b.id and s.is_active
    ), '[]'::jsonb) as services
  from public.barbers b, q
  where b.is_public and auth.uid() is not null
    and (q.v = ''
         or public.ar_normalize(b.shop_name) like '%' || q.v || '%'
         or public.ar_normalize(b.barber_name) like '%' || q.v || '%')
  order by b.shop_name
  limit 30;
$$;
revoke execute on function public.search_public_shops(text) from public, anon;
grant execute on function public.search_public_shops(text) to authenticated;

-- One shop's public details: visible if public, or to its owner, or to its existing customers.
create or replace function public.get_public_shop(p_barber_id uuid)
returns table (id uuid, shop_name text, barber_name text, area text, address text, timezone text,
               open_time time, close_time time, slot_minutes int, days_off int[], is_public boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.shop_name, b.barber_name, b.area, b.address, b.timezone, b.open_time, b.close_time, b.slot_minutes, b.days_off, b.is_public
  from public.barbers b
  where b.id = p_barber_id and auth.uid() is not null
    and (b.is_public or b.owner_id = auth.uid()
         or exists (select 1 from public.shop_customers sc where sc.barber_id = b.id and sc.customer_id = auth.uid()));
$$;
revoke execute on function public.get_public_shop(uuid) from public, anon;
grant execute on function public.get_public_shop(uuid) to authenticated;