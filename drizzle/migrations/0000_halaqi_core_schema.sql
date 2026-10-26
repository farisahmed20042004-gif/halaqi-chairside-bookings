-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

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
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Barbers =====
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  shop_name text not null check (char_length(shop_name) between 2 and 80),
  barber_name text not null check (char_length(barber_name) between 2 and 80),
  area text check (char_length(area) <= 120),
  code text not null default '' unique,
  timezone text not null default 'Asia/Baghdad',
  open_time time not null default '10:00',
  close_time time not null default '21:00',
  slot_minutes int not null default 30 check (slot_minutes in (15, 20, 30, 45, 60)),
  days_off int[] not null default '{}',
  created_at timestamptz not null default now(),
  check (close_time > open_time)
);
grant select, insert, update on public.barbers to authenticated;
grant all on public.barbers to service_role;
alter table public.barbers enable row level security;
create policy "barbers_select_own" on public.barbers for select to authenticated using (owner_id = auth.uid());
create policy "barbers_insert_own" on public.barbers for insert to authenticated with check (owner_id = auth.uid());
create policy "barbers_update_own" on public.barbers for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.generate_barber_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  result text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    result := 'HLQ-';
    for i in 0..5 loop
      result := result || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.barbers where code = result);
  end loop;
  return result;
end $$;
revoke execute on function public.generate_barber_code() from public, anon, authenticated;

create or replace function public.barbers_protect_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.generate_barber_code();
    new.created_at := now();
  else
    new.id := old.id;
    new.code := old.code;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger barbers_protect_fields before insert or update on public.barbers
  for each row execute function public.barbers_protect_fields();

create or replace function public.is_barber_owner(_barber_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.barbers where id = _barber_id and owner_id = auth.uid());
$$;
revoke execute on function public.is_barber_owner(uuid) from public, anon;
grant execute on function public.is_barber_owner(uuid) to authenticated;

-- Customers look a barber up by code; only public shop details are returned.
create or replace function public.find_barber_by_code(p_code text)
returns table (id uuid, shop_name text, barber_name text, area text, timezone text,
               open_time time, close_time time, slot_minutes int, days_off int[])
language sql stable security definer set search_path = public as $$
  select b.id, b.shop_name, b.barber_name, b.area, b.timezone, b.open_time, b.close_time, b.slot_minutes, b.days_off
  from public.barbers b
  where b.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
    and auth.uid() is not null;
$$;
revoke execute on function public.find_barber_by_code(text) from public, anon;
grant execute on function public.find_barber_by_code(text) to authenticated;

-- ===== Appointments =====
create type public.appointment_status as enum ('confirmed', 'completed', 'cancelled');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  customer_id uuid,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text check (char_length(customer_phone) <= 30),
  service text not null check (char_length(service) between 2 and 60),
  starts_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  created_at timestamptz not null default now()
);
-- The rule that makes double booking impossible, even for simultaneous requests.
create unique index appointments_no_double_booking
  on public.appointments (barber_id, starts_at) where status <> 'cancelled';
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_barber_time_idx on public.appointments (barber_id, starts_at);

grant select on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "appointments_select_barber_or_customer" on public.appointments for select to authenticated
  using (public.is_barber_owner(barber_id) or customer_id = auth.uid());
create policy "appointments_update_barber" on public.appointments for update to authenticated
  using (public.is_barber_owner(barber_id)) with check (public.is_barber_owner(barber_id));

create or replace function public.get_available_slots(p_barber_id uuid, p_day date)
returns table (starts_at timestamptz, available boolean)
language sql stable security definer set search_path = public as $$
  with b as (
    select * from public.barbers where id = p_barber_id and auth.uid() is not null
  ),
  s as (
    select ((p_day + b.open_time) + make_interval(mins => m)) at time zone b.timezone as starts_at, b.id as barber_id
    from b,
      generate_series(0, (extract(epoch from (b.close_time - b.open_time)) / 60)::int - b.slot_minutes, b.slot_minutes) as m
    where not (extract(dow from p_day)::int = any (b.days_off))
  )
  select s.starts_at,
    s.starts_at > now() and not exists (
      select 1 from public.appointments a
      where a.barber_id = s.barber_id and a.starts_at = s.starts_at and a.status <> 'cancelled'
    ) as available
  from s
  order by s.starts_at;
$$;
revoke execute on function public.get_available_slots(uuid, date) from public, anon;
grant execute on function public.get_available_slots(uuid, date) to authenticated;

