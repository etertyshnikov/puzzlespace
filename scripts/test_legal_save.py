#!/usr/bin/env python3
"""Проверка сохранения legal_* в customers. Запуск: python scripts/test_legal_save.py [customer_id]"""
import sys

from sqlalchemy import inspect, text

from app.database import SessionLocal, engine
from app.migrations.apply import apply_full_schema
from app.models import Customer, Project
from app.services import customer as customer_service


def main() -> int:
    apply_full_schema()
    cols = {c["name"] for c in inspect(engine).get_columns("customers")}
    legal_cols = sorted(c for c in cols if c.startswith("legal_"))
    print("legal columns in DB:", legal_cols)
    if not legal_cols:
        print("ERROR: no legal_* columns")
        return 1

    db = SessionLocal()
    try:
        cid = int(sys.argv[1]) if len(sys.argv) > 1 else None
        if cid is None:
            p = db.query(Project).filter(Project.id == 8).first()
            if not p or not p.customer_id:
                print("Project 8 has no customer_id")
                return 1
            cid = p.customer_id
            print(f"project 8 -> customer_id={cid}")

        test_inn = "TEST-LEGAL-999"
        row = customer_service.update(
            db,
            cid,
            legal_company_name="ООО Тест Юр",
            legal_inn=test_inn,
            legal_kpp="123456789",
        )
        if not row:
            print("update returned None")
            return 1

        db.expire_all()
        again = db.query(Customer).filter(Customer.id == cid).first()
        print("after update legal_inn:", getattr(again, "legal_inn", "MISSING"))
        print("after update legal_company_name:", getattr(again, "legal_company_name", "MISSING"))

        if getattr(again, "legal_inn", None) != test_inn:
            print("FAIL: legal_inn not persisted")
            return 1
        print("OK: legal fields saved")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
