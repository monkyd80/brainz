#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
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
ExecStart=/bin/bash /opt/brainz/deploy/native-rocky9/run-backend.sh
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
ExecStart=/bin/bash /opt/brainz/deploy/native-rocky9/run-frontend.sh
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
