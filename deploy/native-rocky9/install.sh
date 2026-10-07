#!/usr/bin/env bash
# App runtimes only. Existing PostgreSQL is managed separately.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Use sudo.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == rocky && "$VERSION_ID" == 9.* ]] || exit 1
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
echo 'Installed Python 3.12, Node 22 and Nginx. Continue with init.sh.'
