#!/usr/bin/env python3
"""Проверка генерации «КП для клиента» (overlay PDF)."""
from __future__ import annotations

import sys
import traceback

from sqlalchemy import text

from app.database import SessionLocal
from app.services import kp_overlay_pdf


def main() -> int:
    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT id FROM specifications ORDER BY id DESC LIMIT 5")).fetchall()
        if not rows:
            print("Нет спецификаций в БД")
            return 1
        spec_id = rows[0][0]
        print(f"Тест spec_id={spec_id}")
        pdf, name = kp_overlay_pdf.build_kp_overlay_client2_pdf(db, spec_id)
        print(f"OK: {name}.pdf, {len(pdf)} bytes")
        return 0
    except Exception:
        traceback.print_exc()
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
