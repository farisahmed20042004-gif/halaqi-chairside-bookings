-- Tables had blanket privileges from schema defaults; restore the intended, narrower access.
-- Row-level rules stay as they are; this only limits which actions and columns are reachable.
revoke all on public.profiles, public.barbers, public.appointments, public.debts, public.payments,
  public.services, public.shop_customers, public.user_roles, public.notifications from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.barbers to authenticated;
grant select on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
grant select, insert on public.debts to authenticated;
grant update (customer_name, customer_phone, note) on public.debts to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert, update on public.services to authenticated;
grant select on public.shop_customers to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all on public.profiles, public.barbers, public.appointments, public.debts, public.payments,
  public.services, public.shop_customers, public.user_roles, public.notifications to service_role;