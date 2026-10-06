#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
cd /opt/brainz
set -a
source /etc/brainz/brainz.env
set +a
export PATH=/opt/brainz-runtime/node/bin:$PATH
if systemctl is-active --quiet brainz-backend; then systemctl stop brainz-backend; fi
if systemctl is-active --quiet brainz-frontend; then systemctl stop brainz-frontend; fi
# This is a dedicated application checkout, not a shared workspace.
chown -R brainz:brainz backend frontend
if [[ ! -x .venv/bin/python ]]; then
  /opt/brainz-runtime/python/bin/python3.12 -m venv .venv
  chown -R brainz:brainz .venv
fi
runuser -u brainz -- .venv/bin/pip install -r backend/requirements.txt gunicorn==23.0.0
runuser -u brainz -- .venv/bin/python backend/manage.py migrate
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
After=network.target brainz-postgresql.service
Requires=brainz-postgresql.service
[Service]
User=brainz
Group=brainz
WorkingDirectory=/opt/brainz/backend
EnvironmentFile=/etc/brainz/brainz.env
ExecStart=/opt/brainz/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 2 --timeout 120 --access-logfile - --error-logfile -
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
ExecStart=/opt/brainz-runtime/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
# FRONTEND_URL from init.sh contains a validated IPv4 and fixed port.
ip=${FRONTEND_URL#http://}
ip=${ip%:8080}
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected IPv4 FRONTEND_URL with :8080.' >&2; exit 1; }
cat > /etc/nginx/conf.d/brainz.conf <<EOF
server {
    listen $ip:8080;
    server_name $ip;
    client_max_body_size 30m;
    proxy_read_timeout 120s;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    location /api/ { proxy_pass http://127.0.0.1:8000; }
    location /admin/ { proxy_pass http://127.0.0.1:8000; }
    location /static/ { alias /var/lib/brainz-static/; }
    location / { proxy_pass http://127.0.0.1:3000; }
}
EOF
if [[ $(getenforce) != Disabled ]]; then
  setsebool -P httpd_can_network_connect on
  if ! semanage fcontext -a -t httpd_sys_content_t '/var/lib/brainz-static(/.*)?'; then
    semanage fcontext -m -t httpd_sys_content_t '/var/lib/brainz-static(/.*)?'
  fi
  restorecon -Rv /var/lib/brainz-static
  if ! semanage port -a -t http_port_t -p tcp 8080; then
    semanage port -m -t http_port_t -p tcp 8080
  fi
fi
nginx -t
systemctl daemon-reload
systemctl enable --now brainz-backend brainz-frontend nginx
systemctl reload nginx
for attempt in {1..60}; do
  if curl --max-time 5 --fail --silent --output /dev/null "$FRONTEND_URL/" && curl --max-time 5 --fail --silent --output /dev/null "$FRONTEND_URL/admin/login/"; then
    echo "Service ready: $FRONTEND_URL"; exit 0
  fi
  sleep 1
done
echo 'Service did not become ready; inspect journalctl for brainz-backend, brainz-frontend and nginx.' >&2
exit 1
