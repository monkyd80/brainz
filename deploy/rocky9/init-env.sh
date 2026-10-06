#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ ! -e .env ]] || { echo '.env already exists; edit it manually.' >&2; exit 1; }
ip=${1:?Usage: bash init-env.sh SERVER_IPV4 [POSTGRES_MAJOR] [HTTP_PORT]}
major=${2:-16}
port=${3:-8080}
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ && "$major" =~ ^(16|17)$ && "$port" =~ ^[0-9]+$ ]] || { echo 'Invalid arguments.' >&2; exit 1; }
umask 077
cat > .env <<EOF
BIND_IP=$ip
HTTP_PORT=$port
POSTGRES_MAJOR=$major
POSTGRES_PASSWORD=$(openssl rand -hex 24)
DJANGO_SECRET_KEY=$(openssl rand -hex 48)
DJANGO_ALLOWED_HOSTS=$ip,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://$ip:$port
DJANGO_CORS_ALLOWED_ORIGINS=http://$ip:$port
FRONTEND_URL=http://$ip:$port
TEMPLATE_FILE=/app/assets/sample_kdy.xls
EOF
mkdir -p assets backups
echo "Created private .env. Service address: http://$ip:$port"
