#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
dump=${1:?Usage: sudo bash restore-db.sh /absolute/path/company_manager.dump}
[[ "$dump" = /* && -f "$dump" ]] || { echo 'Provide an existing absolute dump path.' >&2; exit 1; }
docker compose config --quiet
docker compose up -d --wait db
tables=$(docker compose exec -T db psql -U brainz_app -d company_manager -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
[[ "$tables" == 0 ]] || { echo 'DB is not empty. Refusing restore; no data changed.' >&2; exit 1; }
docker compose stop backend
docker compose exec -T db pg_restore -U brainz_app -d company_manager --no-owner --no-acl --exit-on-error --single-transaction < "$dump"
echo 'Restored successfully. Run start.sh next.'