create or replace function public.book_appointment(
  p_barber_id uuid, p_starts_at timestamptz, p_service text,
  p_customer_name text, p_customer_phone text default null
)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  b public.barbers;
  local_ts timestamp;
  minute_of_day int;
  open_m int;
  close_m int;
  is_owner boolean;
  result public.appointments;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select * into b from public.barbers where id = p_barber_id;
  if not found then
    raise exception 'BARBER_NOT_FOUND';
  end if;
  is_owner := b.owner_id = auth.uid();

  if p_starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if p_starts_at > now() + interval '31 days' then raise exception 'SLOT_TOO_FAR'; end if;

  local_ts := p_starts_at at time zone b.timezone;
  if extract(dow from local_ts)::int = any (b.days_off) then raise exception 'DAY_OFF'; end if;

  minute_of_day := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  open_m := extract(hour from b.open_time)::int * 60 + extract(minute from b.open_time)::int;
  close_m := extract(hour from b.close_time)::int * 60 + extract(minute from b.close_time)::int;
  if extract(second from local_ts) <> 0
     or minute_of_day < open_m
     or minute_of_day + b.slot_minutes > close_m
     or (minute_of_day - open_m) % b.slot_minutes <> 0 then
    raise exception 'OUTSIDE_HOURS';
  end if;

  if not is_owner and (
    select count(*) from public.appointments
    where barber_id = b.id and customer_id = auth.uid() and status = 'confirmed' and starts_at > now()
  ) >= 3 then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;

  begin
    insert into public.appointments (barber_id, customer_id, customer_name, customer_phone, service, starts_at)
    values (b.id, case when is_owner then null else auth.uid() end,
            trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''), trim(p_service), p_starts_at)
    returning * into result;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return result;
end $$;
revoke execute on function public.book_appointment(uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text) to authenticated;

create or replace function public.cancel_my_appointment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.appointments set status = 'cancelled'
  where id = p_id and customer_id = auth.uid() and status = 'confirmed' and starts_at > now();
  if not found then raise exception 'CANNOT_CANCEL'; end if;
end $$;
revoke execute on function public.cancel_my_appointment(uuid) from public, anon;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;

create or replace function public.get_my_appointments()
returns table (id uuid, starts_at timestamptz, service text, status public.appointment_status,
               shop_name text, barber_name text, timezone text)
language sql stable security definer set search_path = public as $$
  select a.id, a.starts_at, a.service, a.status, b.shop_name, b.barber_name, b.timezone
  from public.appointments a join public.barbers b on b.id = a.barber_id
  where a.customer_id = auth.uid()
  order by a.starts_at desc
  limit 100;
$$;
revoke execute on function public.get_my_appointments() from public, anon;
grant execute on function public.get_my_appointments() to authenticated;

-- ===== Debts and payments =====
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text check (char_length(customer_phone) <= 30),
  amount bigint not null check (amount > 0 and amount <= 100000000),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index debts_barber_idx on public.debts (barber_id, created_at desc);
grant select, insert, delete on public.debts to authenticated;
grant update (customer_name, customer_phone, note) on public.debts to authenticated;
grant all on public.debts to service_role;
alter table public.debts enable row level security;
create policy "debts_select_owner" on public.debts for select to authenticated using (public.is_barber_owner(barber_id));
create policy "debts_insert_owner" on public.debts for insert to authenticated with check (public.is_barber_owner(barber_id));
create policy "debts_update_owner" on public.debts for update to authenticated using (public.is_barber_owner(barber_id)) with check (public.is_barber_owner(barber_id));
create policy "debts_delete_owner" on public.debts for delete to authenticated using (public.is_barber_owner(barber_id));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  amount bigint not null check (amount > 0),
  paid_at timestamptz not null default now()
);
create index payments_debt_idx on public.payments (debt_id);
create index payments_barber_idx on public.payments (barber_id, paid_at desc);
grant select, insert on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments_select_owner" on public.payments for select to authenticated using (public.is_barber_owner(barber_id));
create policy "payments_insert_owner" on public.payments for insert to authenticated with check (public.is_barber_owner(barber_id));

-- Payments always belong to the debt's barber and can never exceed what is owed.
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
  select coalesce(sum(amount), 0) into already_paid from public.payments where debt_id = d.id;
  if already_paid + new.amount > d.amount then
    raise exception 'OVERPAYMENT';
  end if;
  return new;
end $$;
create trigger payments_before_insert before insert on public.payments
  for each row execute function public.payments_before_insert();
