-- Reuses the existing debts + payments tables (no duplicate money records).
-- customer_debts is a read-only ledger view over them: one row per debt or payment.
-- security_invoker = true means the existing row rules of debts/payments apply to every reader.
create view public.customer_debts with (security_invoker = true) as
  select d.id, d.id as debt_id, d.barber_id, d.customer_id, d.customer_name, d.customer_phone,
         d.amount, d.note, 'debt'::text as type, d.incurred_at as created_at
  from public.debts d
  union all
  select p.id, p.debt_id, p.barber_id, d.customer_id, d.customer_name, d.customer_phone,
         p.amount, d.note, 'payment'::text as type, p.paid_at as created_at
  from public.payments p
  join public.debts d on d.id = p.debt_id;
revoke all on public.customer_debts from public, anon, authenticated;
grant select on public.customer_debts to authenticated;
grant select on public.customer_debts to service_role;

-- ===================== Money notifications (in-app) =====================
alter table public.notifications
  add column debt_id uuid references public.debts(id),
  add column amount bigint,
  add column balance bigint;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'appointment_cancelled_by_customer', 'appointment_cancelled_by_barber', 'debt_added', 'payment_recorded'));

-- What a linked customer still owes one shop.
create or replace function public.customer_shop_balance(p_barber uuid, p_customer uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from public.debts where barber_id = p_barber and customer_id = p_customer), 0)
       - coalesce((select sum(p.amount) from public.payments p join public.debts d on d.id = p.debt_id
                   where d.barber_id = p_barber and d.customer_id = p_customer), 0);
$$;
revoke execute on function public.customer_shop_balance(uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_debt_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b public.barbers;
begin
  if new.customer_id is null then return new; end if;
  select * into b from public.barbers where id = new.barber_id;
  insert into public.notifications (user_id, kind, title, body, timezone, debt_id, amount, balance)
  values (new.customer_id, 'debt_added', 'تم إضافة دين جديد من حلاقك',
          b.shop_name || coalesce(' — ' || nullif(btrim(new.note), ''), ''), b.timezone, new.id, new.amount,
          public.customer_shop_balance(new.barber_id, new.customer_id));
  return new;
end $$;
revoke execute on function public.notify_debt_added() from public, anon, authenticated;
create trigger debts_notify_added after insert on public.debts
  for each row execute function public.notify_debt_added();

create or replace function public.notify_payment_recorded()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d public.debts;
  b public.barbers;
begin
  select * into d from public.debts where id = new.debt_id;
  if d.customer_id is null then return new; end if;
  select * into b from public.barbers where id = d.barber_id;
  insert into public.notifications (user_id, kind, title, body, timezone, debt_id, amount, balance)
  values (d.customer_id, 'payment_recorded', 'تم تسجيل تسديد جديد',
          b.shop_name || coalesce(' — ' || nullif(btrim(d.note), ''), ''), b.timezone, d.id, new.amount,
          public.customer_shop_balance(d.barber_id, d.customer_id));
  return new;
end $$;
revoke execute on function public.notify_payment_recorded() from public, anon, authenticated;
create trigger payments_notify_recorded after insert on public.payments
  for each row execute function public.notify_payment_recorded();

-- Live updates; row rules still decide who receives each change.
alter publication supabase_realtime add table public.debts, public.payments, public.notifications;