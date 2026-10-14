#!/usr/bin/env bash
# Vérifie le dispositif de recette isolé (supabase/staging/seed_test_ride.sql) sur une base JETABLE :
# il fonctionne pour le propriétaire, refuse sans confirmation, ne crée aucune fonction ni GRANT
# joignable par un client, et la course injectée suit ensuite les transitions 011.
set -euo pipefail
case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refus : base Supabase distante." >&2; exit 1 ;;
esac

PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1)
PASSENGER=00000000-0000-0000-0000-00000000ee01
DRIVER=00000000-0000-0000-0000-00000000ee02
fail() { echo "ÉCHEC: $*" >&2; exit 1; }
sql() { "${PSQL[@]}" -c "$1"; }
cleanup() {
  sql "delete from public.ride_status_history where actor_id in ('$PASSENGER','$DRIVER');
       delete from public.rides where passenger_id = '$PASSENGER';
       delete from auth.users where id in ('$PASSENGER','$DRIVER');" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sql "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false) is not null;
     insert into auth.users(id) values ('$PASSENGER'),('$DRIVER');
     insert into public.profiles(id, phone, role) values ('$PASSENGER','+2250100000ee1','passenger'),('$DRIVER','+2250100000ee2','driver');
     insert into public.driver_profiles(user_id, verification_status, availability_status) values ('$DRIVER','verified','on_ride');" >/dev/null

SEED=(-f supabase/staging/seed_test_ride.sql -v passenger_id="$PASSENGER"
  -v pickup_label="Point A (test)" -v pickup_lat=5.36 -v pickup_lng=-4.0083
  -v dest_label="Point B (test)" -v dest_lat=5.32 -v dest_lng=-4.02)
count() { sql "select count(*) from public.rides where passenger_id = '$PASSENGER'"; }

# 1. Sans confirmation explicite : refus, aucune course.
"${PSQL[@]}" -v confirm_isolated_staging=no "${SEED[@]}" >/dev/null 2>&1 && fail "seed accepté sans confirmation"
[ "$(count)" = "0" ] || fail "course créée sans confirmation"

# 2. Passager inexistant / non éligible : aucune course (rien d'inventé).
"${PSQL[@]}" -v confirm_isolated_staging=yes -f supabase/staging/seed_test_ride.sql -v passenger_id="$DRIVER" \
  -v pickup_label=A -v pickup_lat=5.3 -v pickup_lng=-4 -v dest_label=B -v dest_lat=5.2 -v dest_lng=-4.1 >/dev/null
[ "$(count)" = "0" ] || fail "course créée pour un non-passager"

# 3. Propriétaire + confirmation : une course `searching` avec coordonnées et 2 lignes d'historique.
"${PSQL[@]}" -v confirm_isolated_staging=yes "${SEED[@]}" >/dev/null
[ "$(count)" = "1" ] || fail "course de test non créée"
[ "$(sql "select status::text || ',' || pickup_lat || ',' || destination_lng || ',' || coalesce(estimated_price::text,'null') from public.rides where passenger_id='$PASSENGER'")" = "searching,5.36,-4.02,null" ] || fail "contenu de la course de test"
RIDE=$(sql "select id from public.rides where passenger_id='$PASSENGER'")
[ "$(sql "select count(*) from public.ride_status_history where ride_id='$RIDE'")" = "2" ] || fail "historique de la course de test"

# 4. Aucun objet joignable par un client n'a été créé par le script (pas de fonction, pas de GRANT).
grep -v '^ *--' supabase/staging/seed_test_ride.sql | grep -qiE 'create (or replace )?function|grant ' && fail "le script ne doit créer ni fonction ni GRANT"

# 5. Un client authentifié ne peut toujours pas créer de course ni lire celle d'un autre.
"${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$DRIVER',false) is not null; select count(*) from public.rides;" | tail -n1 | grep -qx 0 || fail "un autre compte voit la course de test"

# 6. La course injectée suit ensuite les transitions 011 (affectation directe par le propriétaire, puis RPC chauffeur).
sql "update public.rides set status='assigned', driver_id='$DRIVER', assigned_at=now() where id='$RIDE'" >/dev/null
OUT=$("${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$DRIVER',false) is not null; select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false) is not null; select status from public.advance_driver_ride('$RIDE','arriving');" | tail -n1)
[ "$OUT" = "arriving" ] || fail "transition 011 sur la course de test: $OUT"

echo "OK staging_seed"
