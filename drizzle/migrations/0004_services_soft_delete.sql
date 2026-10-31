-- Barbers can remove a service without losing it from past bookings:
-- a removed service is hidden everywhere and can no longer be booked.
alter table public.services add column if not exists deleted_at timestamptz;

create or replace function public.services_protect_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.barber_id := old.barber_id;
    new.created_at := old.created_at;
    -- a removed service stays removed
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.created_at := now();
    new.deleted_at := null;
  end if;
  if new.deleted_at is not null then
    new.is_active := false;
  end if;
  new.updated_at := now();
  return new;
end $$;

create index if not exists services_barber_live_idx on public.services (barber_id) where deleted_at is null;