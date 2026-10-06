#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
set -a
source /etc/brainz/brainz.env
set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
umask 077
install -d -m 700 /var/backups/brainz
file="/var/backups/brainz/company_manager-$(date +%Y%m%d-%H%M%S)-$$.dump"
trap 'rm -f -- "$file.partial"' EXIT
/opt/brainz-runtime/postgresql/bin/pg_dump -h 127.0.0.1 -U brainz_app -d company_manager -Fc > "$file.partial"
mv -- "$file.partial" "$file"
echo "$file"
