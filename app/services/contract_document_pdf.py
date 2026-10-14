# -*- coding: utf-8 -*-
"""PDF договоров проекта: HTML + плейсхолдеры + подписи (footer) на каждой странице."""
from __future__ import annotations

import re
from types import SimpleNamespace
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.models import Customer, Project
from app.services import contract_template as template_service
from app.services import organization as organization_service
from app.services import project as project_service
from app.services import project_contract_data as contract_data_service
from app.services.contract_appendix_parts import (
    appendix2_specs_content_for_project,
    appendix_parts_table_for_project,
    appendix_photos_for_project,
    appendix_specs_blocks_for_project,
)
from app.services.contract_placeholders import apply_placeholders
from app.services.customer import compute_full_name
from app.services.html_to_pdf import html_to_pdf_bytes
from app.services import project_contract_document as document_service
from app.services import specification as spec_service
from app.services.project_contract_data import _is_kp_approved
from app.services.kp_landscape_assets import _kp_table_compact_css

PDF_MARGINS = {
    "top": "15mm",
    "right": "15mm",
    "bottom": "28mm",
    "left": "15mm",
}

PDF_MARGINS_NO_FOOTER = {
    "top": "15mm",
    "right": "15mm",
    "bottom": "15mm",
    "left": "15mm",
}

SignatureLayoutMode = Literal["playwright_footer", "inline_footer", "none"]

_INLINE_FOOTER_RE = re.compile(r"""class\s*=\s*['"]footer['"]""", re.I)


def _margin_bottom_mm(margin: str) -> float:
    s = (margin or "").strip().lower()
    if s.endswith("mm"):
        try:
            return float(s[:-2].strip())
        except ValueError:
            pass
    return 28.0


def _strip_playwright_footer_from_last_page(pdf_bytes: bytes, *, bottom_margin_mm: float) -> bytes:
    """Закрывает footer Playwright белым прямоугольником на последней странице."""
    from io import BytesIO

    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas

    reader = PdfReader(BytesIO(pdf_bytes))
    if not reader.pages:
        return pdf_bytes

    last_idx = len(reader.pages) - 1
    cover_h_pt = (bottom_margin_mm + 4) * 72 / 25.4

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i == last_idx:
            w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)
            packet = BytesIO()
            c = canvas.Canvas(packet, pagesize=(w, page_h))
            c.setFillColorRGB(1, 1, 1)
            c.setStrokeColorRGB(1, 1, 1)
            c.rect(0, 0, w, cover_h_pt, fill=1, stroke=0)
            c.save()
            packet.seek(0)
            page.merge_page(PdfReader(packet).pages[0])
        writer.add_page(page)

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _resolve_signature_layout(body_html: str, footer_html: str) -> SignatureLayoutMode:
    """
    Режим подписей в PDF:
    - inline_footer: в теле есть <div class="footer"> — фиксированный блок в HTML
    - playwright_footer: шаблон footer (contract_templates, code=footer) — колонтитул на каждой странице
    """
    body = body_html or ""
    footer = (footer_html or "").strip()
    if _INLINE_FOOTER_RE.search(body):
        return "inline_footer"
    if footer:
        return "playwright_footer"
    return "none"


INLINE_FOOTER_PRINT_CSS = """
@media print {
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: table !important;
    width: 100%;
    font-size: 9pt;
    color: #000;
    font-family: Arial, 'DejaVu Sans', sans-serif;
    padding: 4px 15px;
    background: #fff;
  }
}
"""


def _merge_customer(customer: Customer | None, patch: dict[str, Any] | None) -> Customer | SimpleNamespace | None:
    if not customer and not patch:
        return None
    if not customer:
        p = dict(patch or {})
        if p:
            p["full_name"] = compute_full_name(
                p.get("last_name"),
                p.get("name"),
                p.get("middle_name"),
            ) or (p.get("full_name") or p.get("name") or "")
        return SimpleNamespace(**p) if p else None
    if not patch:
        return customer
    merged = {c.key: getattr(customer, c.key) for c in customer.__table__.columns}
    merged.update(patch)
    merged["full_name"] = compute_full_name(
        merged.get("last_name"),
        merged.get("name"),
        merged.get("middle_name"),
    ) or (merged.get("full_name") or merged.get("name") or "")
    return SimpleNamespace(**merged)


