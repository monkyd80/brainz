#!/usr/bin/env bash
# Fresh Rocky 9 server only. Runtime prefixes deliberately avoid OS Python.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == rocky && "$VERSION_ID" == 9.* ]] || exit 1
pg_version=${1:-16.15}
[[ "$pg_version" == 16.15 || "$pg_version" == 17.11 ]] || { echo 'Supported: 16.15 or 17.11' >&2; exit 1; }
[[ ! -e /opt/brainz-runtime/postgresql/bin/postgres && ! -e /var/lib/brainz-postgresql/PG_VERSION ]] || { echo 'PostgreSQL already installed. Refusing reinstall.' >&2; exit 1; }
dnf install -y dnf-plugins-core
dnf config-manager --set-enabled crb
dnf install -y git curl tar xz bzip2 gcc make bison flex openssl openssl-devel zlib-devel \
  bzip2-devel libffi-devel readline-devel sqlite-devel xz-devel ncurses-devel \
  libuuid-devel nginx policycoreutils-python-utils firewalld
id brainz >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/brainz --shell /sbin/nologin brainz
id brainz_pg >/dev/null 2>&1 || useradd --system --home-dir /var/lib/brainz-postgresql --shell /sbin/nologin brainz_pg
install -d -m 755 /opt/brainz-runtime
work=$(mktemp -d /var/tmp/brainz-build.XXXXXX)
trap 'rm -rf -- "$work"' EXIT
cd "$work"
# SHA-256 published on the Python 3.12.15 release page.
curl --fail --location --retry 3 -o Python.tar.xz https://www.python.org/ftp/python/3.12.15/Python-3.12.15.tar.xz
echo 'c2c4321961fab0fb999d66e0cecf521c2ab3994c7992873ea99e306c1094fd5a  Python.tar.xz' | sha256sum -c -
tar -xf Python.tar.xz
cd Python-3.12.15
./configure --prefix=/opt/brainz-runtime/python --with-ensurepip=install
make -j "${BUILD_JOBS:-2}"
make altinstall
/opt/brainz-runtime/python/bin/python3.12 -c 'import ssl, sqlite3, bz2, lzma, ctypes; print(ssl.OPENSSL_VERSION)'
cd "$work"
case $(uname -m) in x86_64) node_arch=x64;; aarch64) node_arch=arm64;; *) echo 'Unsupported architecture'; exit 1;; esac
curl --fail --location --retry 3 -o SHASUMS256.txt https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
node_file=$(awk -v arch="$node_arch" '$2 ~ ("^node-v22[.][0-9]+[.][0-9]+-linux-" arch "[.]tar[.]xz$") { print $2 }' SHASUMS256.txt)
[[ -n "$node_file" && "$node_file" != *$'\n'* ]] || { echo 'Cannot resolve Node 22 archive.' >&2; exit 1; }
curl --fail --location --retry 3 -O "https://nodejs.org/dist/latest-v22.x/$node_file"
awk -v file="$node_file" '$2 == file' SHASUMS256.txt | sha256sum -c -
install -d /opt/brainz-runtime/node
tar -xJf "$node_file" --strip-components=1 -C /opt/brainz-runtime/node
curl --fail --location --retry 3 -O "https://ftp.postgresql.org/pub/source/v$pg_version/postgresql-$pg_version.tar.bz2"
curl --fail --location --retry 3 -O "https://ftp.postgresql.org/pub/source/v$pg_version/postgresql-$pg_version.tar.bz2.sha256"
sha256sum -c "postgresql-$pg_version.tar.bz2.sha256"
tar -xf "postgresql-$pg_version.tar.bz2"
cd "postgresql-$pg_version"
./configure --prefix=/opt/brainz-runtime/postgresql --with-openssl --without-icu
make -j "${BUILD_JOBS:-2}"
make install
install -d -o brainz_pg -g brainz_pg -m 700 /var/lib/brainz-postgresql
runuser -u brainz_pg -- /opt/brainz-runtime/postgresql/bin/initdb -D /var/lib/brainz-postgresql --encoding=UTF8 --locale=C.UTF-8 --auth-local=peer --auth-host=scram-sha-256
cat >> /var/lib/brainz-postgresql/postgresql.conf <<'EOF'
listen_addresses = '127.0.0.1'
unix_socket_directories = '/var/lib/brainz-postgresql'
password_encryption = 'scram-sha-256'
EOF
cat > /etc/systemd/system/brainz-postgresql.service <<'EOF'
[Unit]
Description=BRAINZ PostgreSQL
After=network.target
[Service]
Type=simple
User=brainz_pg
Group=brainz_pg
ExecStart=/opt/brainz-runtime/postgresql/bin/postgres -D /var/lib/brainz-postgresql
Restart=on-failure
TimeoutStopSec=120
KillSignal=SIGINT
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now brainz-postgresql
for attempt in {1..30}; do
  if runuser -u brainz_pg -- /opt/brainz-runtime/postgresql/bin/pg_isready -h /var/lib/brainz-postgresql -d postgres; then break; fi
  sleep 1
done
runuser -u brainz_pg -- /opt/brainz-runtime/postgresql/bin/psql -h /var/lib/brainz-postgresql -d postgres -c 'SELECT version();'
echo 'Installed Python 3.12, Node 22, PostgreSQL and Nginx. Continue with init.sh.'
