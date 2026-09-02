-- TAGA Lot 3 : disponibilité chauffeur et premier dispatch.
--
-- Ce lot ne fait pas de géolocalisation : le choix est déterministe jusqu'au
-- lot cartographie. Toutes les transitions sensibles sont atomiques côté SQL.

alter table public.driver_profiles
  add column available_since timestamptz;

alter table public.rides
  add column driver_id uuid references public.driver_profiles(user_id) on delete restrict,
  add column assigned_at timestamptz,
  add column dispatch_deadline_at timestamptz;

create type public.taga_dispatch_offer_status as enum (
  'offered',
  'accepted',
  'rejected',
  'expired'
);

create table public.ride_dispatch_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(user_id) on delete restrict,
  status public.taga_dispatch_offer_status not null default 'offered',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dispatch_offer_expiry_after_offer check (expires_at > offered_at),
  constraint dispatch_offer_response_consistency check (
    (status = 'offered' and responded_at is null)
    or (status <> 'offered' and responded_at is not null)
  )
);

create index driver_profiles_dispatch_idx
  on public.driver_profiles (available_since, user_id)
  where verification_status = 'verified'
    and availability_status = 'available';

create index rides_driver_status_idx
  on public.rides (driver_id, status, created_at desc)
  where driver_id is not null;

create index ride_dispatch_offers_driver_idx
  on public.ride_dispatch_offers (driver_id, status, expires_at);

create index ride_dispatch_offers_ride_idx
  on public.ride_dispatch_offers (ride_id, status, expires_at);

-- Un chauffeur ne peut avoir qu'une offre en attente et une course ne peut
-- avoir qu'une offre courante. Ces index sont la protection finale contre les
-- courses concurrentes, même si deux appels sélectionnent le même chauffeur.
create unique index ride_dispatch_one_active_driver_offer
  on public.ride_dispatch_offers (driver_id)
  where status = 'offered';

create unique index ride_dispatch_one_active_ride_offer
  on public.ride_dispatch_offers (ride_id)
  where status = 'offered';

-- Le client ne peut toujours pas écrire directement la disponibilité. Seules
-- les fonctions ci-dessous activent temporairement le contexte contrôlé.
create or replace function public.prevent_client_driver_authority_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  server_operation text := coalesce(current_setting('taga.server_operation', true), '');
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role'
    and (
      new.user_id is distinct from old.user_id
      or new.verification_status is distinct from old.verification_status
      or new.rating is distinct from old.rating
      or (
        new.availability_status is distinct from old.availability_status
        and server_operation <> 'dispatch'
      )
      or (
        new.available_since is distinct from old.available_since
        and server_operation <> 'dispatch'
      )
    ) then
    raise exception 'driver authority fields are server-managed';
  end if;
  return new;
end;
$$;

alter table public.rides enable row level security;
alter table public.ride_dispatch_offers enable row level security;

grant select on public.rides to authenticated;
grant select on public.ride_dispatch_offers to authenticated;

create policy rides_select_assigned_driver
on public.rides for select to authenticated
using ((select auth.uid()) = driver_id);

create policy ride_dispatch_offers_select_participant
on public.ride_dispatch_offers for select to authenticated
using (
  driver_id = (select auth.uid())
  or exists (
    select 1
    from public.rides
    where public.rides.id = ride_dispatch_offers.ride_id
      and public.rides.passenger_id = (select auth.uid())
  )
);

create policy ride_status_history_select_assigned_driver
on public.ride_status_history for select to authenticated
using (
  exists (
    select 1
    from public.rides
    where public.rides.id = ride_status_history.ride_id
      and public.rides.driver_id = (select auth.uid())
  )
);

-- Disponibilité : un chauffeur actif, vérifié et équipé peut passer en ligne.
-- Le passage hors ligne est refusé pendant une course attribuée.
create or replace function public.set_driver_availability(p_available boolean)
returns public.driver_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  driver_row public.driver_profiles;
  profile_status text;
  profile_role public.taga_role;
  has_active_vehicle boolean;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour modifier la disponibilité.'
      using errcode = '28000';
  end if;

  if p_available is null then
    raise exception 'La disponibilité doit être précisée.' using errcode = '22023';
  end if;

  select p.role, p.status
  into profile_role, profile_status
  from public.profiles p
  where p.id = current_user_id;

  if coalesce(profile_role::text, '') <> 'driver' or coalesce(profile_status, '') <> 'active' then
    raise exception 'Seul un chauffeur actif peut modifier sa disponibilité.'
      using errcode = '42501';
  end if;

  select dp.*
  into driver_row
  from public.driver_profiles dp
  where dp.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Profil chauffeur introuvable.' using errcode = '42501';
  end if;

  if not p_available and driver_row.availability_status = 'on_ride' then
    raise exception 'Un chauffeur en course ne peut pas passer hors ligne.'
      using errcode = '55006';
  end if;

  if p_available then
    if driver_row.verification_status <> 'verified' then
      raise exception 'Le profil chauffeur doit être vérifié avant la mise en ligne.'
        using errcode = '42501';
    end if;

    select exists (
      select 1
      from public.vehicles v
      where v.driver_id = current_user_id
        and v.status = 'active'
    ) into has_active_vehicle;

    if not has_active_vehicle then
      raise exception 'Un véhicule actif est nécessaire pour passer en ligne.'
        using errcode = '42501';
    end if;
  end if;

  perform pg_catalog.set_config('taga.server_operation', 'dispatch', true);
  update public.driver_profiles
  set availability_status = case when p_available then 'available' else 'offline' end,
      available_since = case
        when p_available then coalesce(driver_row.available_since, now())
        else null
      end
  where user_id = current_user_id
  returning * into driver_row;

  return driver_row;
