#!/usr/bin/env bash
# Снимок smetadoma05_db → загрузка в smetadoma06_db (новая схема, без legacy-таблиц)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_venv.sh"

SOURCE_DB_URI="${SOURCE_DB_URI:-postgresql://smetadoma04:Lenina21@localhost:5432/smetadoma05_db}"
export SOURCE_DB_URI

echo "==> Схема на целевой БД (alembic)"
bash "$ROOT/scripts/migrate-apply.sh"

echo "==> Снимок + перенос данных"
"$PY" "$ROOT/scripts/migrate_db_data.py" --source "$SOURCE_DB_URI" "$@"

echo "==> Версия миграций на целевой БД"
"$ALEMBIC" stamp head
