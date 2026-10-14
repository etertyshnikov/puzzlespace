#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сверка колонок модели ProjectStatus с таблицей project_statuses в БД."""
from sqlalchemy import inspect

from app.database import engine
from app.models import ProjectStatus

MODEL_COLUMNS = {
    c.key: str(c.type) for c in inspect(ProjectStatus).columns
}


def main() -> int:
    insp = inspect(engine)
    if not insp.has_table("project_statuses"):
        print("ERROR: таблица project_statuses не найдена в БД")
        return 1

    db_cols = {c["name"]: str(c["type"]) for c in insp.get_columns("project_statuses")}
    model_names = set(MODEL_COLUMNS)
    db_names = set(db_cols)

    missing_in_db = sorted(model_names - db_names)
    extra_in_db = sorted(db_names - model_names)

    print(f"DB: {engine.url.render_as_string(hide_password=True)}")
    print(f"Диалект: {engine.dialect.name}")
    print()
    print("Модель ProjectStatus (ожидаемые колонки):")
    for name in sorted(MODEL_COLUMNS):
        mark = "OK" if name in db_names else "MISSING"
        print(f"  {name:20} {MODEL_COLUMNS[name]:30} [{mark}]")

    print()
    print("Таблица project_statuses в БД:")
    for name in sorted(db_cols):
        mark = "OK" if name in model_names else "EXTRA"
        print(f"  {name:20} {db_cols[name]:30} [{mark}]")

    if missing_in_db:
        print()
        print("НЕТ В БД (нужна миграция):", ", ".join(missing_in_db))
    if extra_in_db:
        print()
        print("Лишние в БД (не в модели):", ", ".join(extra_in_db))

    if not missing_in_db and not extra_in_db:
        print()
        print("Итог: все колонки модели есть в БД.")
        return 0

    print()
    print("Итог: расхождение — выполните: python -m app.migrations.apply")
    return 2 if missing_in_db else 0


if __name__ == "__main__":
    raise SystemExit(main())
