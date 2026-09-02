-- TAGA Lot 4A : ne jamais exposer une position chauffeur trop ancienne.
-- La migration 005 reste inchangée après application ; cette migration ne
-- remplace que la politique de lecture dans les environnements déjà migrés.

drop policy if exists driver_locations_select_active_participant
on public.driver_locations;

create policy driver_locations_select_active_participant
on public.driver_locations for select to authenticated
using (
  driver_locations.recorded_at > now() - interval '60 seconds'
  and exists (
    select 1
    from public.rides r
    where r.id = driver_locations.ride_id
      and r.driver_id = driver_locations.driver_id
      and r.status in ('assigned', 'arriving', 'arrived', 'in_progress')
      and (r.passenger_id = (select auth.uid()) or r.driver_id = (select auth.uid()))
  )
);
