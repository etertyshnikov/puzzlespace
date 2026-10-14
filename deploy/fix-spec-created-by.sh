#!/usr/bin/env bash
# Колонка specifications.created_by_user_id и прочая схема
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON=""
for candidate in "$ROOT/venv/bin/python" "$ROOT/.venv/bin/python"; do
  if [ -x "$candidate" ]; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "venv не найден в $ROOT" >&2
  exit 1
fi

"$PYTHON" -m app.migrations.apply
echo "schema: миграция применена"
