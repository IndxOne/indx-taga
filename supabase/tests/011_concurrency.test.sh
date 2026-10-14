#!/usr/bin/env bash
# Tests de concurrence de 011_driver_ride_transitions.sql sur une base JETABLE.
# Plusieurs sessions psql réelles se disputent la même course ; la session A
# garde le verrou de ligne (pg_sleep dans sa transaction) pour que les autres
# chevauchent VRAIMENT. Ce n'est PAS un test d'idempotence séquentielle.
# Ne prouve rien sur Supabase (RLS, PostgREST, Realtime) : voir staging.
# Usage : PGHOST=... PGUSER=... PGDATABASE=... supabase/tests/011_concurrency.test.sh
set -euo pipefail

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refus : base Supabase distante." >&2; exit 1 ;;
esac

PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1)
HOLD_SECONDS=2
MIN_BLOCKED_MS=1000
TMP="$(mktemp -d)"

PASSENGER=00000000-0000-0000-0000-00000000cc01
DRIVER=00000000-0000-0000-0000-00000000cc02
OTHER_DRIVER=00000000-0000-0000-0000-00000000cc03

fail() { echo "ÉCHEC: $*" >&2; exit 1; }
sql() { "${PSQL[@]}" -c "$1"; }

cleanup() {
  sql "delete from public.ride_status_history where ride_id::text like '00000000-0000-0000-0000-00000000cc%';
       delete from public.rides where id::text like '00000000-0000-0000-0000-00000000cc%';
       delete from auth.users where id::text like '00000000-0000-0000-0000-00000000cc%';
       drop schema if exists conc_h cascade;" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# Première ligne seulement, sans fermer le tube (un SIGPIPE annulerait la transaction de A).
first_line() { printf '%s\n' "${1%%$'\n'*}"; }

# Contexte d'un chauffeur authentifié (rôle authenticated + claims), puis requête.
as_driver() { # $1 = uuid, $2 = sql
  "${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false) is not null; select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false) is not null; $2" | tail -n +3
}

seed() {
  sql "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false) is not null;
       insert into auth.users(id) values ('$PASSENGER'),('$DRIVER'),('$OTHER_DRIVER');
       insert into public.profiles(id, phone, role) values
         ('$PASSENGER','+2250100000cc1','passenger'),('$DRIVER','+2250100000cc2','driver'),('$OTHER_DRIVER','+2250100000cc3','driver');
       insert into public.driver_profiles(user_id, verification_status, availability_status) values
         ('$DRIVER','verified','on_ride'),('$OTHER_DRIVER','verified','available');
       create schema conc_h;
       grant usage on schema conc_h to authenticated;
       create function conc_h.try_advance(r uuid, s public.taga_ride_status) returns text language plpgsql as \$f\$
       begin return (public.advance_driver_ride(r, s)).status::text;
       exception when others then return 'ERR:' || sqlstate; end \$f\$;" >/dev/null
}

new_ride() { # $1 = suffix, $2 = status
  sql "insert into public.rides(id, passenger_id, pickup_label, destination_label, ride_type, status, driver_id, assigned_at)
       values ('00000000-0000-0000-0000-00000000cc$1','$PASSENGER','A','B','go','$2','$DRIVER', now());" >/dev/null
}

ride_status() { sql "select status from public.rides where id = '00000000-0000-0000-0000-00000000cc$1'"; }
history() { sql "select coalesce(string_agg(status::text, ',' order by created_at, status), '') from public.ride_status_history where ride_id = '00000000-0000-0000-0000-00000000cc$1'"; }
now_ms() { echo $(( $(date +%s%N) / 1000000 )); }

# Lance la session A (garde le verrou) puis des sessions concurrentes ; chaque
# session écrit « résultat durée_ms » dans $TMP/<nom>.
hold_session() { # $1 ride suffix, $2 target status
  ( out=$(as_driver "$DRIVER" "begin; select conc_h.try_advance('00000000-0000-0000-0000-00000000cc$1','$2'); select pg_sleep($HOLD_SECONDS); commit;"); first_line "$out" > "$TMP/A" ) &
}
racer() { # $1 name, $2 ride suffix, $3 target status
  (
    start=$(now_ms)
    result=$(first_line "$(as_driver "$DRIVER" "select conc_h.try_advance('00000000-0000-0000-0000-00000000cc$2','$3');")")
    echo "$result $(( $(now_ms) - start ))" > "$TMP/$1"
  ) &
}
assert_blocked() { # $1 name : la session a réellement attendu le verrou
  read -r _result duration < "$TMP/$1"
  [ "$duration" -ge "$MIN_BLOCKED_MS" ] || fail "$1 n'a pas attendu le verrou (${duration} ms < ${MIN_BLOCKED_MS} ms)"
}
result_of() { read -r result _ < "$TMP/$1"; echo "$result"; }

seed

echo "S1 — 4 sessions concurrentes sur la même transition arriving -> arrived"
new_ride 01 arriving
hold_session 01 arrived
sleep 0.5
for n in B C D E; do racer "$n" 01 arrived; done
wait
[ "$(cat "$TMP/A")" = "arrived" ] || fail "S1 A=$(cat "$TMP/A")"
for n in B C D E; do
  [ "$(result_of $n)" = "arrived" ] || fail "S1 $n=$(result_of $n)"
  assert_blocked "$n"
done
[ "$(history 01)" = "arrived" ] || fail "S1 historique=$(history 01) (attendu: une seule ligne)"
[ "$(ride_status 01)" = "arrived" ] || fail "S1 statut=$(ride_status 01)"

echo "S2 — cibles conflictuelles : arrived (A) puis in_progress (B) : ordre sérialisé valide"
new_ride 02 arriving
hold_session 02 arrived
sleep 0.5
racer B 02 in_progress
wait
[ "$(cat "$TMP/A")" = "arrived" ] || fail "S2 A=$(cat "$TMP/A")"
[ "$(result_of B)" = "in_progress" ] || fail "S2 B=$(result_of B)"
assert_blocked B
[ "$(history 02)" = "arrived,in_progress" ] || fail "S2 historique=$(history 02)"

echo "S3 — cible illégale concurrente : completed (B) demandé pendant que A passe à arrived"
new_ride 03 arriving
hold_session 03 arrived
sleep 0.5
racer B 03 completed
wait
[ "$(result_of B)" = "ERR:55000" ] || fail "S3 B=$(result_of B) (attendu ERR:55000)"
assert_blocked B
[ "$(ride_status 03)" = "arrived" ] || fail "S3 statut=$(ride_status 03)"
[ "$(history 03)" = "arrived" ] || fail "S3 historique=$(history 03)"

echo "S4 — un autre chauffeur concurrent ne peut pas agir sur la course"
new_ride 04 arriving
hold_session 04 arrived
sleep 0.5
( first_line "$(as_driver "$OTHER_DRIVER" "select conc_h.try_advance('00000000-0000-0000-0000-00000000cc04','in_progress');")" > "$TMP/O" ) &
wait
[ "$(cat "$TMP/O")" = "ERR:42501" ] || fail "S4 autre chauffeur=$(cat "$TMP/O")"
[ "$(history 04)" = "arrived" ] || fail "S4 historique=$(history 04)"

echo "S5 — fin de course (A) concurrente à une mise hors ligne (B) : pas de blocage mutuel, état final cohérent"
# Les courses S1-S4 sont encore actives pour ce chauffeur (et le gardent donc « on_ride » : règle
# testée en SQL) ; on les clôture hors RPC pour isoler S5.
sql "update public.rides set status='completed' where id::text like '00000000-0000-0000-0000-00000000cc0%' and id::text <> '00000000-0000-0000-0000-00000000cc05'" >/dev/null
new_ride 05 in_progress
sql "update public.driver_profiles set availability_status='on_ride' where user_id='$DRIVER'" >/dev/null
hold_session 05 completed
sleep 0.5
( start=$(now_ms)
  first_line "$(as_driver "$DRIVER" "select availability_status from public.set_driver_availability(false);")" > "$TMP/B"
  echo $(( $(now_ms) - start )) > "$TMP/Bms" ) &
wait
[ "$(cat "$TMP/A")" = "completed" ] || fail "S5 A=$(cat "$TMP/A")"
[ "$(cat "$TMP/B")" = "offline" ] || fail "S5 B=$(cat "$TMP/B")"
[ "$(cat "$TMP/Bms")" -ge "$MIN_BLOCKED_MS" ] || fail "S5 B n'a pas attendu le verrou de profil"
[ "$(history 05)" = "completed" ] || fail "S5 historique=$(history 05)"
[ "$(sql "select availability_status from public.driver_profiles where user_id='$DRIVER'")" = "offline" ] || fail "S5 chauffeur non libéré"

echo "OK 011_concurrency"
