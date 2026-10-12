#!/usr/bin/env bash
# Rocky Linux 9: install the app using an existing, restored PostgreSQL DB.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
[[ $(realpath "$(dirname "$0")/..") == /opt/brainz ]] || { echo 'Clone this repository to /opt/brainz first.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == rocky && "$VERSION_ID" == 9.* ]] || { echo 'Rocky Linux 9 required.' >&2; exit 1; }
ip=${1:?Usage: sudo bash deploy/install-app.sh SERVER_IPV4 [DB_PORT] [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]}
db_port=${2:-15432}
web_port=${3:-8080}
backend_port=${4:-18000}
frontend_port=${5:-13000}
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected server IPv4.' >&2; exit 1; }
for port in "$db_port" "$web_port" "$backend_port" "$frontend_port"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid port.' >&2; exit 1; }
done
[[ "$web_port" != "$backend_port" && "$web_port" != "$frontend_port" && "$backend_port" != "$frontend_port" ]] || { echo 'App ports must differ.' >&2; exit 1; }
if [[ -e /etc/brainz/brainz.env ]]; then
  # Preserve credentials and ports on reruns; explicit args must agree.
  source /etc/brainz/brainz.env
  [[ "$SERVER_IP" == "$ip" ]] || { echo 'Server IP differs from saved environment. Edit /etc/brainz/brainz.env first.' >&2; exit 1; }
  for spec in "${2:-$POSTGRES_PORT}:$POSTGRES_PORT" "${3:-$WEB_PORT}:$WEB_PORT" "${4:-$BACKEND_PORT}:$BACKEND_PORT" "${5:-$FRONTEND_PORT}:$FRONTEND_PORT"; do
    [[ "${spec%:*}" == "${spec#*:}" ]] || { echo 'Port differs from saved environment. Edit /etc/brainz/brainz.env first.' >&2; exit 1; }
  done
  db_port=$POSTGRES_PORT; web_port=$WEB_PORT; backend_port=$BACKEND_PORT; frontend_port=$FRONTEND_PORT
  echo 'Reusing existing app environment.'
else
read -r -p 'Existing DB host [127.0.0.1]: ' db_host
read -r -p 'Existing DB name [manager]: ' db_name
read -r -p 'Existing DB user [brainz]: ' db_user
read -r -s -p 'Existing DB password: ' password
printf '\n'
[[ -n "$password" ]] || { echo 'DB password is required.' >&2; exit 1; }
fi
for port in "$db_port" "$web_port" "$backend_port" "$frontend_port"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid saved port.' >&2; exit 1; }
done
[[ "$web_port" != "$backend_port" && "$web_port" != "$frontend_port" && "$backend_port" != "$frontend_port" ]] || { echo 'Saved app ports must differ.' >&2; exit 1; }
command -v ss >/dev/null || { echo 'ss is required (install iproute).' >&2; exit 1; }
for spec in "$backend_port:brainz-backend" "$frontend_port:brainz-frontend"; do
  port=${spec%:*}; service=${spec#*:}
  if ! systemctl is-active --quiet "$service" && [[ -n $(ss -H -ltn "sport = :$port") ]]; then
    echo "App port $port is occupied by another service." >&2; exit 1
  fi
done
if [[ ! -e /etc/nginx/conf.d/brainz.conf && -n $(ss -H -ltn "sport = :$web_port") ]]; then
  echo "Web port $web_port is occupied." >&2; exit 1
fi
dnf install -y dnf-plugins-core
dnf config-manager --set-enabled crb
dnf install -y git curl tar xz bzip2 gcc make bison flex openssl openssl-devel zlib-devel \
  bzip2-devel libffi-devel readline-devel sqlite-devel xz-devel ncurses-devel \
  libuuid-devel nginx policycoreutils-python-utils firewalld
if id brainz >/dev/null 2>&1; then
  [[ $(getent passwd brainz | cut -d: -f6) == /var/lib/brainz ]] || { echo 'Linux user brainz belongs to another installation. Refusing reuse.' >&2; exit 1; }
else
  useradd --system --create-home --home-dir /var/lib/brainz --shell /sbin/nologin brainz
fi
install -d -m 755 /opt/brainz-runtime
work=$(mktemp -d /var/tmp/brainz-build.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
cd "$work"
if [[ ! -x /opt/brainz-runtime/python/bin/python3.12 ]]; then
# SHA-256 published on the Python 3.12.15 release page.
curl --fail --location --retry 3 -o Python.tar.xz https://www.python.org/ftp/python/3.12.15/Python-3.12.15.tar.xz
echo 'c2c4321961fab0fb999d66e0cecf521c2ab3994c7992873ea99e306c1094fd5a  Python.tar.xz' | sha256sum -c -
tar -xf Python.tar.xz
cd Python-3.12.15
./configure --prefix=/opt/brainz-runtime/python --with-ensurepip=install
make -j "${BUILD_JOBS:-2}"
make altinstall
/opt/brainz-runtime/python/bin/python3.12 -c 'import ssl, sqlite3, bz2, lzma, ctypes; print(ssl.OPENSSL_VERSION)'
fi
cd "$work"
if [[ ! -x /opt/brainz-runtime/node/bin/node ]]; then
case $(uname -m) in x86_64) node_arch=x64;; aarch64) node_arch=arm64;; *) echo 'Unsupported architecture'; exit 1;; esac
curl --fail --location --retry 3 -o SHASUMS256.txt https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
node_file=$(awk -v arch="$node_arch" '$2 ~ ("^node-v22[.][0-9]+[.][0-9]+-linux-" arch "[.]tar[.]xz$") { print $2 }' SHASUMS256.txt)
[[ -n "$node_file" && "$node_file" != *$'\n'* ]] || { echo 'Cannot resolve Node 22 archive.' >&2; exit 1; }
curl --fail --location --retry 3 -O "https://nodejs.org/dist/latest-v22.x/$node_file"
awk -v file="$node_file" '$2 == file' SHASUMS256.txt | sha256sum -c -
install -d /opt/brainz-runtime/node
tar -xJf "$node_file" --strip-components=1 -C /opt/brainz-runtime/node
fi
if [[ ! -e /etc/brainz/brainz.env ]]; then
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
fi
install -d -m 755 /var/lib/brainz-static
cat > /etc/brainz/run-backend.sh <<'BRAINZ_WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
set -a
source /etc/brainz/brainz.env
set +a
cd /opt/brainz/backend
exec /opt/brainz/.venv/bin/gunicorn config.wsgi:application --bind "127.0.0.1:$BACKEND_PORT" --workers 2 --timeout 120 --access-logfile - --error-logfile -
BRAINZ_WRAPPER
cat > /etc/brainz/run-frontend.sh <<'BRAINZ_WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
source /etc/brainz/brainz.env
export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
export PATH=/opt/brainz-runtime/node/bin:$PATH
cd /opt/brainz/frontend
exec /opt/brainz-runtime/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$FRONTEND_PORT"
BRAINZ_WRAPPER
chown root:brainz /etc/brainz/run-backend.sh /etc/brainz/run-frontend.sh
chmod 750 /etc/brainz/run-backend.sh /etc/brainz/run-frontend.sh
cd /opt/brainz
set -a
source /etc/brainz/brainz.env
set +a
export PATH=/opt/brainz-runtime/node/bin:$PATH
: "${POSTGRES_HOST:?}" "${POSTGRES_PORT:?}" "${POSTGRES_DB:?}" "${POSTGRES_USER:?}" "${POSTGRES_PASSWORD:?}"
: "${SERVER_IP:?}" "${WEB_PORT:?}" "${BACKEND_PORT:?}" "${FRONTEND_PORT:?}"
[[ "$SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
for port in "$POSTGRES_PORT" "$WEB_PORT" "$BACKEND_PORT" "$FRONTEND_PORT"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid port.' >&2; exit 1; }
done
[[ "$WEB_PORT" != "$BACKEND_PORT" && "$WEB_PORT" != "$FRONTEND_PORT" && "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || exit 1
for spec in "$BACKEND_PORT:brainz-backend" "$FRONTEND_PORT:brainz-frontend"; do
  port=${spec%:*}
  service=${spec#*:}
  if ! systemctl is-active --quiet "$service" && [[ -n $(ss -H -ltn "sport = :$port") ]]; then
    echo "Port $port is occupied by another service." >&2; exit 1
  fi
done
if [[ ! -e /etc/nginx/conf.d/brainz.conf && -n $(ss -H -ltn "sport = :$WEB_PORT") ]]; then
  echo "Web port $WEB_PORT is occupied." >&2; exit 1
fi
if systemctl is-active --quiet brainz-backend; then systemctl stop brainz-backend; fi
if systemctl is-active --quiet brainz-frontend; then systemctl stop brainz-frontend; fi
# This is a dedicated application checkout, not a shared workspace.
chown -R brainz:brainz backend frontend
if [[ ! -x .venv/bin/python ]]; then
  /opt/brainz-runtime/python/bin/python3.12 -m venv .venv
  chown -R brainz:brainz .venv
fi
runuser -u brainz -- .venv/bin/pip install -r backend/requirements.txt gunicorn==23.0.0
# Fail before migrations if credentials, server version or restored DB are wrong.
runuser -u brainz -- .venv/bin/python backend/manage.py shell -c 'from django.db import connection; connection.ensure_connection(); cursor = connection.cursor(); cursor.execute("SELECT to_regclass(%s)", ["public.django_migrations"]); assert cursor.fetchone()[0], "Restore the application DB before deployment"; print("Existing application DB connection OK")'
runuser -u brainz -- .venv/bin/python backend/manage.py migrate --noinput
runuser -u brainz -- .venv/bin/python backend/manage.py collectstatic --noinput
runuser -u brainz -- .venv/bin/python backend/manage.py check --deploy
cp -a backend/staticfiles/. /var/lib/brainz-static/
chmod -R a+rX /var/lib/brainz-static
cd frontend
runuser -u brainz -- env PATH="$PATH" /opt/brainz-runtime/node/bin/npm ci
runuser -u brainz -- env PATH="$PATH" NEXT_PUBLIC_API_URL=/api NEXT_TELEMETRY_DISABLED=1 /opt/brainz-runtime/node/bin/npm run build
cd /opt/brainz
cat > /etc/systemd/system/brainz-backend.service <<'EOF'
[Unit]
Description=BRAINZ Django Gunicorn
After=network-online.target
Wants=network-online.target
[Service]
User=brainz
Group=brainz
WorkingDirectory=/opt/brainz/backend
ExecStart=/bin/bash /etc/brainz/run-backend.sh
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/brainz-frontend.service <<'EOF'
[Unit]
Description=BRAINZ Next.js
After=network.target
[Service]
User=brainz
Group=brainz
WorkingDirectory=/opt/brainz/frontend
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=PATH=/opt/brainz-runtime/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
ExecStart=/bin/bash /etc/brainz/run-frontend.sh
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/nginx/conf.d/brainz.conf <<EOF
server {
    listen $SERVER_IP:$WEB_PORT;
    server_name $SERVER_IP;
    client_max_body_size 30m;
    proxy_read_timeout 120s;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    location /api/ { proxy_pass http://127.0.0.1:$BACKEND_PORT; }
    location /admin/ { proxy_pass http://127.0.0.1:$BACKEND_PORT; }
    location /static/ { alias /var/lib/brainz-static/; }
    location / { proxy_pass http://127.0.0.1:$FRONTEND_PORT; }
}
EOF
if [[ $(getenforce) != Disabled ]]; then
  setsebool -P httpd_can_network_connect on
  if ! semanage fcontext -a -t httpd_sys_content_t '/var/lib/brainz-static(/.*)?'; then
    semanage fcontext -m -t httpd_sys_content_t '/var/lib/brainz-static(/.*)?'
  fi
  restorecon -Rv /var/lib/brainz-static
  if ! semanage port -a -t http_port_t -p tcp "$WEB_PORT"; then
    semanage port -m -t http_port_t -p tcp "$WEB_PORT"
  fi
fi
nginx -t
systemctl daemon-reload
systemctl enable brainz-backend brainz-frontend nginx
systemctl restart brainz-backend brainz-frontend
systemctl start nginx
systemctl reload nginx
for attempt in {1..60}; do
  if curl --max-time 5 --fail --silent --output /dev/null "$FRONTEND_URL/" && curl --max-time 5 --fail --silent --output /dev/null "$FRONTEND_URL/admin/login/"; then
    echo "Service ready: $FRONTEND_URL"; exit 0
  fi
  sleep 1
done
echo 'Service did not become ready; inspect journalctl for brainz-backend, brainz-frontend and nginx.' >&2
exit 1
