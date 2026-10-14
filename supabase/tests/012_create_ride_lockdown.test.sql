-- Test local de 012_create_ride_lockdown.sql (non appliquée en distant).
-- Prérequis : migrations 001 à 012 sur une base JETABLE (voir run-local.sh).
-- Tout est annulé en fin de script (rollback).
--
-- Deux niveaux testés séparément :
--  * ACL  : les clients (public, anon, authenticated) ne peuvent plus exécuter
--           create_ride ni la fonction interne de validation ;
--  * corps : la validation des points reste exacte, vérifiée en appelant la
--           fonction avec le rôle propriétaire (qui conserve EXECUTE).

begin;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000b3');
insert into public.profiles(id, phone, role, status) values
  ('00000000-0000-0000-0000-0000000000b1', '+2250100000011', 'passenger', 'active'),
  ('00000000-0000-0000-0000-0000000000b2', '+2250100000012', 'driver', 'active'),
  ('00000000-0000-0000-0000-0000000000b3', '+2250100000013', 'passenger', 'suspended');

create temp table baseline as
  select (select count(*) from public.rides) as rides,
         (select count(*) from public.ride_status_history) as history;

create schema test_h;
grant usage on schema test_h to authenticated, anon;

create function test_h.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', uid)::text, true);
end $$;

create function test_h.expect_error(sql text, expected_code text) returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute sql;
    actual := 'no_error';
  exception when others then
    actual := sqlstate;
  end;
  if actual is distinct from expected_code then
    raise exception 'attendu % obtenu % pour: %', expected_code, actual, left(sql, 200);
  end if;
end $$;
grant execute on function test_h.as_user(text), test_h.expect_error(text, text) to authenticated, anon;

create function test_h.assert_unchanged() returns void language plpgsql as $$
begin
  assert (select count(*) from public.rides) = (select rides from baseline), 'une course a été créée malgré le refus';
  assert (select count(*) from public.ride_status_history) = (select history from baseline), 'un historique a été créé malgré le refus';
end $$;

-- ---------------------------------------------------------------------------
-- 0. Réexécution contrôlée de la migration 012 : idempotente, sans changer l'ACL.
-- ---------------------------------------------------------------------------
create temp table acl_before as
  select proname::text as fn, coalesce(proacl::text, '') as acl
  from pg_proc
  where oid in (
    'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)'::regprocedure,
    'public.taga_normalize_ride_point(jsonb,text)'::regprocedure
  );

\ir ../migrations/012_create_ride_lockdown.sql

do $$
begin
  assert (
    select count(*) from pg_proc p
    join acl_before b on b.fn = p.proname::text
    where coalesce(p.proacl::text, '') = b.acl
  ) = 2, 'la réexécution de 012 a modifié les ACL';
end $$;

-- ---------------------------------------------------------------------------
-- 1. ACL : aucun client (PUBLIC, anon, authenticated) n'a EXECUTE.
-- ---------------------------------------------------------------------------
do $$
declare
  fn regprocedure;
begin
  foreach fn in array array[
    'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)'::regprocedure,
    'public.taga_normalize_ride_point(jsonb,text)'::regprocedure
  ] loop
    assert not exists (
      select 1
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = fn
        and a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid))
    ), format('EXECUTE encore accordé à un client sur %s', fn);
    assert not has_function_privilege('anon', fn, 'execute'), 'anon peut exécuter';
    assert not has_function_privilege('authenticated', fn, 'execute'), 'authenticated peut exécuter';
  end loop;
end $$;

-- La fonction reste SECURITY DEFINER avec un search_path vide.
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)'::regprocedure), 'create_ride doit rester SECURITY DEFINER';
  assert exists (
    select 1 from pg_proc p, unnest(p.proconfig) as setting
    where p.oid = 'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)'::regprocedure
      and setting = 'search_path=""'
  ), 'search_path vide requis';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Appels directs depuis les rôles clients : refusés, rien n'est créé.
