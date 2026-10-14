#!/usr/bin/env bash
# Пометить БД как актуальную без применения SQL (если таблицы уже созданы вручную)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REV="${1:-head}"
# shellcheck disable=SC1091
source "$ROOT/scripts/_venv.sh"

"$ALEMBIC" stamp "$REV"
echo "OK: alembic stamp $REV"
