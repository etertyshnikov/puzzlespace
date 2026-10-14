#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка входа: пользователи в БД, схема auth_user, тест пароля."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from sqlalchemy import inspect, text

from app.config import get_settings
from app.database import engine
from app.models.crm import AuthUser
from app.services.auth import verify_password
from app.services.auth_lookup import find_user_by_login_or_email


def main() -> int:
    settings = get_settings()
    db_name = engine.url.database
    print(f"DB_URI database: {db_name}")

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Подключение к БД: OK")
    except Exception as e:
        print(f"Подключение к БД: FAIL — {e}")
        return 1

    insp = inspect(engine)
    if "auth_user" not in insp.get_table_names():
        print("Таблица auth_user: ОТСУТСТВУЕТ — выполните bash scripts/migrate-apply.sh")
        return 1

    model_cols = {c.name for c in AuthUser.__table__.columns}
    db_cols = {c["name"] for c in insp.get_columns("auth_user")}
    missing = model_cols - db_cols
    if missing:
        print(f"В auth_user нет колонок из модели: {sorted(missing)}")
        print("→ bash scripts/migrate-apply.sh или догоняющая миграция")
    else:
        print("Колонки auth_user: OK")

    from app.database import SessionLocal

    db = SessionLocal()
    try:
        count = db.query(AuthUser).count()
        print(f"Пользователей в auth_user: {count}")
        if count == 0:
            print("→ БД пустая: откройте /setup или перенесите данные (db-migrate-from-05.sh)")
            return 1

        for u in db.query(AuthUser).order_by(AuthUser.id).limit(10):
            pw = "да" if u.password else "НЕТ"
            print(f"  id={u.id} nic={u.nic!r} email={u.email!r} password={pw}")

        ident = (os.environ.get("CHECK_LOGIN") or "").strip()
        pwd = os.environ.get("CHECK_PASSWORD") or ""
        if ident:
            user = find_user_by_login_or_email(db, ident)
            if not user:
                print(f"Пользователь {ident!r}: НЕ НАЙДЕН")
                return 1
            if not user.password:
                print(f"Пользователь {ident!r}: password пустой в БД")
                return 1
            if pwd:
                ok = verify_password(pwd, user.password)
                print(f"Проверка пароля для {ident!r}: {'OK' if ok else 'НЕВЕРНЫЙ'}")
            else:
                print(f"Пользователь {ident!r}: найден (id={user.id}). Задайте CHECK_PASSWORD для проверки пароля.")
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
