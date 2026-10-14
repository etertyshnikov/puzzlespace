# -*- coding: utf-8 -*-
"""
Таблица project_contract_data и колонки для договоров (city, суммы и т.д.).
Без файла приложение не стартует (import в main.py).
"""
from sqlalchemy import text

from app.database import engine

# Колонки, которые могли отсутствовать в старых БД (после create_all базовой таблицы)
_PROJECT_CONTRACT_DATA_COLUMNS_PG = """
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS city VARCHAR(200);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS contract_supply_amount NUMERIC(12, 2);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS contract_supply_amount_words VARCHAR(500);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS house_kits_count INTEGER;
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS prepayment_amount NUMERIC(12, 2);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS prepayment_words VARCHAR(500);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12, 2);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS balance_words VARCHAR(500);
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS delivery_deadline DATE;
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS buyer_party_type VARCHAR(20) DEFAULT 'individual';
ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS buyer_legal_json TEXT;
"""

_SQLITE_ALTERS = [
    ("city", "ALTER TABLE project_contract_data ADD COLUMN city VARCHAR(200)"),
    ("contract_supply_amount", "ALTER TABLE project_contract_data ADD COLUMN contract_supply_amount NUMERIC(12, 2)"),
    ("contract_supply_amount_words", "ALTER TABLE project_contract_data ADD COLUMN contract_supply_amount_words VARCHAR(500)"),
    ("house_kits_count", "ALTER TABLE project_contract_data ADD COLUMN house_kits_count INTEGER"),
    ("prepayment_amount", "ALTER TABLE project_contract_data ADD COLUMN prepayment_amount NUMERIC(12, 2)"),
    ("prepayment_words", "ALTER TABLE project_contract_data ADD COLUMN prepayment_words VARCHAR(500)"),
    ("balance_amount", "ALTER TABLE project_contract_data ADD COLUMN balance_amount NUMERIC(12, 2)"),
    ("balance_words", "ALTER TABLE project_contract_data ADD COLUMN balance_words VARCHAR(500)"),
    ("delivery_deadline", "ALTER TABLE project_contract_data ADD COLUMN delivery_deadline DATE"),
    ("buyer_party_type", "ALTER TABLE project_contract_data ADD COLUMN buyer_party_type VARCHAR(20) DEFAULT 'individual'"),
    ("buyer_legal_json", "ALTER TABLE project_contract_data ADD COLUMN buyer_legal_json TEXT"),
]


def _sqlite_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def ensure_project_contract_data_columns() -> None:
    """Создать таблицу (если нет) и добавить отсутствующие колонки."""
    import app.models  # noqa: F401 — регистрация метаданных
    from app.database import Base
    from app.models import ProjectContractData

    Base.metadata.create_all(bind=engine, tables=[ProjectContractData.__table__])

    dialect = engine.dialect.name
    if dialect == "postgresql":
        with engine.begin() as conn:
            for stmt in _PROJECT_CONTRACT_DATA_COLUMNS_PG.strip().split(";"):
                s = stmt.strip()
                if s:
                    conn.execute(text(s))
        return

    if dialect == "sqlite":
        with engine.connect() as conn:
            existing = _sqlite_columns(conn, "project_contract_data")
            for col_name, stmt in _SQLITE_ALTERS:
                if col_name not in existing:
                    conn.execute(text(stmt))
            conn.commit()


if __name__ == "__main__":
    ensure_project_contract_data_columns()
    print("project_contract_data — OK")
