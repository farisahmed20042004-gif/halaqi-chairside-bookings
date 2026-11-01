-- A customer's chosen barber, remembered so the code is entered only once.
create table if not exists public.customer_barbers (
  customer_id uuid primary key,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  barber_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_barbers_barber_idx on public.customer_barbers (barber_id);

grant select, delete on public.customer_barbers to authenticated;
grant all on public.customer_barbers to service_role;

alter table public.customer_barbers enable row level security;

create policy customer_barbers_select_own on public.customer_barbers
  for select to authenticated using (customer_id = auth.uid());
create policy customer_barbers_delete_own on public.customer_barbers
  for delete to authenticated using (customer_id = auth.uid());

-- Save (or replace) the signed-in customer's barber by code. Only a real code is accepted.
create or replace function public.save_my_barber(p_code text)
returns table(id uuid, code text, shop_name text, barber_name text, area text, address text, timezone text,
              open_time time, close_time time, slot_minutes integer, days_off integer[])
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b public.barbers;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.has_role(uid, 'customer') then raise exception 'NOT_A_CUSTOMER'; end if;
  select * into b from public.barbers
  where barbers.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  if not found then raise exception 'BARBER_NOT_FOUND'; end if;

  insert into public.customer_barbers (customer_id, barber_id, barber_code)
  values (uid, b.id, b.code)
  on conflict (customer_id) do update
    set barber_id = excluded.barber_id, barber_code = excluded.barber_code, updated_at = now();

  return query select b.id, b.code, b.shop_name, b.barber_name, b.area, b.address, b.timezone,
                      b.open_time, b.close_time, b.slot_minutes, b.days_off;
end $$;

-- The signed-in customer's saved barber (public booking details only).
create or replace function public.get_my_barber()
returns table(id uuid, code text, shop_name text, barber_name text, area text, address text, timezone text,
              open_time time, close_time time, slot_minutes integer, days_off integer[])
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.code, b.shop_name, b.barber_name, b.area, b.address, b.timezone,
         b.open_time, b.close_time, b.slot_minutes, b.days_off
  from public.customer_barbers cb join public.barbers b on b.id = cb.barber_id
  where cb.customer_id = auth.uid();
$$;

-- Customer's bookings, newest first, including whether the barber cancelled (rejected) it.
create or replace function public.get_my_bookings()
returns table(id uuid, barber_id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz,
              service text, price bigint, duration_minutes integer, status public.appointment_status,
              cancelled_by_barber boolean, shop_name text, barber_name text, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.barber_id, a.service_id, a.starts_at, a.ends_at, a.created_at, a.service, a.price, a.duration_minutes,
         a.status, (a.status = 'cancelled' and a.cancelled_by is distinct from a.customer_id),
         b.shop_name, b.barber_name, b.timezone
  from public.appointments a join public.barbers b on b.id = a.barber_id
  where a.customer_id = auth.uid()
  order by a.created_at desc
  limit 200;
$$;

revoke all on function public.save_my_barber(text) from public, anon;
revoke all on function public.get_my_barber() from public, anon;
revoke all on function public.get_my_bookings() from public, anon;
grant execute on function public.save_my_barber(text) to authenticated, service_role;
grant execute on function public.get_my_barber() to authenticated, service_role;
grant execute on function public.get_my_bookings() to authenticated, service_role;

-- Live status updates for customers' booking lists (RLS still limits who receives which rows).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;