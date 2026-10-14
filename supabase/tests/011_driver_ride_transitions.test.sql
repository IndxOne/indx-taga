-- Test local de 011_driver_ride_transitions.sql (non appliqué en distant).
-- Exécution sur une base jetable après les migrations 001 à 011 :
--   psql -v ON_ERROR_STOP=1 -d <base_jetable> -f supabase/tests/011_driver_ride_transitions.test.sql
-- Nécessite les rôles anon/authenticated/service_role et auth.uid()/auth.jwt()
-- (fournis par Supabase, ou par un bootstrap minimal en local).
-- Tout est annulé en fin de script (rollback).

begin;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2');
insert into public.profiles(id, phone, role) values
  ('00000000-0000-0000-0000-0000000000a1', '+2250100000001', 'passenger'),
  ('00000000-0000-0000-0000-0000000000d1', '+2250100000002', 'driver'),
  ('00000000-0000-0000-0000-0000000000d2', '+2250100000003', 'driver');
insert into public.driver_profiles(user_id, verification_status, availability_status) values
  ('00000000-0000-0000-0000-0000000000d1', 'verified', 'on_ride'),
  ('00000000-0000-0000-0000-0000000000d2', 'verified', 'available');
insert into public.rides(id, passenger_id, pickup_label, destination_label, ride_type, status, driver_id, assigned_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', 'A', 'B', 'go', 'assigned',
   '00000000-0000-0000-0000-0000000000d1', now()),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a1', 'A', 'B', 'go', 'searching', null, null);

create schema test_h;
grant usage on schema test_h to authenticated;

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
    raise exception 'attendu % obtenu % pour: %', expected_code, actual, sql;
  end if;
end $$;

set local role authenticated;

-- 1. Sans session : refus 28000.
select set_config('request.jwt.claim.sub', '', true);
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving')$$, '28000');

-- 2. Passager et autre chauffeur : introuvable (42501).
select test_h.as_user('00000000-0000-0000-0000-0000000000a1');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving')$$, '42501');
select test_h.as_user('00000000-0000-0000-0000-0000000000d2');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving')$$, '42501');
-- Course non affectée (searching) : introuvable pour tout chauffeur.
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f002', 'arriving')$$, '42501');

-- 3. Chauffeur affecté : transitions illégales et cibles interdites.
select test_h.as_user('00000000-0000-0000-0000-0000000000d1');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'in_progress')$$, '55000');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'completed')$$, '55000');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'cancelled')$$, '22023');
select test_h.expect_error($$select public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'assigned')$$, '22023');

-- 4. Écriture directe toujours interdite au client.
select test_h.expect_error($$update public.rides set status = 'completed'$$, '42501');

-- 5. Chaîne complète, idempotence, historique atomique.
do $$
declare r public.rides; n int;
begin
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving');
  assert r.status = 'arriving', 'arriving';
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving');
  assert r.status = 'arriving', 'idempotent arriving';
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arrived');
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'in_progress');
  assert r.status = 'in_progress', 'in_progress';
  -- Retour arrière interdit.
  begin
    perform public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arrived');
    assert false, 'retour arrière accepté';
  exception when sqlstate '55000' then null;
  end;
  -- Chauffeur toujours en course avant la fin.
  assert (select availability_status from public.driver_profiles where user_id = '00000000-0000-0000-0000-0000000000d1') = 'on_ride', 'toujours on_ride';
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'completed');
  assert r.status = 'completed', 'completed';
  r := public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'completed');
  assert r.status = 'completed', 'idempotent completed';
  -- Terminal : plus aucune transition.
  begin
    perform public.advance_driver_ride('00000000-0000-0000-0000-00000000f001', 'arriving');
    assert false, 'transition après completed acceptée';
  exception when sqlstate '55000' then null;
  end;
  select count(*) into n from public.ride_status_history where ride_id = '00000000-0000-0000-0000-00000000f001';
  assert n = 4, format('historique attendu 4 lignes, obtenu %s', n);
  assert (select array_agg(status::text order by created_at, status) from public.ride_status_history where ride_id = '00000000-0000-0000-0000-00000000f001') is not null;
end $$;

-- 6. Libération du chauffeur après la fin (lecture hors RLS via rôle propriétaire).
reset role;
do $$
declare a text; s timestamptz;
begin
  select availability_status, available_since into a, s from public.driver_profiles where user_id = '00000000-0000-0000-0000-0000000000d1';
  assert a = 'offline' and s is null, format('chauffeur non libéré: %s', a);
  assert (select availability_status from public.driver_profiles where user_id = '00000000-0000-0000-0000-0000000000d2') = 'available', 'autre chauffeur inchangé';
end $$;

-- 7. Pas de libération tant qu'une autre course active existe pour le même chauffeur.
update public.driver_profiles set availability_status = 'on_ride' where user_id = '00000000-0000-0000-0000-0000000000d1';
insert into public.rides(id, passenger_id, pickup_label, destination_label, ride_type, status, driver_id, assigned_at) values
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000a1', 'A', 'B', 'go', 'in_progress', '00000000-0000-0000-0000-0000000000d1', now()),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-0000000000a1', 'A', 'B', 'go', 'assigned', '00000000-0000-0000-0000-0000000000d1', now());
set local role authenticated;
select test_h.as_user('00000000-0000-0000-0000-0000000000d1');
select public.advance_driver_ride('00000000-0000-0000-0000-00000000f003', 'completed');
reset role;
do $$
begin
  assert (select availability_status from public.driver_profiles where user_id = '00000000-0000-0000-0000-0000000000d1') = 'on_ride', 'libéré malgré une autre course active';
end $$;

rollback;
select 'OK 011_driver_ride_transitions' as result;
