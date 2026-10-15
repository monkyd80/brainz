#!/usr/bin/env bash
# Read-only checks for deploy/install.sh. Never installs or restarts anything.
set -uo pipefail
[[ $EUID == 0 ]] || { echo 'sudo bash check-install.sh 로 실행하세요.' >&2; exit 1; }
export PYTHONDONTWRITEBYTECODE=1
passed=0
failed=0
skipped=0
check() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    printf '[OK] %s\n' "$label"
    passed=$((passed + 1))
  else
    printf '[FAIL] %s\n' "$label"
    failed=$((failed + 1))
  fi
}
skip() { printf '[SKIP] %s\n' "$1"; skipped=$((skipped + 1)); }
http_ok() {
  local code
  # Ignore proxy environment variables for checks against this server.
  code=$(curl --noproxy '*' --connect-timeout 3 --max-time 10 --silent --output /dev/null --write-out '%{http_code}' "$1") || return 1
  [[ "$code" =~ ^2[0-9][0-9]$ ]]
}
printf 'BRAINZ 설치 점검 (설정·DB·서비스를 변경하지 않습니다)\n\n'
check '앱 전용 Linux 사용자 brainz-app' id brainz-app
check '프로젝트 소스' test -f /opt/brainz/backend/manage.py
check 'Python 3.12 런타임' /opt/brainz-runtime/python/bin/python3.12 -c 'import sys, ssl, sqlite3; assert sys.version_info[:2] == (3, 12)'
check 'Node.js 22 런타임' /opt/brainz-runtime/node/bin/node -e 'if (Number(process.versions.node.split(".")[0]) !== 22) process.exit(1)'
check '앱 가상환경 및 Python 의존성' /opt/brainz/.venv/bin/python -c 'import django, rest_framework, corsheaders, psycopg, gunicorn, dotenv, xlrd, openpyxl'
check '프런트엔드 빌드 결과' test -s /opt/brainz/frontend/.next/BUILD_ID
check '백엔드 실행 파일' test -r /etc/brainz/run-backend.sh
check '프런트엔드 실행 파일' test -r /etc/brainz/run-frontend.sh
check 'Nginx 앱 설정 파일' test -s /etc/nginx/conf.d/brainz.conf
check 'Nginx 전체 설정 문법' nginx -t
for service in brainz-backend brainz-frontend nginx; do
  check "$service 실행 중" systemctl is-active --quiet "$service"
  check "$service 부팅 시 자동 실행" systemctl is-enabled --quiet "$service"
done

env_ready=false
if [[ -r /etc/brainz/brainz.env ]]; then
  set -a
  if source /etc/brainz/brainz.env >/dev/null 2>&1; then
    env_ready=true
  fi
  set +a
fi
if [[ "$env_ready" == true ]]; then
  for key in POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DJANGO_SECRET_KEY SERVER_IP WEB_PORT BACKEND_PORT FRONTEND_PORT; do
    if [[ -z ${!key:-} ]]; then env_ready=false; fi
  done
  for port in "${POSTGRES_PORT:-}" "${WEB_PORT:-}" "${BACKEND_PORT:-}" "${FRONTEND_PORT:-}"; do
    if ! [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] || (( port > 65535 )); then env_ready=false; fi
  done
  if ! [[ "${SERVER_IP:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then env_ready=false; fi
fi
check '필수 환경 설정 (비밀번호는 출력하지 않음)' test "$env_ready" = true
if [[ "$env_ready" == true ]]; then
  # Bound DB connection attempts so an unreachable host does not hang checks.
  export PGCONNECT_TIMEOUT=5
  if cd /opt/brainz; then
    check '기존 DB 접속 및 앱 테이블' runuser -u brainz-app -- .venv/bin/python backend/manage.py shell -c 'from django.db import connection; cursor = connection.cursor(); cursor.execute("SELECT to_regclass(%s)", ["public.django_migrations"]); assert cursor.fetchone()[0], "Application DB not restored"'
    check 'Django 설정 및 모델 검사' runuser -u brainz-app -- .venv/bin/python backend/manage.py check
    check '미적용 DB 마이그레이션 없음' runuser -u brainz-app -- .venv/bin/python backend/manage.py shell -c 'from django.db import connection; from django.db.migrations.executor import MigrationExecutor; executor = MigrationExecutor(connection); assert not executor.migration_plan(executor.loader.graph.leaf_nodes()), "Pending migrations"'
  else
    check '앱 작업 경로 접근' false
    skip 'DB 및 Django 검사: 프로젝트 경로 없음'
  fi
  check '백엔드 관리자 로그인 HTTP' http_ok "http://127.0.0.1:$BACKEND_PORT/admin/login/"
  check '프런트엔드 홈페이지 HTTP' http_ok "http://127.0.0.1:$FRONTEND_PORT/"
  check 'Nginx 홈페이지 HTTP' http_ok "http://$SERVER_IP:$WEB_PORT/"
  check 'Nginx 백엔드 프록시 HTTP' http_ok "http://$SERVER_IP:$WEB_PORT/admin/login/"
  printf '\n접속 주소: http://%s:%s\n' "$SERVER_IP" "$WEB_PORT"
else
  skip 'DB·Django·HTTP 검사: 필수 환경 설정 확인 필요'
fi
printf '\n결과: 성공 %d / 실패 %d / 생략 %d\n' "$passed" "$failed" "$skipped"
if (( failed > 0 )); then
  printf '실패 항목을 확인하세요. 앱 로그: sudo journalctl -u brainz-backend -u brainz-frontend -n 100 --no-pager\n'
  exit 1
fi
printf '서버 내부 설치 점검을 통과했습니다. 다른 PC에서 로그인과 실제 데이터, 방화벽 접속도 확인하세요.\n'
