#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
source /etc/os-release
[[ "$ID" == rocky && "$VERSION_ID" == 9.* ]] || { echo 'Rocky Linux 9 required.' >&2; exit 1; }
dnf install -y dnf-plugins-core git openssl
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
echo 'Docker installed. Use sudo for Docker commands. No firewall or SELinux settings changed.'
