-- ===================== Roles =====================
create type public.app_role as enum ('barber', 'customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Existing accounts: shop owners are barbers, everyone else is a customer.
insert into public.user_roles (user_id, role)
select u.id,
  (case when exists (select 1 from public.barbers b where b.owner_id = u.id)
          or u.raw_user_meta_data->>'account_type' = 'barber'
        then 'barber' else 'customer' end)::public.app_role
from auth.users u
on conflict (user_id) do nothing;

-- The account type picked at sign-up becomes the account's only role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data->>'full_name', 100), ''),
    left(new.raw_user_meta_data->>'phone', 30)
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (
    new.id,
    (case when new.raw_user_meta_data->>'account_type' = 'barber' then 'barber' else 'customer' end)::public.app_role
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

-- ===================== Shops =====================
alter table public.barbers add column address text check (char_length(address) <= 200);

drop policy "barbers_insert_own" on public.barbers;
create policy "barbers_insert_own" on public.barbers for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(auth.uid(), 'barber'));

-- ===================== Services =====================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (char_length(description) <= 200),
  price bigint not null check (price >= 0 and price <= 100000000),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_barber_idx on public.services (barber_id, sort_order, created_at);
grant select, insert, update on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "services_select_owner" on public.services for select to authenticated using (public.is_barber_owner(barber_id));
create policy "services_insert_owner" on public.services for insert to authenticated with check (public.is_barber_owner(barber_id));
create policy "services_update_owner" on public.services for update to authenticated
  using (public.is_barber_owner(barber_id)) with check (public.is_barber_owner(barber_id));

create or replace function public.services_protect_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.barber_id := old.barber_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger services_protect_fields before insert or update on public.services
  for each row execute function public.services_protect_fields();

-- Active services and prices of one shop, for signed-in customers.
create or replace function public.get_shop_services(p_barber_id uuid)
returns table (id uuid, name text, description text, price bigint, duration_minutes int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.price, s.duration_minutes
  from public.services s
  where s.barber_id = p_barber_id and s.is_active and auth.uid() is not null
  order by s.sort_order, s.created_at;
$$;
revoke execute on function public.get_shop_services(uuid) from public, anon;
grant execute on function public.get_shop_services(uuid) to authenticated;

-- Public shop details by code (no owner id, no private data).
drop function public.find_barber_by_code(text);
create function public.find_barber_by_code(p_code text)
returns table (id uuid, code text, shop_name text, barber_name text, area text, address text, timezone text,
               open_time time, close_time time, slot_minutes int, days_off int[])
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.shop_name, b.barber_name, b.area, b.address, b.timezone, b.open_time, b.close_time, b.slot_minutes, b.days_off
  from public.barbers b
  where b.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
    and auth.uid() is not null;
$$;
revoke execute on function public.find_barber_by_code(text) from public, anon;
grant execute on function public.find_barber_by_code(text) to authenticated;

-- ===================== Customer ↔ shop =====================
create table public.shop_customers (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  customer_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  last_booked_at timestamptz,
  primary key (barber_id, customer_id)
);
create index shop_customers_customer_idx on public.shop_customers (customer_id);
grant select on public.shop_customers to authenticated;
grant all on public.shop_customers to service_role;
alter table public.shop_customers enable row level security;
create policy "shop_customers_select" on public.shop_customers for select to authenticated
  using (public.is_barber_owner(barber_id) or customer_id = auth.uid());

insert into public.shop_customers (barber_id, customer_id, display_name, phone, created_at, last_booked_at)
select distinct on (a.barber_id, a.customer_id)
  a.barber_id, a.customer_id, a.customer_name, a.customer_phone, a.created_at, a.created_at
from public.appointments a
where a.customer_id is not null
order by a.barber_id, a.customer_id, a.created_at desc
on conflict do nothing;

create or replace function public.get_my_shops()
returns table (id uuid, code text, shop_name text, barber_name text, area text, address text)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.shop_name, b.barber_name, b.area, b.address
  from public.shop_customers sc join public.barbers b on b.id = sc.barber_id
  where sc.customer_id = auth.uid()
  order by coalesce(sc.last_booked_at, sc.created_at) desc;
$$;
revoke execute on function public.get_my_shops() from public, anon;
grant execute on function public.get_my_shops() to authenticated;

-- ===================== Appointments =====================
alter type public.appointment_status add value if not exists 'pending' before 'confirmed';

create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add column service_id uuid references public.services(id) on delete set null,
  add column price bigint check (price >= 0),
  add column duration_minutes int check (duration_minutes between 5 and 480),
  add column ends_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column cancelled_at timestamptz,
  add column cancelled_by uuid,
  add column rescheduled_from timestamptz;

update public.appointments a
set duration_minutes = b.slot_minutes,
    ends_at = a.starts_at + make_interval(mins => b.slot_minutes)
from public.barbers b
where b.id = a.barber_id;

create or replace function public.appointments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.duration_minutes is null then
    select slot_minutes into new.duration_minutes from public.barbers where id = new.barber_id;
  end if;
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.barber_id := old.barber_id;
    new.customer_id := old.customer_id;
    new.created_at := old.created_at;
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'ALREADY_CANCELLED';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
create trigger appointments_before_write before insert or update on public.appointments
  for each row execute function public.appointments_before_write();

alter table public.appointments add constraint appointments_end_after_start check (ends_at > starts_at);
-- Overlapping active bookings for the same shop are impossible, even for simultaneous requests.
alter table public.appointments add constraint appointments_no_overlap
  exclude using gist (barber_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status <> 'cancelled');

-- Shared slot validation (working hours, grid, days off, booking window).
create or replace function public.assert_bookable_slot(p_barber public.barbers, p_starts_at timestamptz, p_duration int)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  local_ts timestamp;
  minute_of_day int;
  open_m int;
  close_m int;
begin
  if p_starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if p_starts_at > now() + interval '31 days' then raise exception 'SLOT_TOO_FAR'; end if;
  local_ts := p_starts_at at time zone p_barber.timezone;
  if extract(dow from local_ts)::int = any (p_barber.days_off) then raise exception 'DAY_OFF'; end if;
  minute_of_day := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  open_m := extract(hour from p_barber.open_time)::int * 60 + extract(minute from p_barber.open_time)::int;
  close_m := extract(hour from p_barber.close_time)::int * 60 + extract(minute from p_barber.close_time)::int;
  if extract(second from local_ts) <> 0
     or minute_of_day < open_m
     or minute_of_day + p_duration > close_m
     or (minute_of_day - open_m) % p_barber.slot_minutes <> 0 then
    raise exception 'OUTSIDE_HOURS';
  end if;
end $$;
revoke execute on function public.assert_bookable_slot(public.barbers, timestamptz, int) from public, anon, authenticated;

drop function public.get_available_slots(uuid, date);
create function public.get_available_slots(p_barber_id uuid, p_day date, p_service_id uuid, p_ignore_appointment uuid default null)
returns table (starts_at timestamptz, available boolean)
language sql stable security definer set search_path = public as $$
  with b as (
    select * from public.barbers where id = p_barber_id and auth.uid() is not null
  ),
  s as (
    select duration_minutes from public.services where id = p_service_id and barber_id = p_barber_id and is_active
  ),
  g as (
    select ((p_day + b.open_time) + make_interval(mins => m)) at time zone b.timezone as starts_at,
           ((p_day + b.open_time) + make_interval(mins => m + s.duration_minutes)) at time zone b.timezone as ends_at
    from b, s,
      generate_series(0, (extract(epoch from (b.close_time - b.open_time)) / 60)::int - s.duration_minutes, b.slot_minutes) as m
    where not (extract(dow from p_day)::int = any (b.days_off))
      and p_day <= (now() at time zone b.timezone)::date + 31
  )
  select g.starts_at,
    g.starts_at > now() and not exists (
      select 1 from public.appointments a
      where a.barber_id = p_barber_id and a.status <> 'cancelled'
        and a.id is distinct from p_ignore_appointment
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(g.starts_at, g.ends_at, '[)')
    ) as available
  from g
  order by g.starts_at;
$$;
revoke execute on function public.get_available_slots(uuid, date, uuid, uuid) from public, anon;
grant execute on function public.get_available_slots(uuid, date, uuid, uuid) to authenticated;

drop function public.book_appointment(uuid, timestamptz, text, text, text);
create function public.book_appointment(
  p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_customer_name text default null, p_customer_phone text default null
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b public.barbers;
  s public.services;
  is_owner boolean;
  cname text;
  cphone text;
  result public.appointments;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into b from public.barbers where id = p_barber_id;
  if not found then raise exception 'BARBER_NOT_FOUND'; end if;
  is_owner := b.owner_id = uid;
  if not is_owner and not public.has_role(uid, 'customer') then raise exception 'NOT_A_CUSTOMER'; end if;

  select * into s from public.services where id = p_service_id and barber_id = b.id;
  if not found or not s.is_active then raise exception 'SERVICE_UNAVAILABLE'; end if;

  perform public.assert_bookable_slot(b, p_starts_at, s.duration_minutes);

  cname := nullif(btrim(coalesce(p_customer_name, '')), '');
  cphone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  if not is_owner then
    if cname is null then select nullif(btrim(full_name), '') into cname from public.profiles where id = uid; end if;
    if (select count(*) from public.appointments
        where barber_id = b.id and customer_id = uid and status <> 'cancelled' and status <> 'completed' and starts_at > now()) >= 3 then
      raise exception 'TOO_MANY_BOOKINGS';
    end if;
  end if;
  if cname is null or char_length(cname) < 2 then raise exception 'NAME_REQUIRED'; end if;

  begin
    insert into public.appointments (barber_id, customer_id, customer_name, customer_phone, service, service_id, price, duration_minutes, starts_at, status)
    values (b.id, case when is_owner then null else uid end, left(cname, 80), left(cphone, 30),
            s.name, s.id, s.price, s.duration_minutes, p_starts_at, 'confirmed')
    returning * into result;
  exception when exclusion_violation or unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  if not is_owner then
    insert into public.shop_customers (barber_id, customer_id, display_name, phone, last_booked_at)
    values (b.id, uid, left(cname, 80), left(cphone, 30), now())
    on conflict (barber_id, customer_id) do update
      set display_name = excluded.display_name,
          phone = coalesce(excluded.phone, public.shop_customers.phone),
          last_booked_at = now();
  end if;
  return result;
end $$;
revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text) to authenticated;

create or replace function public.reschedule_appointment(p_id uuid, p_new_starts_at timestamptz)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a public.appointments;
  b public.barbers;
  is_owner boolean;
  result public.appointments;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into a from public.appointments where id = p_id for update;
  if not found then raise exception 'CANNOT_RESCHEDULE'; end if;
  select * into b from public.barbers where id = a.barber_id;
  is_owner := b.owner_id = uid;
  if not is_owner and a.customer_id is distinct from uid then raise exception 'CANNOT_RESCHEDULE'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'CANNOT_RESCHEDULE'; end if;
  if not is_owner and a.starts_at <= now() then raise exception 'CANNOT_RESCHEDULE'; end if;
  if p_new_starts_at = a.starts_at then return a; end if;

  perform public.assert_bookable_slot(b, p_new_starts_at, a.duration_minutes);

  begin
    update public.appointments
    set starts_at = p_new_starts_at, rescheduled_from = a.starts_at
    where id = a.id
    returning * into result;
  exception when exclusion_violation or unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return result;
end $$;
revoke execute on function public.reschedule_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;

create or replace function public.cancel_my_appointment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.appointments set status = 'cancelled'
  where id = p_id and customer_id = auth.uid() and status in ('pending', 'confirmed') and starts_at > now();
  if not found then raise exception 'CANNOT_CANCEL'; end if;
end $$;

drop function public.get_my_appointments();
create function public.get_my_appointments()
returns table (id uuid, barber_id uuid, service_id uuid, starts_at timestamptz, ends_at timestamptz, service text,
               price bigint, duration_minutes int, status public.appointment_status, rescheduled_from timestamptz,
               shop_name text, barber_name text, timezone text, days_off int[])
language sql stable security definer set search_path = public as $$
  select a.id, a.barber_id, a.service_id, a.starts_at, a.ends_at, a.service, a.price, a.duration_minutes, a.status,
         a.rescheduled_from, b.shop_name, b.barber_name, b.timezone, b.days_off
  from public.appointments a join public.barbers b on b.id = a.barber_id
  where a.customer_id = auth.uid()
  order by a.starts_at desc
  limit 200;
$$;
revoke execute on function public.get_my_appointments() from public, anon;
grant execute on function public.get_my_appointments() to authenticated;

-- ===================== Debts =====================
alter table public.debts
  add column customer_id uuid,
  add column link_code text unique,
  add column linked_at timestamptz,
  add column created_by uuid;
create index debts_customer_idx on public.debts (customer_id);

create or replace function public.generate_debt_link_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  result text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    result := 'D-';
    for i in 0..7 loop
      result := result || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.debts where link_code = result);
  end loop;
  return result;
end $$;
revoke execute on function public.generate_debt_link_code() from public, anon, authenticated;

update public.debts set link_code = public.generate_debt_link_code() where customer_id is null and link_code is null;

create or replace function public.debts_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sc public.shop_customers;
begin
  new.created_at := now();
  new.created_by := auth.uid();
  if new.customer_id is not null then
    select * into sc from public.shop_customers where barber_id = new.barber_id and customer_id = new.customer_id;
    if not found then raise exception 'CUSTOMER_NOT_IN_SHOP'; end if;
    new.link_code := null;
    new.linked_at := now();
  else
    new.link_code := public.generate_debt_link_code();
    new.linked_at := null;
  end if;
  return new;
end $$;
create trigger debts_before_insert before insert on public.debts
  for each row execute function public.debts_before_insert();

-- Debts and payments are permanent history.
drop policy "debts_delete_owner" on public.debts;
revoke delete on public.debts from authenticated;

create policy "debts_select_customer" on public.debts for select to authenticated using (customer_id = auth.uid());

-- Customer claims an old debt with the one-time code the barber gave them.
create or replace function public.claim_debt(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d public.debts;
  pname text;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.has_role(uid, 'customer') then raise exception 'NOT_A_CUSTOMER'; end if;
  select * into d from public.debts
  where link_code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and customer_id is null
  for update;
  if not found then raise exception 'INVALID_LINK_CODE'; end if;
  update public.debts set customer_id = uid, link_code = null, linked_at = now() where id = d.id;
  select nullif(btrim(full_name), '') into pname from public.profiles where id = uid;
  insert into public.shop_customers (barber_id, customer_id, display_name, phone)
  values (d.barber_id, uid, left(coalesce(pname, d.customer_name), 80), d.customer_phone)
  on conflict (barber_id, customer_id) do nothing;
  return d.id;
end $$;
revoke execute on function public.claim_debt(text) from public, anon;
grant execute on function public.claim_debt(text) to authenticated;

-- Barber links an unlinked debt to a customer who already has an account with the shop.
create or replace function public.link_debt_to_customer(p_debt_id uuid, p_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.debts;
begin
  select * into d from public.debts where id = p_debt_id for update;
  if not found or not public.is_barber_owner(d.barber_id) then raise exception 'DEBT_NOT_FOUND'; end if;
  if d.customer_id is not null then raise exception 'ALREADY_LINKED'; end if;
  if not exists (select 1 from public.shop_customers where barber_id = d.barber_id and customer_id = p_customer_id) then
    raise exception 'CUSTOMER_NOT_IN_SHOP';
  end if;
  update public.debts set customer_id = p_customer_id, link_code = null, linked_at = now() where id = d.id;
end $$;
revoke execute on function public.link_debt_to_customer(uuid, uuid) from public, anon;
grant execute on function public.link_debt_to_customer(uuid, uuid) to authenticated;

-- ===================== Payments =====================
alter table public.payments add column created_by uuid;

create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d public.debts;
  already_paid bigint;
begin
  select * into d from public.debts where id = new.debt_id for update;
  if not found then raise exception 'DEBT_NOT_FOUND'; end if;
  new.barber_id := d.barber_id;
  new.paid_at := now();
  new.created_by := auth.uid();
  select coalesce(sum(amount), 0) into already_paid from public.payments where debt_id = d.id;
  if already_paid + new.amount > d.amount then
    raise exception 'OVERPAYMENT';
  end if;
  return new;
end $$;

create policy "payments_select_customer" on public.payments for select to authenticated
  using (exists (select 1 from public.debts d where d.id = debt_id and d.customer_id = auth.uid()));
