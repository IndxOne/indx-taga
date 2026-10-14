-- DISPOSITIF DE TEST ISOLÉ — recette uniquement. N'EST PAS une migration.
--
-- Contexte : depuis 012, aucun client authentifié ne peut créer de course
-- (create_ride est révoquée). Pour recetter le parcours réel (dispatch,
-- transitions 011, récapitulatif) avant la sélection d'adresse fiable, une
-- course de test est insérée DIRECTEMENT par le propriétaire de la base.
--
-- Garanties :
--  * ce script est exécuté à la main par le propriétaire du projet de RECETTE
--    (SQL editor / CLI avec le rôle postgres) — jamais depuis un client ;
--  * il ne crée AUCUNE fonction, AUCUN GRANT, AUCUNE RPC : rien n'est joignable
--    depuis anon / authenticated ;
--  * il refuse de s'exécuter sans confirmation explicite d'un environnement isolé
--    et sans rôle superuser ;
--  * il ne touche à aucun secret ni paramètre d'environnement.
--
-- Usage :
--   psql "$STAGING_DB_URL" -v confirm_isolated_staging=yes \
--        -v passenger_id=<uuid du passager de test> \
--        -v pickup_label="Point A (test)" -v pickup_lat=5.3600 -v pickup_lng=-4.0083 \
--        -v dest_label="Point B (test)"   -v dest_lat=5.3200  -v dest_lng=-4.0200 \
--        -f supabase/staging/seed_test_ride.sql
--
-- La course est créée en `searching` pour exercer le dispatch (offre 30 s) ; les
-- coordonnées ci-dessus sont des valeurs de TEST, pas une adresse authentifiée.

\set ON_ERROR_STOP on

select (:'confirm_isolated_staging' = 'yes') as confirmed \gset
\if :confirmed
\else
  \echo 'Refus : définir -v confirm_isolated_staging=yes uniquement sur un environnement de recette isolé.'
  do $$ begin raise exception 'Refus : confirmation d''environnement de recette isolé absente.'; end $$;
\endif

do $$
begin
  if not (select rolsuper from pg_roles where rolname = current_user) then
    raise exception 'Réservé au propriétaire de la base (superuser) : ce script contourne volontairement les droits clients.';
  end if;
end $$;

begin;

with passenger as (
  select p.id
  from public.profiles p
  where p.id = :'passenger_id'::uuid
    and p.role = 'passenger'
    and p.status = 'active'
),
ride as (
  insert into public.rides (
    passenger_id, pickup_label, pickup_lat, pickup_lng,
    destination_label, destination_lat, destination_lng,
    ride_type, status, dispatch_deadline_at, estimated_price
  )
  select
    passenger.id, :'pickup_label', :'pickup_lat'::double precision, :'pickup_lng'::double precision,
    :'dest_label', :'dest_lat'::double precision, :'dest_lng'::double precision,
    'go', 'searching', now() + interval '120 seconds', null
  from passenger
  returning id, passenger_id
),
history as (
  insert into public.ride_status_history (ride_id, status, actor_id)
  select id, 'requested'::public.taga_ride_status, passenger_id from ride
  union all
  select id, 'searching'::public.taga_ride_status, passenger_id from ride
  returning ride_id
)
select (select count(*) from ride) as rides_created, (select count(*) from history) as history_rows;

commit;