CONTRACT_LAYOUT_TABLE_CSS = (
"""
#contract1-table,
#contract-table {
  width: 100%;
  border-collapse: collapse;
  border: none !important;
  table-layout: fixed;
}
#contract1-table td,
#contract1-table th,
#contract-table td,
#contract-table th {
  border: none !important;
  padding: 2px 0;
  vertical-align: top;
}
#contract1-table td:first-child,
#contract-table td:first-child {
  text-align: left;
  width: 50%;
}
#contract1-table td:last-child,
#contract-table td:last-child {
  text-align: right;
  width: 50%;
}
#contract1-table td:nth-child(2):empty,
#contract-table td:nth-child(2):empty {
  width: 0;
  padding: 0;
}
#contract-table td {
  vertical-align: bottom;
  font-size: 9pt;
}
#appendix-tz-table,
.appendix-tz-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
#appendix-tz-table td,
#appendix-tz-table th,
.appendix-tz-table td,
.appendix-tz-table th {
  border: 1px solid #000;
  padding: 6px 8px;
  vertical-align: top;
  text-align: left;
}
#appendix-tz-table .row-title td,
.appendix-tz-table .row-title td {
  font-weight: 700;
  text-align: center;
  padding: 10px 8px;
}
#appendix-tz-table .col-label,
.appendix-tz-table .col-label,
.appendix-doc .col-label {
  width: 32%;
  font-weight: 700;
}
#appendix-tz-table .col-value,
.appendix-tz-table .col-value,
.appendix-doc .col-value {
  width: 68%;
}
.appendix-spec-block {
  width: 100%;
  margin-top: 16px;
}
.appendix-spec-block-first {
  margin-top: 0;
  page-break-before: avoid;
  break-before: avoid;
}
.appendix-spec-block:not(.appendix-spec-block-first) {
  page-break-before: always;
  break-before: page;
}
.appendix-doc > #appendix-tz-table {
  page-break-after: avoid;
  break-after: avoid;
}
.appendix-spec-block .appendix-tz-table {
  page-break-inside: auto;
  break-inside: auto;
}
.appendix-spec-block .appendix-photos {
  margin-top: 12px;
}
.appendix-doc {
  font-family: "Times New Roman", Times, "DejaVu Serif", serif;
  font-size: 12pt;
  line-height: 1.35;
  color: #000;
  width: 100%;
}
.appendix-header {
  text-align: right;
  margin: 0 0 14px 0;
}
.appendix-header p {
  margin: 0;
}
.appendix-photos {
  width: 100%;
  margin-top: 16px;
}
.appendix-photo {
  width: 100%;
  margin: 0 0 12px 0;
  display: block;
  page-break-inside: avoid;
  break-inside: avoid;
}
.appendix-photo-img {
  width: 100%;
  height: auto;
  display: block;
  max-width: 100%;
  page-break-inside: avoid;
  break-inside: avoid;
}
.appendix2-spec-section {
  width: 100%;
  margin-top: 20px;
}
.appendix2-spec-section-first {
  margin-top: 0;
}
.appendix2-spec-section:not(.appendix2-spec-section-first) {
  page-break-before: always;
  break-before: page;
}
.appendix2-spec-header {
  margin: 0 0 10px 0;
}
.appendix2-spec-title {
  margin: 0;
  font-weight: 700;
  font-size: 12pt;
  text-align: center;
}
.appendix2-spec-meta {
  margin: 6px 0 0 0;
  font-size: 11pt;
  text-align: center;
}
.appendix2-kp-table {
  margin-top: 8px;
}
"""
+ _kp_table_compact_css(ultra=False)
+ """
.appendix-doc table.kp-table th {
  background: #fff;
  color: #000;
  border: 1px solid #000;
}
.appendix-doc table.kp-table td {
  background: #fff;
  color: #000;
  border: 1px solid #000;
}
.appendix-doc .kp-part-title td {
  background: #eee;
  color: #000;
}
.appendix-doc table.kp-table tr.kp-row-warm td,
.appendix-doc table.kp-table tr.kp-row-cool td {
  background: #fff;
}
.appendix-doc .kp-total,
.appendix-doc .kp-total strong {
  color: #000;
}
"""
)


def _wrap_print_html(body: str, *, signature_layout: SignatureLayoutMode = "playwright_footer") -> str:
    extra_css = ""
    if signature_layout == "inline_footer":
        extra_css = INLINE_FOOTER_PRINT_CSS
    return (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
        "<style>"
        "body{font-family:'DejaVu Sans',Arial,sans-serif;font-size:11pt;line-height:1.35;color:#000;}"
        "table{border-collapse:collapse;width:100%;}"
        "td,th{border:1px solid #333;padding:4px 6px;}"
        f"{CONTRACT_LAYOUT_TABLE_CSS}"
        f"{extra_css}"
        "</style></head><body>"
        f"{body}"
        "</body></html>"
    )


FOOTER_LAYOUT_TABLE_STYLE_TAG = f"<style>{CONTRACT_LAYOUT_TABLE_CSS}</style>"


