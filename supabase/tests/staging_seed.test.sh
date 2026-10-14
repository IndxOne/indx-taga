#!/usr/bin/env bash
# Vérifie le dispositif de recette (supabase/staging/seed_test_ride.sql) sur une base JETABLE.
#
# Portée honnête :
#  * le contrôle d'identité/privilèges est exercé avec un rôle NON-superuser qui imite le
#    `postgres` hébergé (NOSUPERUSER, BYPASSRLS, droits explicites) via `expected_admin_role` ;
#  * les cas « postgres par défaut » ne tournent que sous le superuser local : ils ne prouvent
#    PAS la compatibilité avec le projet Supabase hébergé (voir docs/staging-recette.md).
# Usage : PGHOST=... PGUSER=... PGDATABASE=... supabase/tests/staging_seed.test.sh
set -euo pipefail
case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refus : base Supabase distante." >&2; exit 1 ;;
esac

PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1)
SCRIPT=supabase/staging/seed_test_ride.sql
PASSENGER=00000000-0000-0000-0000-00000000ee01
DRIVER=00000000-0000-0000-0000-00000000ee02
SUSPENDED=00000000-0000-0000-0000-00000000ee03
GHOST=00000000-0000-0000-0000-00000000ee99
ADMIN=taga_seed_admin
FN='public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)'
fail() { echo "ÉCHEC: $*" >&2; exit 1; }
sql() { "${PSQL[@]}" -c "$1"; }

