#!/usr/bin/env bash
# Пересборка фронта и перезапуск smetadoma05 (+ nginx, если установлен)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/deploy/build-frontend.sh"
sudo systemctl restart smetadoma05
if systemctl is-active --quiet nginx 2>/dev/null; then
  sudo nginx -t
  sudo systemctl reload nginx
  echo "nginx перезагружен (фронт: frontend/dist)"
fi
echo "smetadoma05 перезапущен"
