# -*- coding: utf-8 -*-
"""Копирование HTML из contract_templates в project_contract_documents."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.services import contract_template as template_service
from app.services import project as project_service
from app.services import project_contract_document as document_service

ALL_DOCUMENT_IDS = document_service.ALL_DOCUMENT_IDS


def template_code_for_document(document_id: str, buyer_party_type: str | None) -> str:
    document_id = document_service.validate_document_id(document_id)
    party = (buyer_party_type or "individual").strip().lower()
    if document_id == "supply_contract":
        return "dogovor_postavki_ur" if party == "legal" else "dogovor_postavki_fiz"
    if document_id == "mount_contract":
        return "mount"
    if document_id == "supply_appendix":
        return "dogovor_postavki_appendix"
    if document_id == "supply_appendix_2":
        return "dogovor_postavki_appendix_2"
    return document_id


def copy_template_html_to_project(
    db: Session,
    project_id: int,
    document_id: str,
    *,
    buyer_party_type: str | None = None,
    overwrite: bool = False,
) -> str | None:
    document_id = document_service.validate_document_id(document_id)

    project = project_service.get_by_id(db, project_id)
    if not project:
        raise ValueError("Проект не найден")

    code = template_code_for_document(document_id, buyer_party_type)
    tmpl = template_service.get_by_code(db, code)
    if not tmpl or not (tmpl.body or "").strip():
        return None

    current = document_service.get_html(db, project_id, document_id)
    if current and not overwrite:
        return current

    html = tmpl.body or ""
    document_service.upsert_html(db, project_id, document_id, html)
    return html


def copy_all_templates_to_project(
    db: Session,
    project_id: int,
    *,
    buyer_party_type: str | None = None,
    overwrite: bool = False,
) -> dict[str, bool]:
    result: dict[str, bool] = {}
    for document_id in ALL_DOCUMENT_IDS:
        try:
            html = copy_template_html_to_project(
                db,
                project_id,
                document_id,
                buyer_party_type=buyer_party_type,
                overwrite=overwrite,
            )
            result[document_id] = bool(html and html.strip())
        except ValueError:
            result[document_id] = False
    return result