end;
$$;

-- Sélection provisoire avant le lot cartographie : chauffeur vérifié, actif,
-- véhicule actif, disponible, sans offre en attente ni course en cours. L'ordre
-- available_since puis user_id rend le comportement stable et testable.
create or replace function public.create_next_ride_dispatch_offer(p_ride_id uuid)
returns public.ride_dispatch_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  ride_row public.rides;
  candidate public.driver_profiles;
  offer_row public.ride_dispatch_offers;
begin
  update public.ride_dispatch_offers
  set status = 'expired', responded_at = now()
  where status = 'offered'
    and expires_at <= now();

  select r.* into ride_row
  from public.rides r
  where r.id = p_ride_id
  for update;

  if not found or ride_row.status <> 'searching' then
    return null;
  end if;

  if ride_row.dispatch_deadline_at is not null
    and ride_row.dispatch_deadline_at <= now() then
    return null;
  end if;

  select dp.* into candidate
  from public.driver_profiles dp
  join public.profiles p on p.id = dp.user_id
  where p.role = 'driver'
    and p.status = 'active'
    and dp.verification_status = 'verified'
    and dp.availability_status = 'available'
    and exists (
      select 1 from public.vehicles v
      where v.driver_id = dp.user_id and v.status = 'active'
    )
    and not exists (
      select 1 from public.ride_dispatch_offers active_offer
      where active_offer.driver_id = dp.user_id
        and active_offer.status = 'offered'
    )
    and not exists (
      select 1 from public.rides active_ride
      where active_ride.driver_id = dp.user_id
        and active_ride.status in ('assigned', 'arriving', 'arrived', 'in_progress')
    )
  order by dp.available_since asc nulls last, dp.user_id
  for update of dp skip locked
  limit 1;

  if not found then
    return null;
  end if;

  begin
    insert into public.ride_dispatch_offers (
      ride_id,
      driver_id,
      status,
      offered_at,
      expires_at
    ) values (
      p_ride_id,
      candidate.user_id,
      'offered',
      now(),
      now() + interval '30 seconds'
    )
    returning * into offer_row;
  exception when unique_violation then
    -- Un autre appel a réservé ce chauffeur ou cette course entre la
    -- sélection et l'insertion. La course reste searching et sera retentée.
    return null;
  end;

  return offer_row;
end;
$$;

