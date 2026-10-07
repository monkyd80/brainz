#!/usr/bin/env bash
set -euo pipefail
source /etc/brainz/brainz.env
export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
export PATH=/opt/brainz-runtime/node/bin:$PATH
cd /opt/brainz/frontend
exec /opt/brainz-runtime/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$FRONTEND_PORT"
