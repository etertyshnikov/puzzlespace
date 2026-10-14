#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Добавить недостающие колонки в таблицу nomenclature_items.
Запуск из корня проекта: python -m scripts.add_nomenclature_items_columns
или: cd /opt/fastapi/smetadoma03 && python scripts/add_nomenclature_items_columns.py
"""
import sys
from pathlib import Path

# Добавить корень проекта в path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from sqlalchemy import text
from app.database import engine


def main():
    with engine.begin() as conn:
        for stmt in [
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS part_id INTEGER REFERENCES parts(id)",
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES nomenclature_items(id)",
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS item_date DATE",
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS name VARCHAR(200)",
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS unit_alt VARCHAR(100)",
            "ALTER TABLE nomenclature_items ADD COLUMN IF NOT EXISTS price_alt NUMERIC(10,2)",
            "CREATE INDEX IF NOT EXISTS ix_nomenclature_items_part_id ON nomenclature_items(part_id)",
            "CREATE INDEX IF NOT EXISTS ix_nomenclature_items_parent_id ON nomenclature_items(parent_id)",
        ]:
            conn.execute(text(stmt))
    print("Колонки part_id, parent_id, item_date, name добавлены (или уже существуют).")


if __name__ == "__main__":
    main()
