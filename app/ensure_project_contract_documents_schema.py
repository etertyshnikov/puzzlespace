# -*- coding: utf-8 -*-
"""Таблица project_contract_documents и перенос HTML из projects.dogovor*."""
from __future__ import annotations

from sqlalchemy import text

from app.database import engine

_CREATE_TABLE_PG = """
CREATE TABLE IF NOT EXISTS project_contract_documents (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id VARCHAR(50) NOT NULL,
    html_body TEXT,
    created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    modified_on TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT uq_project_contract_documents_project_doc UNIQUE (project_id, document_id)
);
CREATE INDEX IF NOT EXISTS ix_project_contract_documents_project_id
    ON project_contract_documents (project_id);
"""

_CREATE_TABLE_SQLITE = """
CREATE TABLE IF NOT EXISTS project_contract_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id VARCHAR(50) NOT NULL,
    html_body TEXT,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, document_id)
);
"""

_LEGACY_MIGRATIONS: tuple[tuple[str, str], ...] = (
    ("supply_contract", "dogovor"),
    ("supply_appendix", "dogovor_supply_appendix"),
    ("supply_acceptance_act", "dogovor_supply_acceptance_act"),
    ("mount_contract", "dogovor_mount"),
    ("mount_works_act", "dogovor_mount_works_act"),
)


def _table_exists(conn, table: str) -> bool:
    dialect = conn.dialect.name
    if dialect == "postgresql":
        r = conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :t"
            ),
            {"t": table},
        ).first()
        return r is not None
    rows = conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")).fetchall()
    return bool(rows)


def _column_exists(conn, table: str, column: str) -> bool:
    dialect = conn.dialect.name
    if dialect == "postgresql":
        r = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).first()
        return r is not None
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def _migrate_legacy_columns(conn) -> None:
    if not _table_exists(conn, "projects"):
        return
    for document_id, column in _LEGACY_MIGRATIONS:
        if not _column_exists(conn, "projects", column):
            continue
        conn.execute(
            text(
                f"""
                INSERT INTO project_contract_documents (project_id, document_id, html_body, created_on, modified_on)
                SELECT p.id, :document_id, p.{column}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM projects p
                WHERE p.{column} IS NOT NULL AND TRIM(CAST(p.{column} AS TEXT)) <> ''
                AND NOT EXISTS (
                    SELECT 1 FROM project_contract_documents d
                    WHERE d.project_id = p.id AND d.document_id = :document_id
                )
                """
            ),
            {"document_id": document_id},
        )


def ensure_project_contract_documents_schema() -> None:
    dialect = engine.dialect.name
    if dialect == "postgresql":
        with engine.begin() as conn:
            for stmt in _CREATE_TABLE_PG.strip().split(";"):
                s = stmt.strip()
                if s:
                    conn.execute(text(s))
            _migrate_legacy_columns(conn)
        return

    if dialect == "sqlite":
        with engine.begin() as conn:
            conn.execute(text(_CREATE_TABLE_SQLITE))
            _migrate_legacy_columns(conn)


if __name__ == "__main__":
    ensure_project_contract_documents_schema()
    print("project_contract_documents schema — OK")
