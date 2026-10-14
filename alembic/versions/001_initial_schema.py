# -*- coding: utf-8 -*-
"""Начальная схема CRM из SQLAlchemy-моделей (app/models/crm.py).

Если таблицы уже созданы через create_all:
  python -m alembic stamp head
Иначе:
  bash scripts/migrate-apply.sh
"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _metadata():
    import app.models  # noqa: F401
    from app.database import Base

    return Base.metadata


def upgrade() -> None:
    bind = op.get_bind()
    _metadata().create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    meta = _metadata()
    for table in reversed(meta.sorted_tables):
        table.drop(bind=bind, checkfirst=True)
