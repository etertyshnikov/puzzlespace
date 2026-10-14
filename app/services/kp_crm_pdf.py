# -*- coding: utf-8 -*-
"""PDF коммерческого предложения из HTML CRM (Playwright)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.html_to_pdf import html_to_pdf_bytes
from app.services.kp_crm_html import build_kp_crm_html
from app.services.kp_landscape_assets import is_client_table_only_kp_html, is_landscape_kp_html


async def build_kp_crm_pdf(
    db: Session,
    specification_id: int,
    *,
    client_table_only: bool = False,
) -> bytes:
    html = build_kp_crm_html(db, specification_id, client_table_only=client_table_only)
    landscape = is_landscape_kp_html(html)
    table_only = is_client_table_only_kp_html(html)
    margins = {
        "top": "6mm" if table_only else ("0" if landscape else "10mm"),
        "bottom": "6mm" if table_only else ("0" if landscape else "10mm"),
        "left": "6mm" if table_only else ("0" if landscape else "10mm"),
        "right": "6mm" if table_only else ("0" if landscape else "10mm"),
    }
    return await html_to_pdf_bytes(html, margins, landscape=landscape)
