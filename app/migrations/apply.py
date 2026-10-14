# -*- coding: utf-8 -*-
"""
Единая идемпотентная миграция схемы smetadoma05.

Порядок:
1. SQLAlchemy create_all (все модели)
2. DDL PostgreSQL (колонки/таблицы для старых БД)
3. Пост-миграции (переименования, перенос данных, иерархия, роли)
4. Начальные записи companies/organizations

Запуск вручную: python -m app.migrations.apply
Вызывается при старте FastAPI (main.py lifespan).
"""
from __future__ import annotations

import logging

from sqlalchemy import text

from app.database import Base, engine
from app.migrations.ddl_postgresql import MIGRATION_ID, MIGRATION_STATEMENTS
from app.migrations.post_ddl import (
    rename_project_status_columns,
    run_post_migrate_scripts,
    seed_companies_organizations,
)

logger = logging.getLogger(__name__)


def _exec_ddl_postgresql() -> None:
    with engine.begin() as conn:
        for stmt in MIGRATION_STATEMENTS:
            sql = stmt.strip()
            if sql:
                conn.execute(text(sql))


def _record_migration() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO schema_migrations (id, description, applied_at)
                VALUES (:id, :desc, NOW())
                ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at
                """
            ),
            {
                "id": MIGRATION_ID,
                "desc": "Полная схема: таблицы и колонки CRM (идемпотентно)",
            },
        )


def _post_ddl_migrations() -> None:
    from app.ensure_project_contract_documents_schema import ensure_project_contract_documents_schema

    rename_project_status_columns()
    ensure_project_contract_documents_schema()
    run_post_migrate_scripts()


def _apply_sqlite_legacy() -> None:
    """Минимальный путь для SQLite (dev/tests)."""
    from app.ensure_project_contract_data_schema import ensure_project_contract_data_columns
    from app.ensure_project_contract_documents_schema import ensure_project_contract_documents_schema

    rename_project_status_columns()
    ensure_project_contract_data_columns()
    ensure_project_contract_documents_schema()


def apply_full_schema() -> None:
    """Применить полную схему (идемпотентно)."""
    import app.models  # noqa: F401 — регистрация моделей

    Base.metadata.create_all(bind=engine)
    dialect = engine.dialect.name

    if dialect == "postgresql":
        _exec_ddl_postgresql()
        _post_ddl_migrations()
        seed_companies_organizations()
        _record_migration()
        logger.info("schema migration %s applied (postgresql)", MIGRATION_ID)
        return

    if dialect == "sqlite":
        _apply_sqlite_legacy()
        logger.info("schema migration applied (sqlite legacy path)")
        return

    logger.warning("schema migration: unsupported dialect %s, only create_all", dialect)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    apply_full_schema()
    print(f"OK: migration {MIGRATION_ID}")


if __name__ == "__main__":
    main()