def _playwright_footer_template(footer_html: str) -> str:
    """Колонтитул Playwright: компактный блок на каждой странице."""
    inner = (footer_html or "").strip()
    if not inner:
        return (
            '<div style="font-size:9px;width:100%;text-align:center;">'
            '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        )
    signature_css = ""
    if "contract-table" in inner or "contract1-table" in inner:
        signature_css = FOOTER_LAYOUT_TABLE_STYLE_TAG
    wrapper_open = '<div style="font-size:9pt;width:100%;padding:0 10mm;box-sizing:border-box;">'
    wrapper_close = "</div>"
    if "<div" not in inner.lower():
        return f"{wrapper_open}{signature_css}{inner}{wrapper_close}"
    return f"{wrapper_open}{signature_css}{inner}{wrapper_close}"


def _resolve_organization(db: Session, project: Project, document_id: str):
    if document_id in ("mount_contract", "mount_works_act"):
        org_id = getattr(project, "organization_id_mount", None)
    else:
        org_id = getattr(project, "organization_id_supply", None)
    if org_id:
        return organization_service.get_by_id(db, org_id)
    return organization_service.get_default(db)


def _resolve_specification_for_contract(
    db: Session,
    project_id: int,
    specification_id: int | None = None,
):
    if specification_id is not None:
        spec = spec_service.get_by_id(db, specification_id)
        if spec and getattr(spec, "project_id", None) == project_id:
            return spec
    specs = spec_service.list_by_project(db, project_id)
    agreed = [s for s in specs if _is_kp_approved(s)]
    if agreed:
        return agreed[0]
    return specs[0] if specs else None


def _html_for_document(
    db: Session,
    project_id: int,
    document_id: str,
    html_body: str | None,
) -> str:
    if html_body and html_body.strip():
        return html_body.strip()
    document_service.validate_document_id(document_id)
    return document_service.get_html(db, project_id, document_id)


async def build_project_contract_pdf(
    db: Session,
    project_id: int,
    document_id: str,
    *,
    html_body: str | None = None,
    contract_data_patch: dict | None = None,
    customer_patch: dict[str, Any] | None = None,
    specification_id: int | None = None,
    filename: str | None = None,
) -> tuple[bytes, str]:
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise ValueError("Проект не найден")

    contract_data = contract_data_service.get_or_create_for_project(db, project_id)
    if contract_data_patch:
        contract_data = contract_data_service.update_for_project(db, project_id, **contract_data_patch)

    customer = None
    if project.customer_id:
        customer = db.query(Customer).filter(Customer.id == project.customer_id).first()
    customer_merged = _merge_customer(customer, customer_patch)

    org = _resolve_organization(db, project, document_id)
    specification = _resolve_specification_for_contract(db, project_id, specification_id)

    body_raw = _html_for_document(db, project_id, document_id, html_body)
    if not body_raw:
        raise ValueError("HTML документа пуст. Заполните шаблон или нажмите «Синхронизировать».")

    appendix_extra = {
        "appendix_parts_table": appendix_parts_table_for_project(
            db,
            project_id,
            specification_id=specification_id,
            customer=customer_merged,
            contract_data=contract_data,
            specification=specification,
            template_html=body_raw,
        ),
        "appendix_specs_blocks": appendix_specs_blocks_for_project(
            db,
            project_id,
            specification_id=specification_id,
        ),
        "appendix_photos": appendix_photos_for_project(
            db,
            project_id,
            specification_id=specification_id,
            template_html=body_raw,
        ),
        "appendix2_specs_content": appendix2_specs_content_for_project(
            db,
            project_id,
            specification_id=specification_id,
        ),
    }

    body_html = apply_placeholders(
        body_raw,
        customer=customer_merged,
        organization=org,
        contract_data=contract_data,
        specification=specification,
        extra=appendix_extra,
    )

    footer_tmpl = template_service.get_by_code(db, "footer")
    footer_raw = (footer_tmpl.body if footer_tmpl else None) or ""
    footer_html = apply_placeholders(
        footer_raw,
        customer=customer_merged,
        organization=org,
        contract_data=contract_data,
        specification=specification,
        extra=appendix_extra,
    )

    signature_layout = _resolve_signature_layout(body_html, footer_html)
    print_html = _wrap_print_html(body_html, signature_layout=signature_layout)

    footer_template = None
    pdf_margins = PDF_MARGINS_NO_FOOTER
    if signature_layout == "playwright_footer":
        footer_template = _playwright_footer_template(footer_html)
        pdf_margins = PDF_MARGINS

    pdf_bytes = await html_to_pdf_bytes(
        print_html,
        pdf_margins,
        landscape=False,
        footer_template=footer_template,
    )
    if signature_layout == "playwright_footer":
        pdf_bytes = _strip_playwright_footer_from_last_page(
            pdf_bytes,
            bottom_margin_mm=_margin_bottom_mm(PDF_MARGINS["bottom"]),
        )

    safe_name = (filename or f"dogovor_{document_id}").strip()
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"
    return pdf_bytes, safe_name
