-- TAGA Lot 4A : position chauffeur et suivi temps réel sans fournisseur
-- cartographique externe.
--
-- Une seule ligne représente la dernière position connue d'un chauffeur pour
-- une course. Les clients ne peuvent pas écrire directement cette table :
-- publish_driver_location dérive l'identité depuis auth.uid() et horodate la
-- position côté PostgreSQL.

create table public.driver_locations (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(user_id) on delete restrict,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  heading_deg double precision,
  speed_mps double precision,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_locations_latitude_range check (latitude between -90 and 90),
  constraint driver_locations_longitude_range check (longitude between -180 and 180),
  constraint driver_locations_accuracy_range check (accuracy_m is null or accuracy_m between 0 and 10000),
  constraint driver_locations_heading_range check (heading_deg is null or (heading_deg >= 0 and heading_deg < 360)),
  constraint driver_locations_speed_range check (speed_mps is null or speed_mps between 0 and 100)
);

create index driver_locations_driver_updated_idx
  on public.driver_locations (driver_id, updated_at desc);

create index driver_locations_recorded_idx
  on public.driver_locations (recorded_at desc);

create trigger driver_locations_set_updated_at
before update on public.driver_locations
for each row execute function public.set_updated_at();

alter table public.driver_locations enable row level security;

-- Pas d'écriture directe depuis anon/authenticated. La lecture est limitée aux
-- participants de la course et à la durée où une position a une utilité.
revoke all on public.driver_locations from anon, authenticated;
grant select on public.driver_locations to authenticated;

create policy driver_locations_select_active_participant
on public.driver_locations for select to authenticated
using (
  exists (
    select 1
    from public.rides r
    where r.id = driver_locations.ride_id
      and r.driver_id = driver_locations.driver_id
      and r.status in ('assigned', 'arriving', 'arrived', 'in_progress')
      and (r.passenger_id = (select auth.uid()) or r.driver_id = (select auth.uid()))
  )
);

create or replace function public.publish_driver_location(
  p_ride_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null,
  p_heading_deg double precision default null,
  p_speed_mps double precision default null
)
returns public.driver_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  ride_row public.rides;
  location_row public.driver_locations;
  profile_role public.taga_role;
  profile_status text;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour publier une position.'
      using errcode = '28000';
  end if;

  if p_ride_id is null
    or p_latitude is null
    or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 then
    raise exception 'Les coordonnées GPS sont invalides.' using errcode = '22023';
  end if;

  if p_accuracy_m is not null and p_accuracy_m not between 0 and 10000 then
    raise exception 'La précision GPS est invalide.' using errcode = '22023';
  end if;

  if p_heading_deg is not null and (p_heading_deg < 0 or p_heading_deg >= 360) then
    raise exception 'Le cap GPS est invalide.' using errcode = '22023';
  end if;

  if p_speed_mps is not null and p_speed_mps not between 0 and 100 then
    raise exception 'La vitesse GPS est invalide.' using errcode = '22023';
  end if;

  select p.role, p.status
  into profile_role, profile_status
  from public.profiles p
  where p.id = current_user_id;

  if coalesce(profile_role::text, '') <> 'driver'
    or coalesce(profile_status, '') <> 'active' then
    raise exception 'Seul un chauffeur actif peut publier une position.'
      using errcode = '42501';
  end if;

  select r.*
  into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.driver_id = current_user_id
    and r.status in ('assigned', 'arriving', 'arrived', 'in_progress')
  for update;

  if not found then
    raise exception 'Course active introuvable pour ce chauffeur.'
      using errcode = '42501';
  end if;

  insert into public.driver_locations (
    ride_id,
    driver_id,
    latitude,
    longitude,
    accuracy_m,
    heading_deg,
    speed_mps,
    recorded_at,
    updated_at
  ) values (
    ride_row.id,
    current_user_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_heading_deg,
    p_speed_mps,
    now(),
    now()
  )
  on conflict (ride_id) do update set
    driver_id = excluded.driver_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    heading_deg = excluded.heading_deg,
    speed_mps = excluded.speed_mps,
    recorded_at = now(),
    updated_at = now()
  returning * into location_row;

  return location_row;
end;
$$;

revoke execute on function public.publish_driver_location(uuid, double precision, double precision, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.publish_driver_location(uuid, double precision, double precision, double precision, double precision, double precision)
  to authenticated;

-- Realtime est nécessaire pour les changements de statut de rides et la
-- dernière position. Le garde permet d'appliquer la migration dans un projet
-- de développement où la publication n'existerait pas encore.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'rides'
    ) then
      alter publication supabase_realtime add table public.rides;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'driver_locations'
    ) then
      alter publication supabase_realtime add table public.driver_locations;
    end if;
  end if;
end;
$$;

alter table public.rides replica identity full;
alter table public.driver_locations replica identity full;
