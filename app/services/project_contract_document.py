# -*- coding: utf-8 -*-
"""Хранение HTML договоров проекта в project_contract_documents."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ProjectContractDocument

VALID_DOCUMENT_IDS = frozenset({
    "supply_contract",
    "supply_appendix",
    "supply_appendix_2",
    "supply_acceptance_act",
    "mount_contract",
    "mount_works_act",
})

ALL_DOCUMENT_IDS = (
    "supply_contract",
    "supply_appendix",
    "supply_appendix_2",
    "supply_acceptance_act",
    "mount_contract",
    "mount_works_act",
)


def validate_document_id(document_id: str) -> str:
    doc = (document_id or "").strip()
    if doc not in VALID_DOCUMENT_IDS:
        raise ValueError(f"Неизвестный document_id: {document_id}")
    return doc


def get_row(db: Session, project_id: int, document_id: str) -> ProjectContractDocument | None:
    document_id = validate_document_id(document_id)
    return (
        db.query(ProjectContractDocument)
        .filter(
            ProjectContractDocument.project_id == project_id,
            ProjectContractDocument.document_id == document_id,
        )
        .first()
    )


def get_html(db: Session, project_id: int, document_id: str) -> str:
    row = get_row(db, project_id, document_id)
    return (row.html_body or "").strip() if row else ""


def list_for_project(db: Session, project_id: int) -> list[ProjectContractDocument]:
    return (
        db.query(ProjectContractDocument)
        .filter(ProjectContractDocument.project_id == project_id)
        .order_by(ProjectContractDocument.document_id)
        .all()
    )


def get_or_create(db: Session, project_id: int, document_id: str) -> ProjectContractDocument:
    document_id = validate_document_id(document_id)
    row = get_row(db, project_id, document_id)
    if row:
        return row
    row = ProjectContractDocument(project_id=project_id, document_id=document_id, html_body="")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def upsert_html(
    db: Session,
    project_id: int,
    document_id: str,
    html_body: str | None,
) -> ProjectContractDocument:
    document_id = validate_document_id(document_id)
    row = get_row(db, project_id, document_id)
    if not row:
        row = ProjectContractDocument(
            project_id=project_id,
            document_id=document_id,
            html_body=html_body or "",
        )
        db.add(row)
    else:
        row.html_body = html_body or ""
    db.commit()
    db.refresh(row)
    return row
