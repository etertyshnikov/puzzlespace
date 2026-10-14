# -*- coding: utf-8 -*-
"""Legacy-миграции (web2py). Для новой схемы используйте Alembic: alembic/README."""

from app.migrations.apply import apply_full_schema

__all__ = ["apply_full_schema"]
