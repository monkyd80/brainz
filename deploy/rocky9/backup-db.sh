#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
umask 077
mkdir -p backups
target="backups/company_manager-$(date +%Y%m%d-%H%M%S)-$$.dump"
trap 'rm -f -- "$target.partial"' EXIT
docker compose exec -T db pg_dump -U brainz_app -d company_manager -Fc > "$target.partial"
mv -- "$target.partial" "$target"
echo "$PWD/$target"
