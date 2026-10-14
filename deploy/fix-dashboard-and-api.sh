#!/usr/bin/env bash
# Восстановление API и дашборда: файлы на диске WSL + миграции БД + перезапуск
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${ROOT}/venv/bin/python"

echo "=== 1. html_to_pdf (обязателен для старта API) ==="
bash "$ROOT/deploy/install-html-to-pdf.sh"

echo "=== 2. Проверка остальных модулей ==="
bash "$ROOT/deploy/sync-required-app-modules.sh" || true

echo "=== 3. Миграции БД ==="
"$PY" -m app.migrations.apply

echo "=== 4. Импорт приложения ==="
"$PY" -c "from app.main import app; print('app.main OK')"

echo "=== 5. Перезапуск сервиса ==="
sudo systemctl restart smetadoma05
sleep 2
if systemctl is-active --quiet smetadoma05; then
  echo "smetadoma05: active"
else
  echo "smetadoma05 FAILED — journalctl:" >&2
  sudo journalctl -u smetadoma05 -n 20 --no-pager >&2
  exit 1
fi

echo "=== 6. Health ==="
curl -sS http://127.0.0.1:8008/health
echo ""

echo "=== Готово. Проверьте проекты (подставьте TOKEN): ==="
echo 'curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8008/api/projects?limit=3"'
