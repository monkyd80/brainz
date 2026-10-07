#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
[[ $(realpath "$(dirname "$0")/../..") == /opt/brainz ]] || { echo 'Clone to /opt/brainz first.' >&2; exit 1; }
ip=${1:?Usage: sudo bash init.sh SERVER_IPV4 [DB_PORT] [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]}
db_port=${2:-15432}
web_port=${3:-8080}
backend_port=${4:-18000}
frontend_port=${5:-13000}
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected server IPv4.' >&2; exit 1; }
for port in "$db_port" "$web_port" "$backend_port" "$frontend_port"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid port.' >&2; exit 1; }
done
[[ "$web_port" != "$backend_port" && "$web_port" != "$frontend_port" && "$backend_port" != "$frontend_port" ]] || { echo 'App ports must differ.' >&2; exit 1; }
[[ ! -e /etc/brainz/brainz.env ]] || { echo 'Existing environment preserved. Edit /etc/brainz/brainz.env instead.' >&2; exit 1; }
read -r -p 'Existing DB host [127.0.0.1]: ' db_host
read -r -p 'Existing DB name [manager]: ' db_name
read -r -p 'Existing DB user [brainz]: ' db_user
read -r -s -p 'Existing DB password: ' password
printf '\n'
[[ -n "$password" ]] || { echo 'DB password is required.' >&2; exit 1; }
install -d -m 750 -o root -g brainz /etc/brainz
install -d -m 755 /var/lib/brainz-static
umask 077
# Bash escaping preserves special characters. Do not use as systemd EnvironmentFile.
write_env() { printf '%s=%q\n' "$1" "$2"; }
{
  write_env POSTGRES_HOST "${db_host:-127.0.0.1}"
  write_env POSTGRES_PORT "$db_port"
  write_env POSTGRES_DB "${db_name:-manager}"
  write_env POSTGRES_USER "${db_user:-brainz}"
  write_env POSTGRES_PASSWORD "$password"
  write_env DJANGO_SECRET_KEY "$(openssl rand -hex 48)"
  write_env DJANGO_DEBUG false
  write_env DJANGO_ALLOWED_HOSTS "$ip,localhost,127.0.0.1"
  write_env DJANGO_CSRF_TRUSTED_ORIGINS "http://$ip:$web_port"
  write_env DJANGO_CORS_ALLOWED_ORIGINS "http://$ip:$web_port"
  write_env DJANGO_BEHIND_PROXY true
  write_env FRONTEND_URL "http://$ip:$web_port"
  write_env SERVER_IP "$ip"
  write_env WEB_PORT "$web_port"
  write_env BACKEND_PORT "$backend_port"
  write_env FRONTEND_PORT "$frontend_port"
  write_env TEMPLATE_FILE /opt/brainz/sample_kdy.xls
} > /etc/brainz/brainz.env
unset password
chown root:brainz /etc/brainz/brainz.env
chmod 640 /etc/brainz/brainz.env
echo 'Saved existing DB connection settings. No DB or role was created.'
