#!/usr/bin/env python3
"""Проверка сборки КП HTML и PDF. Запуск: cd /opt/fastapi/smetadoma05 && source venv/bin/activate && python scripts/test_kp_pdf.py"""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT = ROOT / "scripts" / "test_kp_pdf_result.txt"


def main():
    lines = []
    try:
        from app.database import SessionLocal
        from app.models import Specification
        from app.services.kp_crm_html import build_kp_crm_html

        db = SessionLocal()
        spec = db.query(Specification).order_by(Specification.id.desc()).first()
        if not spec:
            lines.append("NO_SPEC")
            OUT.write_text("\n".join(lines), encoding="utf-8")
            return
        lines.append(f"spec_id={spec.id}")
        html = build_kp_crm_html(db, spec.id)
        db.close()
        lines.append(f"html_len={len(html)}")
        lines.append(f"motion_tags={html.count('motion.')}")

        async def pdf_test():
            from playwright.async_api import async_playwright

            pw = await async_playwright().start()
            browser = await pw.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
            page = await browser.new_page()
            try:
                await page.set_content(html, wait_until="networkidle", timeout=15000)
                lines.append("networkidle=OK")
            except Exception as e:
                lines.append(f"networkidle=FAIL: {e}")
            try:
                await page.set_content(html, wait_until="load", timeout=15000)
                pdf = await page.pdf(format="A4", print_background=True)
                lines.append(f"load_pdf_ok bytes={len(pdf)}")
            except Exception as e:
                lines.append(f"load_pdf=FAIL: {e}")
            finally:
                await page.close()
                await browser.close()
                await pw.stop()

        asyncio.run(pdf_test())
    except Exception:
        import traceback

        lines.append(traceback.format_exc())

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(OUT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
