#!/usr/bin/env bash
# Fresh app installation beside an existing PostgreSQL server.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
scripts=$(cd "$(dirname "$0")" && pwd)
[[ $(realpath "$scripts/../..") == /opt/brainz ]] || { echo 'Clone to /opt/brainz first.' >&2; exit 1; }
[[ $# -ge 1 ]] || { echo 'Usage: sudo bash setup.sh SERVER_IPV4 [DB_PORT] [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]' >&2; exit 1; }
[[ ! -e /etc/brainz/brainz.env && ! -e /etc/nginx/conf.d/brainz.conf && ! -e /etc/systemd/system/brainz-backend.service && ! -e /etc/systemd/system/brainz-frontend.service ]] || { echo 'BRAINZ already configured. Use deploy.sh for updates.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == rocky && "$VERSION_ID" == 9.* ]] || { echo 'Rocky Linux 9 required.' >&2; exit 1; }
[[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected server IPv4.' >&2; exit 1; }
for port in "${2:-15432}" "${3:-8080}" "${4:-18000}" "${5:-13000}"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid port.' >&2; exit 1; }
done
[[ "${3:-8080}" != "${4:-18000}" && "${3:-8080}" != "${5:-13000}" && "${4:-18000}" != "${5:-13000}" ]] || { echo 'App ports must differ.' >&2; exit 1; }
# App listeners must be free; the DB listener is expected to exist.
for port in "${3:-8080}" "${4:-18000}" "${5:-13000}"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid app port.' >&2; exit 1; }
  if [[ -n $(ss -H -ltn "sport = :$port") ]]; then
    echo "Port $port is occupied. Choose another app port." >&2; exit 1
  fi
done
bash "$scripts/install.sh"
bash "$scripts/init.sh" "$@"
bash "$scripts/deploy.sh"