-- ---------------------------------------------------------------------------
set local role authenticated;
select test_h.as_user('00000000-0000-0000-0000-0000000000b1');
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');
select test_h.expect_error($$select public.taga_normalize_ride_point('{"label":"A","lat":5.3,"lng":-4.0}', 'x')$$, '42501');
-- Même un appel invalide est refusé au niveau des privilèges (pas d'oracle de validation).
select test_h.expect_error($$select public.create_ride('{}', '{}', 'go')$$, '42501');
-- Écriture directe toujours interdite.
select test_h.expect_error($$insert into public.rides(passenger_id, pickup_label, destination_label, ride_type) values ('00000000-0000-0000-0000-0000000000b1','A','B','go')$$, '42501');
-- Un chauffeur n'a pas plus de droits.
select test_h.as_user('00000000-0000-0000-0000-0000000000b2');
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');

reset role;
set local role anon;
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');
reset role;
select test_h.assert_unchanged();

-- ---------------------------------------------------------------------------
-- 3. Corps de la fonction (rôle propriétaire + claims) : validation stricte.
-- ---------------------------------------------------------------------------
select test_h.as_user('00000000-0000-0000-0000-0000000000b1');

-- 3a. Session / rôle inchangés (vérifiés AVANT les points).
select set_config('request.jwt.claim.sub', '', true);
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '28000');
select test_h.as_user('00000000-0000-0000-0000-0000000000b2');
select test_h.expect_error($$select public.create_ride('{}', '{}', 'go')$$, '42501');
select test_h.as_user('00000000-0000-0000-0000-0000000000b3');
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');
select test_h.as_user('00000000-0000-0000-0000-0000000000b1');

-- 3b. Points invalides : 22023, aucune course, aucun historique.
create temp table invalid_points(name text, point text);
insert into invalid_points values
  ('point null', 'null'),
  ('point tableau', '[]'),
  ('point chaîne', '"A"'),
  ('point nombre', '5'),
  ('objet vide', '{}'),
  ('lat absente', '{"label":"A","lng":-4.0}'),
  ('lng absente', '{"label":"A","lat":5.3}'),
  ('lat null', '{"label":"A","lat":null,"lng":-4.0}'),
  ('lng null', '{"label":"A","lat":5.3,"lng":null}'),
  ('lat chaîne numérique', '{"label":"A","lat":"5.3","lng":-4.0}'),
  ('lng chaîne numérique', '{"label":"A","lat":5.3,"lng":"-4.0"}'),
  ('lat « NaN »', '{"label":"A","lat":"NaN","lng":-4.0}'),
  ('lng « Infinity »', '{"label":"A","lat":5.3,"lng":"Infinity"}'),
  ('lat « -Infinity »', '{"label":"A","lat":"-Infinity","lng":-4.0}'),
  ('lat booléen', '{"label":"A","lat":true,"lng":-4.0}'),
  ('lng objet', '{"label":"A","lat":5.3,"lng":{}}'),
  ('lat tableau', '{"label":"A","lat":[5.3],"lng":-4.0}'),
  ('lat > 90', '{"label":"A","lat":90.0001,"lng":-4.0}'),
  ('lat < -90', '{"label":"A","lat":-90.0001,"lng":-4.0}'),
  ('lng > 180', '{"label":"A","lat":5.3,"lng":180.0001}'),
  ('lng < -180', '{"label":"A","lat":5.3,"lng":-180.0001}'),
  ('lat démesurée (1e400)', '{"label":"A","lat":1e400,"lng":-4.0}'),
  ('lng démesurée (-1e400)', '{"label":"A","lat":5.3,"lng":-1e400}'),
  ('(0,0)', '{"label":"A","lat":0,"lng":0}'),
  ('(0.0,0.0)', '{"label":"A","lat":0.0,"lng":0.0}'),
  ('(-0,0)', '{"label":"A","lat":-0,"lng":0}'),
  ('libellé absent', '{"lat":5.3,"lng":-4.0}'),
  ('libellé vide', '{"label":"   ","lat":5.3,"lng":-4.0}'),
  ('libellé nombre', '{"label":5,"lat":5.3,"lng":-4.0}'),
  ('libellé null', '{"label":null,"lat":5.3,"lng":-4.0}');

do $$
declare
  r record;
  valid constant text := '{"label":"B","lat":5.2,"lng":-4.1}';
