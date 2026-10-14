#!/usr/bin/env bash
# Установка systemd unit для smetadoma05 (запускать в WSL под sudo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_SRC="$ROOT/deploy/smetadoma05.service"
UNIT_DST="/etc/systemd/system/smetadoma05.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите: sudo bash $0"
  exit 1
fi

if [[ ! -x "$ROOT/venv/bin/python" ]]; then
  echo "Сначала создайте venv и зависимости:"
  echo "  cd $ROOT && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Предупреждение: нет файла $ROOT/.env — скопируйте из .env.example и настройте DB_URI."
fi

cp -v "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable smetadoma05.service
echo "Включён автозапуск. Запуск: sudo systemctl start smetadoma05"
echo "Статус: sudo systemctl status smetadoma05"
echo "Логи:   journalctl -u smetadoma05 -f"
