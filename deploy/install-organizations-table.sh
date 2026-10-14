#!/usr/bin/env bash
# Таблицы companies / organizations для PDF и договоров (миграция Alembic 002).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_venv.sh"

echo "=== Проверка колонки organizations.company_id ==="
"$PY" - <<'PY'
from sqlalchemy import inspect, text
from app.database import engine

with engine.connect() as conn:
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        print("organizations: ОТСУТСТВУЕТ")
    else:
        cols = {c["name"] for c in insp.get_columns("organizations")}
        if "company_id" not in cols:
            print("organizations.company_id: ОТСУТСТВУЕТ — применяем миграцию")
        else:
            n = conn.execute(text("SELECT COUNT(*) FROM organizations")).scalar()
            print(f"organizations: OK ({n} записей, company_id есть)")
PY

echo "=== Alembic upgrade head ==="
"$ALEMBIC" upgrade head

echo "=== Повторная проверка ==="
"$PY" - <<'PY'
from sqlalchemy import inspect, text
from app.database import engine

with engine.connect() as conn:
    insp = inspect(conn)
    if "organizations" not in insp.get_table_names():
        raise SystemExit("organizations всё ещё отсутствует")
    cols = {c["name"] for c in insp.get_columns("organizations")}
    if "company_id" not in cols:
        raise SystemExit("organizations.company_id всё ещё отсутствует")
    n = conn.execute(text("SELECT COUNT(*) FROM organizations")).scalar()
    print(f"OK: organizations ({n} записей)")
PY

echo "Перезапуск сервиса: sudo systemctl restart smetadoma05"
