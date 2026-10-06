#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
dump=${1:?Usage: sudo bash restore-db.sh /absolute/path/backup.dump}
[[ "$dump" == /* && -f "$dump" ]] || exit 1
set -a
source /etc/brainz/brainz.env
set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
pg=/opt/brainz-runtime/postgresql/bin
tables=$("$pg/psql" -h 127.0.0.1 -U brainz_app -d company_manager -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
[[ "$tables" == 0 ]] || { echo 'DB is not empty; restore refused.' >&2; exit 1; }
if systemctl is-active --quiet brainz-backend; then systemctl stop brainz-backend; fi
"$pg/pg_restore" -h 127.0.0.1 -U brainz_app -d company_manager --no-owner --no-acl --single-transaction --exit-on-error < "$dump"
echo 'Restored. Run deploy.sh next.'