begin
  for r in select * from invalid_points loop
    -- invalide en départ
    perform test_h.expect_error(format('select public.create_ride(%L::jsonb, %L::jsonb, ''go'')', r.point, valid), '22023');
    -- invalide en destination
    perform test_h.expect_error(format('select public.create_ride(%L::jsonb, %L::jsonb, ''go'')', valid, r.point), '22023');
  end loop;
  -- libellé de 241 caractères
  perform test_h.expect_error(format('select public.create_ride(%L::jsonb, %L::jsonb, ''go'')', json_build_object('label', repeat('x', 241), 'lat', 5.3, 'lng', -4.0)::text, valid), '22023');
  -- points SQL NULL
  perform test_h.expect_error($sql$select public.create_ride(null, '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$sql$, '22023');
  perform test_h.expect_error($sql$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', null, 'go')$sql$, '22023');
end $$;
select test_h.assert_unchanged();

-- 3c. Points valides aux limites : acceptés par le corps (équateur, méridien, pôles, date changement).
do $$
declare
  extremes text[] := array[
    '{"label":"A","lat":0,"lng":5.3}',
    '{"label":"A","lat":5.3,"lng":0}',
    '{"label":"A","lat":90,"lng":180}',
    '{"label":"A","lat":-90,"lng":-180}',
    '{"label":"  A  ","lat":5.345678,"lng":-4.012345}'
  ];
  p text;
  r public.rides;
  n int := 0;
begin
  foreach p in array extremes loop
    r := public.create_ride(p::jsonb, '{"label":"B","lat":5.2,"lng":-4.1}'::jsonb, 'go');
    n := n + 1;
    assert r.passenger_id = '00000000-0000-0000-0000-0000000000b1', 'identité = auth.uid()';
    assert r.status = 'requested' and r.estimated_price is null, 'statut et prix forcés côté serveur';
    assert r.pickup_label = btrim((p::jsonb)->>'label'), 'libellé normalisé';
    assert r.pickup_lat = ((p::jsonb)->>'lat')::double precision and r.pickup_lng = ((p::jsonb)->>'lng')::double precision, 'coordonnées conservées';
    assert (select count(*) from public.ride_status_history where ride_id = r.id and status = 'requested' and actor_id = r.passenger_id) = 1, 'historique requested';
  end loop;
  assert (select count(*) from public.rides) = (select rides from baseline) + n, 'courses valides non créées';
end $$;

-- Champs d'autorité injectés dans le point : ignorés (ni identité, ni statut, ni prix).
do $$
declare r public.rides;
begin
  r := public.create_ride(
    '{"label":"A","lat":5.3,"lng":-4.0,"passenger_id":"00000000-0000-0000-0000-0000000000b2","status":"completed","estimated_price":1,"source":"device_gps"}'::jsonb,
    '{"label":"B","lat":5.2,"lng":-4.1}'::jsonb, 'go');
  assert r.passenger_id = '00000000-0000-0000-0000-0000000000b1' and r.status = 'requested' and r.estimated_price is null, 'champs injectés pris en compte';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Réactivation (réversible) : un GRANT explicite rouvrirait la RPC, validation incluse.
--    Simulé dans la transaction, annulé au rollback.
-- ---------------------------------------------------------------------------
grant execute on function public.create_ride(jsonb, jsonb, public.taga_ride_type, timestamptz) to authenticated;
set local role authenticated;
select test_h.as_user('00000000-0000-0000-0000-0000000000b1');
do $$
declare r public.rides;
begin
  r := public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}'::jsonb, '{"label":"B","lat":5.2,"lng":-4.1}'::jsonb, 'go');
  assert r.passenger_id = '00000000-0000-0000-0000-0000000000b1', 'identité après réactivation';
end $$;
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '22023');
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":0,"lng":0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '22023');
-- La fonction interne reste inaccessible même après réactivation de create_ride.
select test_h.expect_error($$select public.taga_normalize_ride_point('{"label":"A","lat":5.3,"lng":-4.0}', 'x')$$, '42501');
select test_h.as_user('00000000-0000-0000-0000-0000000000b2');
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');
reset role;
set local role anon;
select test_h.expect_error($$select public.create_ride('{"label":"A","lat":5.3,"lng":-4.0}', '{"label":"B","lat":5.2,"lng":-4.1}', 'go')$$, '42501');
reset role;

rollback;
select 'OK 012_create_ride_lockdown' as result;