-- Le passager déclenche la recherche. L'opération est idempotente : elle ne
-- crée pas de deuxième recherche si la course est déjà searching.
create or replace function public.request_ride_dispatch(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  ride_row public.rides;
  ignored_offer public.ride_dispatch_offers;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour lancer la recherche.'
      using errcode = '28000';
  end if;

  select r.* into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.passenger_id = current_user_id
  for update;

  if not found then
    raise exception 'Course introuvable.' using errcode = '42501';
  end if;

  if ride_row.status = 'requested' then
    update public.rides
    set status = 'searching',
        dispatch_deadline_at = now() + interval '120 seconds'
    where id = p_ride_id
    returning * into ride_row;

    insert into public.ride_status_history (ride_id, status, actor_id)
    values (p_ride_id, 'searching', current_user_id);

    select public.create_next_ride_dispatch_offer(p_ride_id) into ignored_offer;
  elsif ride_row.status = 'searching'
    and ride_row.dispatch_deadline_at is not null
    and ride_row.dispatch_deadline_at <= now() then
    update public.rides
    set status = 'no_driver', dispatch_deadline_at = null
    where id = ride_row.id
    returning * into ride_row;

    insert into public.ride_status_history (ride_id, status, actor_id)
    values (ride_row.id, 'no_driver', current_user_id);
  elsif ride_row.status = 'searching' then
    select public.create_next_ride_dispatch_offer(p_ride_id) into ignored_offer;
  end if;

  return ride_row;
end;
$$;

-- Réponse chauffeur atomique. Le verrou de la course décide le gagnant si
-- plusieurs réponses arrivent presque simultanément.
create or replace function public.respond_to_ride_offer(
  p_offer_id uuid,
  p_decision text
)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offer_row public.ride_dispatch_offers;
  ride_row public.rides;
  profile_role public.taga_role;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour répondre à une offre.'
      using errcode = '28000';
  end if;

  if lower(coalesce(p_decision, '')) not in ('accept', 'reject') then
    raise exception 'La décision doit être accept ou reject.' using errcode = '22023';
  end if;

  select p.role into profile_role
  from public.profiles p
  where p.id = current_user_id and p.status = 'active';

  if coalesce(profile_role::text, '') <> 'driver' then
    raise exception 'Seul un chauffeur peut répondre à une offre.'
      using errcode = '42501';
  end if;

  select o.* into offer_row
  from public.ride_dispatch_offers o
  where o.id = p_offer_id and o.driver_id = current_user_id;

  if not found then
    raise exception 'Offre introuvable.' using errcode = '42501';
  end if;

  select r.* into ride_row
  from public.rides r
  where r.id = offer_row.ride_id
  for update;

  select o.* into offer_row
  from public.ride_dispatch_offers o
  where o.id = p_offer_id
  for update;

  if offer_row.status <> 'offered' then
    return ride_row;
  end if;

  if offer_row.expires_at <= now()
    or ride_row.status <> 'searching'
    or (ride_row.dispatch_deadline_at is not null and ride_row.dispatch_deadline_at <= now()) then
    update public.ride_dispatch_offers
    set status = 'expired', responded_at = now()
    where id = p_offer_id;

    if ride_row.status = 'searching'
      and (ride_row.dispatch_deadline_at is null or ride_row.dispatch_deadline_at > now()) then
      perform public.create_next_ride_dispatch_offer(ride_row.id);
    elsif ride_row.status = 'searching' then
      update public.rides
      set status = 'no_driver', dispatch_deadline_at = null
      where id = ride_row.id
      returning * into ride_row;

      insert into public.ride_status_history (ride_id, status, actor_id)
      values (ride_row.id, 'no_driver', current_user_id);
    end if;
    return ride_row;
  end if;

  if lower(p_decision) = 'accept' then
    update public.rides
    set driver_id = current_user_id,
        assigned_at = now(),
        status = 'assigned',
        dispatch_deadline_at = null
    where id = ride_row.id
    returning * into ride_row;

    update public.ride_dispatch_offers
    set status = 'accepted', responded_at = now()
    where id = p_offer_id;

    perform pg_catalog.set_config('taga.server_operation', 'dispatch', true);
    update public.driver_profiles
    set availability_status = 'on_ride', available_since = null
    where user_id = current_user_id;

    insert into public.ride_status_history (ride_id, status, actor_id)
    values (ride_row.id, 'assigned', current_user_id);
  else
    update public.ride_dispatch_offers
    set status = 'rejected', responded_at = now()
    where id = p_offer_id;

    perform public.create_next_ride_dispatch_offer(ride_row.id);
  end if;

  return ride_row;
end;
$$;

-- Appel idempotent utilisé par le client quand son compte à rebours local
-- atteint zéro. La date d'expiration reste décidée par PostgreSQL.
create or replace function public.expire_ride_dispatch_offer(p_offer_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offer_row public.ride_dispatch_offers;
  ride_row public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour expirer une offre.'
      using errcode = '28000';
  end if;

  select o.* into offer_row
  from public.ride_dispatch_offers o
  where o.id = p_offer_id and o.driver_id = current_user_id;

  if not found then
    raise exception 'Offre introuvable.' using errcode = '42501';
  end if;

  select r.* into ride_row
  from public.rides r
  where r.id = offer_row.ride_id
  for update;

  select o.* into offer_row
  from public.ride_dispatch_offers o
  where o.id = p_offer_id
  for update;

  if offer_row.status = 'offered' and offer_row.expires_at <= now() then
    update public.ride_dispatch_offers
    set status = 'expired', responded_at = now()
    where id = p_offer_id;

    if ride_row.status = 'searching'
      and (ride_row.dispatch_deadline_at is null or ride_row.dispatch_deadline_at > now()) then
      perform public.create_next_ride_dispatch_offer(ride_row.id);
    elsif ride_row.status = 'searching' then
      update public.rides
      set status = 'no_driver', dispatch_deadline_at = null
      where id = ride_row.id
      returning * into ride_row;

      insert into public.ride_status_history (ride_id, status, actor_id)
      values (ride_row.id, 'no_driver', current_user_id);
    end if;
  end if;

  return ride_row;
end;
$$;

revoke execute on function public.set_driver_availability(boolean) from public, anon;
grant execute on function public.set_driver_availability(boolean) to authenticated;

revoke execute on function public.create_next_ride_dispatch_offer(uuid) from public, anon, authenticated;
revoke execute on function public.request_ride_dispatch(uuid) from public, anon;
grant execute on function public.request_ride_dispatch(uuid) to authenticated;

revoke execute on function public.respond_to_ride_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_ride_offer(uuid, text) to authenticated;

revoke execute on function public.expire_ride_dispatch_offer(uuid) from public, anon;
grant execute on function public.expire_ride_dispatch_offer(uuid) to authenticated;
