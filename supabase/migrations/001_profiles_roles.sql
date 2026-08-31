-- TAGA Lot 1: identité, rôles et profils. À appliquer via Supabase CLI.
-- Les privilèges admin sont attribués côté serveur uniquement.

create extension if not exists pgcrypto;

create type public.taga_role as enum ('passenger', 'driver', 'admin');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  role public.taga_role not null default 'passenger',
  status text not null default 'active'
    check (status in ('active', 'pending', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.passenger_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null default '',
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  availability_status text not null default 'offline'
    check (availability_status in ('offline', 'available', 'on_ride')),
  rating numeric(3, 2) not null default 0
    check (rating >= 0 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(user_id) on delete cascade,
  make text not null default '',
  model text not null,
  registration_number text not null unique,
  color text not null default '',
  status text not null default 'pending'
    check (status in ('active', 'pending', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_driver_id_unique unique (driver_id)
);

create index profiles_role_status_idx on public.profiles(role, status);
create index vehicles_driver_status_idx on public.vehicles(driver_id, status);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger passenger_profiles_set_updated_at
before update on public.passenger_profiles
for each row execute function public.set_updated_at();

create trigger driver_profiles_set_updated_at
before update on public.driver_profiles
for each row execute function public.set_updated_at();

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create or replace function public.prevent_client_profile_authority_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
    and (
      new.id is distinct from old.id
      or new.phone is distinct from old.phone
      or new.role is distinct from old.role
      or new.status is distinct from old.status
    ) then
    raise exception 'profile authority fields are server-managed';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_client_authority_changes
before update on public.profiles
for each row execute function public.prevent_client_profile_authority_changes();

create or replace function public.prevent_client_driver_authority_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
    and (
      new.user_id is distinct from old.user_id
      or new.verification_status is distinct from old.verification_status
      or new.availability_status is distinct from old.availability_status
      or new.rating is distinct from old.rating
    ) then
    raise exception 'driver authority fields are server-managed';
  end if;
  return new;
end;
$$;

create trigger driver_profiles_prevent_client_authority_changes
before update on public.driver_profiles
for each row execute function public.prevent_client_driver_authority_changes();

create or replace function public.prevent_client_vehicle_authority_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
    and (
      new.driver_id is distinct from old.driver_id
      or new.status is distinct from old.status
    ) then
    raise exception 'vehicle authority fields are server-managed';
  end if;
  return new;
end;
$$;

create trigger vehicles_prevent_client_authority_changes
before update on public.vehicles
for each row execute function public.prevent_client_vehicle_authority_changes();

alter table public.profiles enable row level security;
alter table public.passenger_profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.passenger_profiles to authenticated;
grant select, insert, update on public.driver_profiles to authenticated;
grant select, insert, update on public.vehicles to authenticated;

create policy profiles_select_own
on public.profiles for select to authenticated
using (id = auth.uid());

create policy profiles_insert_self_non_admin
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and role in ('passenger', 'driver')
  and status = 'active'
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy passenger_profiles_select_own
on public.passenger_profiles for select to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'passenger'
  )
);

create policy passenger_profiles_insert_own
on public.passenger_profiles for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'passenger'
  )
);

create policy passenger_profiles_update_own
on public.passenger_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy driver_profiles_select_own
on public.driver_profiles for select to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver'
  )
);

create policy driver_profiles_insert_own
on public.driver_profiles for insert to authenticated
with check (
  user_id = auth.uid()
  and verification_status = 'pending'
  and availability_status = 'offline'
  and rating = 0
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver'
  )
);

create policy driver_profiles_update_own
on public.driver_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy vehicles_select_own
on public.vehicles for select to authenticated
using (
  driver_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver'
  )
);

create policy vehicles_insert_own
on public.vehicles for insert to authenticated
with check (
  driver_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver'
  )
);

create policy vehicles_update_own
on public.vehicles for update to authenticated
using (driver_id = auth.uid())
with check (driver_id = auth.uid());
