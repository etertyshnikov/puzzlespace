#!/usr/bin/env bash
# Новая ревизия Alembic (autogenerate по моделям)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG="${1:-schema_change}"
# shellcheck disable=SC1091
source "$ROOT/scripts/_venv.sh"

"$ALEMBIC" revision --autogenerate -m "$MSG"
echo "Проверьте alembic/versions/ и выполните: bash scripts/migrate-apply.sh"
