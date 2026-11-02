-- Customers can keep several barbers: one row per (customer, barber) instead of one per customer.
alter table public.customer_barbers drop constraint customer_barbers_pkey;
alter table public.customer_barbers add constraint customer_barbers_pkey primary key (customer_id, barber_id);

-- Add a barber to the signed-in customer's list by code (keeps the others). Only a real code is accepted.
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

  if not exists (select 1 from public.customer_barbers where customer_id = uid and barber_id = b.id)
     and (select count(*) from public.customer_barbers where customer_id = uid) >= 30 then
    raise exception 'TOO_MANY_BARBERS';
  end if;

  insert into public.customer_barbers (customer_id, barber_id, barber_code)
  values (uid, b.id, b.code)
  on conflict (customer_id, barber_id) do update
    set barber_code = excluded.barber_code, updated_at = now();

  return query select b.id, b.code, b.shop_name, b.barber_name, b.area, b.address, b.timezone,
                      b.open_time, b.close_time, b.slot_minutes, b.days_off;
end $$;

-- All barbers the signed-in customer saved, in the order they were added (public booking details only).
create or replace function public.get_my_barbers()
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
  where cb.customer_id = auth.uid()
  order by cb.created_at asc, b.shop_name asc;
$$;

-- Kept for older app versions: the most recently saved barber only.
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
  where cb.customer_id = auth.uid()
  order by cb.updated_at desc
  limit 1;
$$;

revoke all on function public.save_my_barber(text) from public, anon;
revoke all on function public.get_my_barbers() from public, anon;
revoke all on function public.get_my_barber() from public, anon;
grant execute on function public.save_my_barber(text) to authenticated, service_role;
grant execute on function public.get_my_barbers() to authenticated, service_role;
grant execute on function public.get_my_barber() to authenticated, service_role;