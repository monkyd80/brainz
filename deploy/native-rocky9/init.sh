#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
[[ $(realpath "$(dirname "$0")/../..") == /opt/brainz ]] || { echo 'Clone this repository to /opt/brainz first.' >&2; exit 1; }
ip=${1:?Usage: sudo bash init.sh SERVER_IPV4}
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
[[ ! -e /etc/brainz/brainz.env ]] || { echo 'Environment already exists. Refusing overwrite.' >&2; exit 1; }
install -d -m 750 -o root -g brainz /etc/brainz
install -d -m 700 /var/backups/brainz
install -d -m 755 /var/lib/brainz-static
umask 077
password=$(openssl rand -hex 24)
cat > /etc/brainz/brainz.env <<EOF
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=company_manager
POSTGRES_USER=brainz_app
POSTGRES_PASSWORD=$password
DJANGO_SECRET_KEY=$(openssl rand -hex 48)
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=$ip,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://$ip:8080
DJANGO_CORS_ALLOWED_ORIGINS=http://$ip:8080
DJANGO_BEHIND_PROXY=true
FRONTEND_URL=http://$ip:8080
TEMPLATE_FILE=/opt/brainz/sample_kdy.xls
EOF
chown root:brainz /etc/brainz/brainz.env
chmod 640 /etc/brainz/brainz.env
# Generated hex password is the only interpolated SQL value. Never supplied on argv.
printf "CREATE ROLE brainz_app LOGIN PASSWORD '%s';\nCREATE DATABASE company_manager OWNER brainz_app;\n" "$password" |
  runuser -u brainz_pg -- /opt/brainz-runtime/postgresql/bin/psql -h /var/lib/brainz-postgresql -d postgres -v ON_ERROR_STOP=1
unset password
echo 'Created environment and empty DB. Restore PC dump BEFORE deploy.sh.'
