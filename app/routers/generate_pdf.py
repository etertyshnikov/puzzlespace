# -*- coding: utf-8 -*-
"""Endpoint for HTML-to-PDF generation using Playwright (Chromium)."""
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from playwright.async_api import async_playwright

from app.services.kp_landscape_assets import is_client_table_only_kp_html
from app.services.pdf_kp_background import apply_kp_page_background

router = APIRouter()

# Флаги для стабильного запуска в WSL/Docker и под root
CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--no-zygote",
    "--disable-extensions",
]


class PdfRequest(BaseModel):
    html: str
    filename: str | None = None
    landscape: bool | None = None
    margin_top: str | None = None
    margin_bottom: str | None = None
    margin_left: str | None = None
    margin_right: str | None = None


def _detect_landscape(html: str, explicit: bool | None) -> bool:
    if explicit is not None:
        return explicit
    return "<!-- kp-layout:landscape -->" in (html or "")


async def _html_to_pdf_bytes(html: str, margins: dict[str, str], *, landscape: bool = False) -> bytes:
    """Новый браузер на каждый запрос — надёжнее, чем общий экземпляр (не падает «browser has been closed»)."""
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
        try:
            page = await browser.new_page()
            await page.set_content(html, wait_until="load", timeout=30000)
            pdf_kwargs: dict = {
                "format": "A4",
                "landscape": landscape,
                "print_background": True,
                "margin": margins,
            }
            return await page.pdf(**pdf_kwargs)
        finally:
            await browser.close()


@router.post("")
async def html_to_pdf(payload: PdfRequest):
    """Accepts an HTML string, renders it in Chromium and returns a PDF file."""
    landscape = _detect_landscape(payload.html, payload.landscape)
    default_margin = "0" if landscape else "10mm"
    margins = {
        "top": payload.margin_top if payload.margin_top is not None else default_margin,
        "bottom": payload.margin_bottom if payload.margin_bottom is not None else default_margin,
        "left": payload.margin_left if payload.margin_left is not None else default_margin,
        "right": payload.margin_right if payload.margin_right is not None else default_margin,
    }
    try:
        pdf_bytes = await _html_to_pdf_bytes(payload.html, margins, landscape=landscape)
        # Подложка: не для варианта «только таблица» (КП для клиента)
        if (
            landscape
            and not is_client_table_only_kp_html(payload.html or "")
            and "data:image/png;base64" not in (payload.html or "")
        ):
            pdf_bytes = apply_kp_page_background(pdf_bytes)
    except Exception as exc:
        msg = str(exc)
        if "Executable doesn't exist" in msg or "browserType.launch" in msg.lower():
            msg = (
                f"{msg}. Выполните на сервере: "
                "cd /opt/fastapi/smetadoma05 && source venv/bin/activate && "
                "playwright install chromium && playwright install-deps chromium"
            )
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {msg}") from exc

    safe_name = (payload.filename or "document") + ".pdf"
    encoded_name = quote(safe_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
        },
    )