cleanup() {
  sql "do \$\$ begin if to_regprocedure('public.create_ride_absente(jsonb,jsonb,public.taga_ride_type,timestamptz)') is not null then alter function public.create_ride_absente(jsonb,jsonb,public.taga_ride_type,timestamptz) rename to create_ride; end if; end \$\$" >/dev/null 2>&1 || true
  sql "drop trigger if exists taga_seed_t1 on public.rides;
       drop trigger if exists taga_seed_t2 on public.ride_status_history;
       drop function if exists public.taga_seed_t1();
       drop function if exists public.taga_seed_t2();
       revoke all on function $FN from public, anon, authenticated;
       delete from public.ride_status_history where actor_id in ('$PASSENGER','$DRIVER','$SUSPENDED');
       delete from public.rides where passenger_id in ('$PASSENGER','$SUSPENDED');
       delete from auth.users where id in ('$PASSENGER','$DRIVER','$SUSPENDED');
       drop owned by taga_seed_admin, taga_seed_noprivs, taga_seed_nohist, taga_seed_noprof, taga_seed_nobypass;
       drop role if exists taga_seed_admin, taga_seed_noprivs, taga_seed_nohist, taga_seed_noprof, taga_seed_nobypass;" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

# --- Fixtures : un passager actif, un chauffeur, un passager suspendu ; rôles de test non-superuser.
sql "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false) is not null;
     insert into auth.users(id) values ('$PASSENGER'),('$DRIVER'),('$SUSPENDED');
     insert into public.profiles(id, phone, role, status) values
       ('$PASSENGER','+2250100000ee1','passenger','active'),
       ('$DRIVER','+2250100000ee2','driver','active'),
       ('$SUSPENDED','+2250100000ee3','passenger','suspended');
     insert into public.driver_profiles(user_id, verification_status, availability_status) values ('$DRIVER','verified','on_ride');
     create role $ADMIN nologin nosuperuser nocreaterole nocreatedb bypassrls;
     create role taga_seed_noprivs nologin nosuperuser bypassrls;
     create role taga_seed_nohist nologin nosuperuser bypassrls;
     create role taga_seed_noprof nologin nosuperuser bypassrls;
     create role taga_seed_nobypass nologin nosuperuser nobypassrls;
     grant select, insert on public.rides, public.ride_status_history to $ADMIN, taga_seed_noprof, taga_seed_nobypass;
     grant select on public.profiles to $ADMIN, taga_seed_nobypass;
     grant select, insert on public.rides to taga_seed_nohist;
     grant select on public.ride_status_history, public.profiles to taga_seed_nohist;" >/dev/null

ARGS=(-v passenger_id="$PASSENGER" -v pickup_label="Point A (test)" -v pickup_lat=5.36 -v pickup_lng=-4.0083
      -v dest_label="Point B (test)" -v dest_lat=5.32 -v dest_lng=-4.02)
# seed "<commande SQL de session>" [options psql...] : exécute le script, ARGS par défaut.
seed() { local pre="$1"; shift; local p=(); [ -n "$pre" ] && p=(-c "$pre"); "${PSQL[@]}" "${p[@]}" "$@" -f "$SCRIPT" 2>&1; }
as_admin() { seed "set session authorization $ADMIN" -v expected_admin_role=$ADMIN "$@"; }
rides() { sql "select count(*) from public.rides where passenger_id in ('$PASSENGER','$SUSPENDED')"; }
hist()  { sql "select count(*) from public.ride_status_history where actor_id in ('$PASSENGER','$DRIVER','$SUSPENDED')"; }
# refuse "libellé" "motif attendu" <commande...> : refus + message + AUCUNE écriture résiduelle.
refuse() {
  local label="$1" pattern="$2" out; shift 2
  if out=$("$@"); then fail "accepté à tort : $label"; fi
  grep -q -- "$pattern" <<<"$out" || fail "$label : message inattendu : $out"
  [ "$(rides)" = 0 ] && [ "$(hist)" = 0 ] || fail "$label : écriture résiduelle"
}

# 1. Absence de confirmation (variable absente, ou valeur différente de « yes »).
refuse "sans confirmation" "confirmation" seed "" "${ARGS[@]}"
refuse "confirmation=no" "confirmation" seed "" -v confirm_isolated_staging=no "${ARGS[@]}"
refuse "confirmation=true" "confirmation" as_admin -v confirm_isolated_staging=true "${ARGS[@]}"
YES=(-v confirm_isolated_staging=yes)

# 2. Rôle non autorisé : clients API, service_role, rôle quelconque, substitution de rôle.
for r in authenticated anon service_role; do
  refuse "rôle $r" "rôle administratif attendu" seed "set session authorization $r" "${YES[@]}" "${ARGS[@]}"
  refuse "rôle $r déclaré attendu" "ne peut pas servir" seed "set session authorization $r" -v expected_admin_role=$r "${YES[@]}" "${ARGS[@]}"
done
refuse "rôle d'admin de test sans override (postgres attendu)" "rôle administratif attendu" \
  seed "set session authorization $ADMIN" "${YES[@]}" "${ARGS[@]}"
refuse "SET ROLE (session ≠ courant)" "rôle administratif attendu" \
  seed "set role $ADMIN" -v expected_admin_role=$ADMIN "${YES[@]}" "${ARGS[@]}"

# 3. Privilèges manquants (rôle correct, non-superuser).
for spec in "taga_seed_noprivs:privilège" "taga_seed_nohist:privilège INSERT manquant sur public.ride_status_history" \
            "taga_seed_noprof:privilège SELECT manquant sur public.profiles" "taga_seed_nobypass:RLS de public"; do
  r=${spec%%:*}
  refuse "privilèges $r" "${spec#*:}" seed "set session authorization $r" -v expected_admin_role=$r "${YES[@]}" "${ARGS[@]}"
done

# 4. Verrou create_ride : refus si un client peut l'exécuter (aucune modification du verrou par le script).
for grantee in authenticated anon public; do
  sql "grant execute on function $FN to $grantee" >/dev/null
  refuse "create_ride exécutable par $grantee" "create_ride est exécutable" as_admin "${YES[@]}" "${ARGS[@]}"
  sql "revoke all on function $FN from public, anon, authenticated" >/dev/null
done

sql "alter function $FN rename to create_ride_absente" >/dev/null
refuse "create_ride absente" "create_ride absente" as_admin "${YES[@]}" "${ARGS[@]}"
sql "alter function public.create_ride_absente(jsonb,jsonb,public.taga_ride_type,timestamptz) rename to create_ride" >/dev/null

# 5. Passager inexistant, suspendu, non passager, identifiant invalide : refus, aucune écriture.
for p in "$GHOST" "$SUSPENDED" "$DRIVER"; do
  refuse "passager $p" "passager de test actif" as_admin "${YES[@]}" "${ARGS[@]}" -v passenger_id="$p"
done
refuse "passager_id non uuid" "uuid" as_admin "${YES[@]}" "${ARGS[@]}" -v passenger_id=pas-un-uuid
refuse "latitude non numérique" "double precision" as_admin "${YES[@]}" "${ARGS[@]}" -v pickup_lat=abc

# 6. Aucune création partielle : anomalie après la 1re écriture => tout est annulé.
sql "create function public.taga_seed_t1() returns trigger language plpgsql as \$f\$
       begin insert into public.ride_status_history(ride_id,status,actor_id) values (new.id,'requested',new.passenger_id); return new; end \$f\$;
     create trigger taga_seed_t1 after insert on public.rides for each row execute function public.taga_seed_t1();" >/dev/null
refuse "historique excédentaire (3 lignes)" "au lieu de 2" as_admin "${YES[@]}" "${ARGS[@]}"
sql "drop trigger taga_seed_t1 on public.rides; drop function public.taga_seed_t1();
     create function public.taga_seed_t1() returns trigger language plpgsql as \$f\$
       begin if new.pickup_label = 'Point A (test)' then
         insert into public.rides(passenger_id,pickup_label,destination_label,ride_type) values (new.passenger_id,'extra','extra','go'); end if; return new; end \$f\$;
     create trigger taga_seed_t1 after insert on public.rides for each row execute function public.taga_seed_t1();" >/dev/null
refuse "course excédentaire (2 courses)" "au lieu d'une" as_admin "${YES[@]}" "${ARGS[@]}"
sql "drop trigger taga_seed_t1 on public.rides; drop function public.taga_seed_t1();
     create function public.taga_seed_t2() returns trigger language plpgsql as \$f\$
       begin if new.status = 'searching' then raise exception 'échec simulé'; end if; return new; end \$f\$;
     create trigger taga_seed_t2 before insert on public.ride_status_history for each row execute function public.taga_seed_t2();" >/dev/null
refuse "échec en cours d'historique (course déjà insérée)" "échec simulé" as_admin "${YES[@]}" "${ARGS[@]}"
sql "drop trigger taga_seed_t2 on public.ride_status_history; drop function public.taga_seed_t2();" >/dev/null

# 7. Injection réussie avec le rôle administratif autorisé (non-superuser) + instantané des objets.
SNAPSHOT="select md5(
  (select coalesce(string_agg(p.oid::regprocedure::text || coalesce(p.proacl::text,''), ',' order by p.oid::regprocedure::text), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')
  || (select coalesce(string_agg(c.relname || coalesce(c.relacl::text,''), ',' order by c.relname), '')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public')
  || (select string_agg(rolname || rolsuper::text || rolbypassrls::text, ',' order by rolname) from pg_roles where rolname !~ '^taga_seed_'))"
BEFORE=$(sql "$SNAPSHOT")
as_admin "${YES[@]}" "${ARGS[@]}" >/dev/null
[ "$(rides)" = "1" ] || fail "course de test non créée (rôle non-superuser)"
RIDE=$(sql "select id from public.rides where passenger_id='$PASSENGER'")
[ "$(sql "select status::text || ',' || pickup_lat || ',' || destination_lng || ',' || coalesce(estimated_price::text,'null') from public.rides where id='$RIDE'")" = "searching,5.36,-4.02,null" ] || fail "contenu de la course de test"
[ "$(sql "select string_agg(status::text, ',' order by status) from public.ride_status_history where ride_id='$RIDE'")" = "requested,searching" ] || fail "historique de la course de test"
[ "$(sql "select (select rolsuper from pg_roles where rolname='$ADMIN')::text")" = "false" ] || fail "le rôle de test doit être non-superuser"

# 8. Rien n'a été créé ni accordé (fonction, rôle, GRANT) et les RPC/données restent protégées.
[ "$(sql "$SNAPSHOT")" = "$BEFORE" ] || fail "fonctions/ACL/rôles modifiés par le script"
[ "$(sql "select has_function_privilege('anon','$FN','EXECUTE') or has_function_privilege('authenticated','$FN','EXECUTE')")" = "f" ] || fail "create_ride exécutable par un client"
grep -v '^ *--' "$SCRIPT" | grep -qiE 'create (or replace )?(function|role|user)|grant |security definer|postgres(ql)?://|password' && fail "le script ne doit créer ni fonction, ni rôle, ni GRANT, ni SECURITY DEFINER, ni secret"
grep -qiE 'set (session authorization|role) service_role' "$SCRIPT" && fail "service_role ne doit jamais servir de contournement"
"${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$PASSENGER',false) is not null;
  select public.create_ride('{\"label\":\"A\",\"lat\":5.3,\"lng\":-4}','{\"label\":\"B\",\"lat\":5.2,\"lng\":-4.1}','go');" >/dev/null 2>&1 \
  && fail "authenticated peut appeler create_ride"
[ "$("${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$DRIVER',false) is not null; select count(*) from public.rides;" | tail -n1)" = "0" ] || fail "un autre compte voit la course de test"
"${PSQL[@]}" -c "set role anon; select count(*) from public.rides;" >/dev/null 2>&1 && fail "anon lit rides"
[ "$(rides)" = "1" ] || fail "tentatives clientes : course de test altérée"

# 9. Compatibilité 011 (scénarios séquentiels S1–S5 : voir 011_concurrency.test.sh) : la course injectée avance.
sql "update public.rides set status='assigned', driver_id='$DRIVER', assigned_at=now() where id='$RIDE'" >/dev/null
step() { "${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$DRIVER',false) is not null; select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false) is not null; select status from public.advance_driver_ride('$RIDE','$1');" | tail -n1; }
[ "$(step arriving)" = "arriving" ] || fail "transition 011 arriving"
[ "$(step arrived)" = "arrived" ] || fail "transition 011 arrived"

# 10. Cas superuser local uniquement (rôle `postgres` par défaut) : NE prouve PAS Supabase hébergé.
sql "delete from public.ride_status_history where ride_id='$RIDE'; delete from public.rides where id='$RIDE'" >/dev/null
if [ "$(sql "select current_user")" = "postgres" ]; then
  seed "" "${YES[@]}" "${ARGS[@]}" >/dev/null
  [ "$(rides)" = "1" ] && [ "$(hist)" = "2" ] || fail "injection en postgres (superuser local)"
  echo "note: cas postgres exécuté sous SUPERUSER local — pas une preuve Supabase hébergé"
else
  echo "note: cas postgres par défaut non exécuté (utilisateur local ≠ postgres)"
fi

echo "OK staging_seed"
