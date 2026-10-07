#!/usr/bin/env bash
set -euo pipefail
set -a
source /etc/brainz/brainz.env
set +a
cd /opt/brainz/backend
exec /opt/brainz/.venv/bin/gunicorn config.wsgi:application --bind "127.0.0.1:$BACKEND_PORT" --workers 2 --timeout 120 --access-logfile - --error-logfile -
