# -*- coding: utf-8 -*-
"""HTML → PDF через Playwright (Chromium)."""
from __future__ import annotations

from playwright.async_api import async_playwright

CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--no-zygote",
    "--disable-extensions",
]


async def html_to_pdf_bytes(
    html: str,
    margins: dict[str, str],
    *,
    landscape: bool = False,
    footer_template: str | None = None,
    header_template: str | None = None,
) -> bytes:
    """Рендер HTML в PDF. footer_template — колонтитул на каждой странице (Playwright)."""
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
            if footer_template:
                pdf_kwargs["display_header_footer"] = True
                pdf_kwargs["footer_template"] = footer_template
                pdf_kwargs["header_template"] = header_template or "<div></div>"
            return await page.pdf(**pdf_kwargs)
        finally:
            await browser.close()
