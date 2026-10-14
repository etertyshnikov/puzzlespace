#!/usr/bin/env bash
# Применить миграции Alembic (читает DB_URI из .env)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_venv.sh"

"$ALEMBIC" upgrade head
echo "OK: alembic upgrade head"
