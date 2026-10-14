-- TAGA G0 : transitions de course pilotées par le chauffeur affecté.
--
-- Migration additive, NON APPLIQUÉE : à valider sur un environnement isolé
-- (staging / branche Supabase) avant toute application distante.
--
-- Chaîne autorisée, strictement séquentielle :
--   assigned -> arriving -> arrived -> in_progress -> completed
--
-- Le client ne peut toujours pas écrire sur public.rides (aucun GRANT UPDATE) :
-- cette RPC est le seul point d'écriture de ces transitions. L'état est décidé
-- par PostgreSQL, jamais par le store du client.

create or replace function public.advance_driver_ride(
  p_ride_id uuid,
  p_to_status public.taga_ride_status
)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_role public.taga_role;
  ride_row public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour faire avancer la course.'
      using errcode = '28000';
  end if;

  if p_ride_id is null or p_to_status is null then
    raise exception 'La course et le statut cible sont requis.'
      using errcode = '22023';
  end if;

  if p_to_status not in ('arriving', 'arrived', 'in_progress', 'completed') then
    raise exception 'Ce statut ne peut pas être demandé par le chauffeur.'
      using errcode = '22023';
  end if;

  select p.role into profile_role
  from public.profiles p
  where p.id = current_user_id
    and p.status = 'active';

  if coalesce(profile_role::text, '') <> 'driver' then
    raise exception 'Seul un chauffeur actif peut faire avancer une course.'
      using errcode = '42501';
  end if;

  -- Verrou de ligne : deux appels concurrents sur la même course sont
  -- sérialisés, le second voit l'état déjà modifié par le premier.
  -- La clause driver_id = current_user_id garantit que seul le chauffeur
  -- affecté peut agir ; une course d'un autre chauffeur reste introuvable.
  select r.* into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.driver_id = current_user_id
  for update;

  if not found then
    raise exception 'Course introuvable pour ce chauffeur.'
      using errcode = '42501';
  end if;

  -- Idempotence : rejouer la transition déjà appliquée (réseau instable,
  -- double clic, rechargement) renvoie la course sans écrire d'historique.
  if ride_row.status = p_to_status then
    return ride_row;
  end if;

  if not (
    (ride_row.status = 'assigned' and p_to_status = 'arriving')
    or (ride_row.status = 'arriving' and p_to_status = 'arrived')
    or (ride_row.status = 'arrived' and p_to_status = 'in_progress')
    or (ride_row.status = 'in_progress' and p_to_status = 'completed')
  ) then
    raise exception 'Transition de course interdite : % vers %.', ride_row.status, p_to_status
      using errcode = '55000';
  end if;

  update public.rides
  set status = p_to_status
  where id = ride_row.id
  returning * into ride_row;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (ride_row.id, p_to_status, current_user_id);

  -- Libération du chauffeur : uniquement à la fin de course, et seulement s'il
  -- n'a aucune autre course active. Il repasse hors ligne (et non disponible)
  -- pour ne pas recevoir d'offre sans action explicite de sa part.
  if p_to_status = 'completed' then
    perform pg_catalog.set_config('taga.server_operation', 'dispatch', true);
    update public.driver_profiles dp
    set availability_status = 'offline',
        available_since = null
    where dp.user_id = current_user_id
      and dp.availability_status = 'on_ride'
      and not exists (
        select 1
        from public.rides other
        where other.driver_id = current_user_id
          and other.id <> ride_row.id
          and other.status in ('assigned', 'arriving', 'arrived', 'in_progress')
      );
  end if;

  return ride_row;
end;
$$;

revoke execute on function public.advance_driver_ride(uuid, public.taga_ride_status) from public, anon;
grant execute on function public.advance_driver_ride(uuid, public.taga_ride_status) to authenticated;
