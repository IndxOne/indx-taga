-- DISPOSITIF DE RECETTE — NON une migration. Script `psql` uniquement.
--
-- Depuis 012, aucun client authentifié ne peut créer de course (create_ride est
-- révoquée). Pour recetter dispatch, transitions 011 et récapitulatif, UNE course
-- de test est insérée directement par l'administrateur du projet de RECETTE.
--
-- Ce fichier utilise les méta-commandes psql (\set, \if, \gset) : il N'EST PAS
-- exécutable tel quel dans le SQL Editor de Supabase. Procédure humaine complète :
-- docs/staging-recette.md.
--
-- Garanties (toutes vérifiées AVANT la première écriture) :
--  * confirmation explicite `confirm_isolated_staging=yes` ; elle est déclarative
--    et NE PROUVE PAS que la base est isolée : l'identification du projet cible
--    reste une vérification humaine (docs/staging-recette.md) ;
--  * session ET rôle courant = rôle administratif attendu (`postgres`) ; anon,
--    authenticated, service_role, authenticator sont refusés, même si on les
--    désigne comme « attendus » ;
--  * privilèges réels contrôlés (INSERT/SELECT sur les tables touchées, contournement
--    de RLS par droit propre) — jamais de rolsuper, que le `postgres` hébergé n'a pas ;
--  * create_ride doit rester verrouillée (012 appliquée) ; le script ne la modifie pas ;
--  * passager de test actif obligatoire ;
--  * transaction unique : exactement 1 course et 2 lignes d'historique, sinon rien.
-- Il ne crée AUCUNE fonction, AUCUN rôle, AUCUN GRANT, AUCUNE RPC, et ne manipule
-- aucun secret ni paramètre de connexion.
--
-- Usage (la connexion vient de l'environnement/psql, jamais écrite ici) :
--   psql -v confirm_isolated_staging=yes \
--        -v passenger_id=<uuid du passager de test> \
--        -v pickup_label="Point A (test)" -v pickup_lat=5.3600 -v pickup_lng=-4.0083 \
--        -v dest_label="Point B (test)"   -v dest_lat=5.3200  -v dest_lng=-4.0200 \
--        -f supabase/staging/seed_test_ride.sql
--
-- `expected_admin_role` (défaut : postgres) n'existe que pour les tests locaux sur
-- une base jetable ; ne jamais le définir sur Supabase.
-- La course est créée en `searching` ; les coordonnées sont des valeurs de TEST.

\set ON_ERROR_STOP on

\if :{?confirm_isolated_staging}
\else
  \set confirm_isolated_staging no
\endif
\if :{?expected_admin_role}
\else
  \set expected_admin_role postgres
\endif

select (:'confirm_isolated_staging' = 'yes') as confirmed \gset
\if :confirmed
\else
  \echo 'Refus : définir -v confirm_isolated_staging=yes uniquement sur un environnement de recette isolé.'
  do $$ begin raise exception 'Refus : confirmation d''environnement de recette isolé absente.'; end $$;
\endif

begin;

-- Paramètres transmis au bloc ci-dessous (portée transaction, rien n'est persisté).
select set_config('taga_seed.admin_role', :'expected_admin_role', true) as s1,
       set_config('taga_seed.passenger_id', :'passenger_id', true) as s2,
       set_config('taga_seed.pickup_label', :'pickup_label', true) as s3,
       set_config('taga_seed.pickup_lat', :'pickup_lat', true) as s4,
       set_config('taga_seed.pickup_lng', :'pickup_lng', true) as s5,
       set_config('taga_seed.dest_label', :'dest_label', true) as s6,
       set_config('taga_seed.dest_lat', :'dest_lat', true) as s7,
       set_config('taga_seed.dest_lng', :'dest_lng', true) as s8 \gset

do $$
declare
  admin_role text := current_setting('taga_seed.admin_role');
  create_ride_fn regprocedure := to_regprocedure('public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)');
  tbl text;
  priv text;
  rel record;
  role_bypass boolean;
  new_ride uuid;
  passenger uuid;
  rides_before bigint;
  rides_after bigint;
  history_rows bigint;
begin
  -- 1. Identité : rôle administratif attendu, sans substitution de session.
  if admin_role in ('anon', 'authenticated', 'service_role', 'authenticator') then
    raise exception 'Refus : le rôle % ne peut pas servir d''administrateur de recette.', admin_role;
  end if;
  if session_user <> admin_role or current_user <> admin_role then
    raise exception 'Refus : rôle administratif attendu "%", session "%", courant "%".',
      admin_role, session_user, current_user;
  end if;

  -- 2. Privilèges réellement nécessaires (aucun test de rolsuper).
  foreach tbl in array array['rides', 'ride_status_history'] loop
    foreach priv in array array['INSERT', 'SELECT'] loop
      if not has_table_privilege(current_user, format('public.%I', tbl), priv) then
        raise exception 'Refus : privilège % manquant sur public.%.', priv, tbl;
      end if;
    end loop;
  end loop;
  if not has_table_privilege(current_user, 'public.profiles', 'SELECT') then
    raise exception 'Refus : privilège SELECT manquant sur public.profiles.';
  end if;

  select rolbypassrls into role_bypass from pg_roles where rolname = current_user;
  for rel in
    select c.relname, c.relrowsecurity, c.relforcerowsecurity,
           pg_has_role(current_user, c.relowner, 'USAGE') as is_owner
    from pg_class c
    where c.oid in ('public.rides'::regclass, 'public.ride_status_history'::regclass, 'public.profiles'::regclass)
  loop
    -- RLS actif : il faut BYPASSRLS, ou être propriétaire si RLS n'est pas forcé.
    if rel.relrowsecurity and not (role_bypass or (rel.is_owner and not rel.relforcerowsecurity)) then
      raise exception 'Refus : RLS de public.% non contournable par %.', rel.relname, current_user;
    end if;
  end loop;

  -- 3. Le verrou client de create_ride (012) doit être en place ; il n'est jamais modifié ici.
  if create_ride_fn is null then
    raise exception 'Refus : public.create_ride absente (migrations 001-012 non appliquées ?).';
  end if;
  -- anon et authenticated héritent de PUBLIC : has_function_privilege couvre aussi PUBLIC.
  if exists (
       select 1 from pg_roles r
       where r.rolname in ('anon', 'authenticated')
         and has_function_privilege(r.oid, create_ride_fn, 'EXECUTE')
     ) then
    raise exception 'Refus : create_ride est exécutable par un client (012 absente ou annulée).';
  end if;

  -- 4. Passager de test actif obligatoire.
  select p.id into passenger
  from public.profiles p
  where p.id = current_setting('taga_seed.passenger_id')::uuid
    and p.role = 'passenger' and p.status = 'active';
  if passenger is null then
    raise exception 'Refus : aucun passager de test actif pour cet identifiant.';
  end if;

  select count(*) into rides_before from public.rides where passenger_id = passenger;

  -- 5. Première écriture : exactement 1 course + 2 lignes d'historique, sinon annulation totale.
  insert into public.rides (
    passenger_id, pickup_label, pickup_lat, pickup_lng,
    destination_label, destination_lat, destination_lng,
    ride_type, status, dispatch_deadline_at, estimated_price
  ) values (
    passenger,
    current_setting('taga_seed.pickup_label'),
    current_setting('taga_seed.pickup_lat')::double precision,
    current_setting('taga_seed.pickup_lng')::double precision,
    current_setting('taga_seed.dest_label'),
    current_setting('taga_seed.dest_lat')::double precision,
    current_setting('taga_seed.dest_lng')::double precision,
    'go', 'searching', now() + interval '120 seconds', null
  ) returning id into new_ride;
  select count(*) into rides_after from public.rides where passenger_id = passenger;
  if rides_after - rides_before <> 1 then
    raise exception 'Annulation : % course(s) créée(s) au lieu d''une.', rides_after - rides_before;
  end if;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (new_ride, 'requested', passenger), (new_ride, 'searching', passenger);

  select count(*) into history_rows from public.ride_status_history where ride_id = new_ride;
  if history_rows <> 2 then
    raise exception 'Annulation : % ligne(s) d''historique au lieu de 2.', history_rows;
  end if;

  raise notice 'Course de test créée : % (1 course, 2 lignes d''historique)', new_ride;
end $$;

commit;
