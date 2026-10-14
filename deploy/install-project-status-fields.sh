#!/usr/bin/env bash
# Колонки action / execution_days в БД + схема API (на диске WSL)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="$ROOT/venv/bin/python"

echo "=== 1. Схема project_statuses (action, execution_days в API) ==="
cat > "$ROOT/app/schemas/project_statuses.py" << 'PYEOF'
# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProjectStatusBase(BaseModel):
    name: str
    description: Optional[str] = None
    action: Optional[str] = None
    execution_days: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True


class ProjectStatusCreate(ProjectStatusBase):
    pass


class ProjectStatusUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    action: Optional[str] = None
    execution_days: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ProjectStatusOut(ProjectStatusBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
PYEOF
echo "OK: app/schemas/project_statuses.py"

echo "=== 2. Миграция БД ==="
"$PY" -m app.migrations.apply

echo "=== 3. Проверка колонок в PostgreSQL ==="
"$PY" << 'PYEOF'
from sqlalchemy import inspect, text
from app.database import engine
from app.models import ProjectStatus

insp = inspect(engine)
cols = {c["name"] for c in insp.get_columns("project_statuses")}
need = {"action", "execution_days"}
missing = need - cols
if missing:
    raise SystemExit(f"Нет колонок в project_statuses: {missing}")
print("columns OK:", sorted(need))

from app.database import SessionLocal
db = SessionLocal()
row = db.query(ProjectStatus).filter(ProjectStatus.id == 3).first()
if row:
    row.action = "__test__"
    db.commit()
    db.refresh(row)
    assert row.action == "__test__", "action not persisted"
    row.action = None
    db.commit()
    print("write/read action on id=3: OK")
db.close()
PYEOF

echo "=== 4. API schema import ==="
"$PY" -c "from app.schemas.project_statuses import ProjectStatusOut; print(ProjectStatusOut.model_fields.keys())"

echo "=== Готово. Перезапуск: sudo systemctl restart smetadoma05 ==="
