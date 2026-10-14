#!/usr/bin/env bash
# Применить полную миграцию схемы (таблицы + колонки) без запуска сервера.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [ -d venv ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi
python -m app.migrations.apply
