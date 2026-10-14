#!/usr/bin/env bash
# Rejoue toutes les migrations puis les tests SQL sur une base jetable.
# Usage : PGHOST=... PGUSER=... PGDATABASE=... supabase/tests/run-local.sh
# Refuse de tourner contre un hôte Supabase.
set -euo pipefail
cd "$(dirname "$0")/../.."

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refus : base Supabase distante." >&2; exit 1 ;;
esac

psql -v ON_ERROR_STOP=1 -q -f supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  echo "== $migration"
  psql -v ON_ERROR_STOP=1 -q -f "$migration"
done
for test in supabase/tests/*.test.sql; do
  echo "== $test"
  psql -v ON_ERROR_STOP=1 -q -f "$test"
done
