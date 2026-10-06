#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo 'Run init-env.sh first.' >&2; exit 1; }
[[ -f assets/sample_kdy.xls ]] || echo 'WARNING: assets/sample_kdy.xls missing; template download will be unavailable.' >&2
docker compose config --quiet
docker compose build --pull
docker compose up -d --wait db
docker compose run --rm --no-deps backend python manage.py migrate
docker compose run --rm --no-deps backend python manage.py collectstatic --noinput
docker compose run --rm --no-deps backend python manage.py check --deploy
docker compose up -d --wait --wait-timeout 180
docker compose up -d --force-recreate nginx
docker compose ps
echo 'Open FRONTEND_URL in .env and verify login, imports, assignments and template download.'
