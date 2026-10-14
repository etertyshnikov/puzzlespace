#!/usr/bin/env bash
# Переименование action1→action, execution_days1→execution_days (удаление дублей)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="$ROOT/venv/bin/python"

echo "=== Миграция БД ==="
"$PY" -m app.migrations.apply

echo "=== Проверка колонок ==="
"$PY" << 'PYEOF'
from sqlalchemy import inspect
from app.database import engine
from app.models import ProjectStatus

cols = {c["name"] for c in inspect(engine).get_columns("project_statuses")}
for need in ("action", "execution_days"):
    assert need in cols, f"Нет колонки {need}"
for gone in ("action1", "execution_days1"):
    assert gone not in cols, f"Старая колонка {gone} ещё есть"
print("OK: action, execution_days в PostgreSQL")

from app.database import SessionLocal
db = SessionLocal()
row = db.query(ProjectStatus).filter(ProjectStatus.id == 7).first()
if row:
    print(f"id=7: action={row.action!r} execution_days={row.execution_days!r}")
db.close()
PYEOF

echo "Готово. Перезапуск: sudo systemctl restart smetadoma05"
echo "Фронт: cd frontend && npm run build"
