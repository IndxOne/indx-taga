-- TAGA Lot 2: création sécurisée d'une course.
--
-- La commande create_ride est le seul point d'écriture exposé au client.
-- passenger_id, status et estimated_price sont des champs serveur : ils ne
-- font volontairement pas partie de sa signature.

create type public.taga_ride_type as enum ('go', 'partage', 'family', 'confort');

create type public.taga_ride_status as enum (
  'requested',
  'searching',
  'assigned',
  'arriving',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_driver'
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete restrict,
  pickup_label text not null check (char_length(btrim(pickup_label)) between 1 and 240),
  pickup_lat double precision,
  pickup_lng double precision,
  destination_label text not null check (char_length(btrim(destination_label)) between 1 and 240),
  destination_lat double precision,
  destination_lng double precision,
  ride_type public.taga_ride_type not null,
  scheduled_at timestamptz,
  status public.taga_ride_status not null default 'requested',
  -- Nullable until the pricing lot. If populated, it is always server-owned.
  estimated_price integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rides_pickup_lat_range check (pickup_lat is null or pickup_lat between -90 and 90),
  constraint rides_pickup_lng_range check (pickup_lng is null or pickup_lng between -180 and 180),
  constraint rides_destination_lat_range check (destination_lat is null or destination_lat between -90 and 90),
  constraint rides_destination_lng_range check (destination_lng is null or destination_lng between -180 and 180),
  constraint rides_estimated_price_non_negative check (estimated_price is null or estimated_price >= 0)
);

create table public.ride_status_history (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  status public.taga_ride_status not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index rides_passenger_created_idx on public.rides(passenger_id, created_at desc);
create index rides_status_created_idx on public.rides(status, created_at);
create index rides_scheduled_idx on public.rides(scheduled_at) where scheduled_at is not null;
create index ride_status_history_ride_created_idx on public.ride_status_history(ride_id, created_at);

create trigger rides_set_updated_at
before update on public.rides
for each row execute function public.set_updated_at();

alter table public.rides enable row level security;
alter table public.ride_status_history enable row level security;

-- Les écritures de course passent exclusivement par la fonction RPC. La
-- lecture reste autorisée uniquement sur les propres courses de l'utilisateur.
revoke all on public.rides from anon, authenticated;
grant select on public.rides to authenticated;

revoke all on public.ride_status_history from anon, authenticated;
grant select on public.ride_status_history to authenticated;

create policy rides_select_own
on public.rides for select to authenticated
using ((select auth.uid()) = passenger_id);

create policy ride_status_history_select_own
on public.ride_status_history for select to authenticated
using (
  exists (
    select 1
    from public.rides
    where public.rides.id = ride_status_history.ride_id
      and public.rides.passenger_id = (select auth.uid())
  )
);

-- La fonction est SECURITY DEFINER uniquement parce que les privilèges INSERT
-- sont retirés à authenticated. Elle dérive toutes les valeurs d'autorité de
-- auth.uid() et force le statut initial. search_path vide + noms qualifiés
-- évitent qu'un appelant influence la résolution des objets.
create or replace function public.create_ride(
  p_pickup jsonb,
  p_destination jsonb,
  p_ride_type public.taga_ride_type,
  p_scheduled_at timestamptz default null
)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  pickup_label_value text;
  destination_label_value text;
  pickup_lat_value double precision;
  pickup_lng_value double precision;
  destination_lat_value double precision;
  destination_lng_value double precision;
  created_ride public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour créer une course.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where public.profiles.id = current_user_id
      and public.profiles.role = 'passenger'
      and public.profiles.status = 'active'
  ) then
    raise exception 'Seul un passager actif peut créer une course.'
      using errcode = '42501';
  end if;

  if p_pickup is null or jsonb_typeof(p_pickup) <> 'object'
     or p_destination is null or jsonb_typeof(p_destination) <> 'object' then
    raise exception 'Les points de départ et de destination sont requis.'
      using errcode = '22023';
  end if;

  pickup_label_value := nullif(btrim(p_pickup->>'label'), '');
  destination_label_value := nullif(btrim(p_destination->>'label'), '');

  if pickup_label_value is null or char_length(pickup_label_value) > 240
     or destination_label_value is null or char_length(destination_label_value) > 240 then
    raise exception 'Les libellés de trajet sont invalides.'
      using errcode = '22023';
  end if;

  if p_scheduled_at is not null and p_scheduled_at < now() then
    raise exception 'La date planifiée doit être future.'
      using errcode = '22023';
  end if;

  pickup_lat_value := nullif(p_pickup->>'lat', '')::double precision;
  pickup_lng_value := nullif(p_pickup->>'lng', '')::double precision;
  destination_lat_value := nullif(p_destination->>'lat', '')::double precision;
  destination_lng_value := nullif(p_destination->>'lng', '')::double precision;

  if pickup_lat_value is not null and pickup_lat_value not between -90 and 90
     or destination_lat_value is not null and destination_lat_value not between -90 and 90
     or pickup_lng_value is not null and pickup_lng_value not between -180 and 180
     or destination_lng_value is not null and destination_lng_value not between -180 and 180 then
    raise exception 'Les coordonnées GPS sont invalides.'
      using errcode = '22023';
  end if;

  insert into public.rides (
    passenger_id,
    pickup_label,
    pickup_lat,
    pickup_lng,
    destination_label,
    destination_lat,
    destination_lng,
    ride_type,
    scheduled_at,
    status,
    estimated_price
  ) values (
    current_user_id,
    pickup_label_value,
    pickup_lat_value,
    pickup_lng_value,
    destination_label_value,
    destination_lat_value,
    destination_lng_value,
    p_ride_type,
    p_scheduled_at,
    'requested',
    null
  )
  returning * into created_ride;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (created_ride.id, 'requested', current_user_id);

  return created_ride;
end;
$$;

revoke execute on function public.create_ride(jsonb, jsonb, public.taga_ride_type, timestamptz) from public, anon;
grant execute on function public.create_ride(jsonb, jsonb, public.taga_ride_type, timestamptz) to authenticated;
