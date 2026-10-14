#!/usr/bin/env bash
# Применить миграцию схемы (в т.ч. колонки specifications).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source venv/bin/activate
fi
python -m app.migrations.apply
echo "specifications: миграция применена"
