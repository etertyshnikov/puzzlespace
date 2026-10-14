# -*- coding: utf-8 -*-
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crm import AuthUser, UserRole, Customer, ProjectStatus, Specification
from app.services.project_status_sla import is_overdue, remaining_seconds
from app.schemas.projects import ProjectCreate, ProjectUpdate, ProjectOut
from app.schemas.contract_document_pdf import ContractDocumentPdfRequest
from app.schemas.project_contract_documents import (
    ProjectContractDocumentOut,
    ProjectContractDocumentUpdate,
)
from app.schemas.project_contract_data import ProjectContractDataOut, ProjectContractDataUpdate
from app.services import contract_document_pdf as contract_document_pdf_service
from app.services import project as service
from app.services.project_status_display import resolve_status_action_display
from app.services import consolidated_kp as consolidated_kp_service
from app.services import project_contract_data as project_contract_data_service
from app.services import project_contract_document as project_contract_document_service
from app.services import project_contract_documents as project_contract_documents_service
from app.services.auth import get_current_user

router = APIRouter()


def _get_user_names(db: Session, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = db.query(AuthUser.id, AuthUser.first_name, AuthUser.nic).filter(AuthUser.id.in_(user_ids)).all()
    return {r.id: (r.first_name or r.nic) for r in rows}


def _specification_totals_by_project(db: Session, project_ids: list[int]) -> dict[int, float]:
    if not project_ids:
        return {}
    rows = (
        db.query(Specification.project_id, func.coalesce(func.sum(Specification.total_amount), 0))
        .filter(Specification.project_id.in_(project_ids))
        .group_by(Specification.project_id)
        .all()
    )
    out: dict[int, float] = {}
    for pid, total in rows:
        if pid is None:
            continue
        out[int(pid)] = float(total or 0)
    return out


def _enrich_projects(db: Session, projects: list) -> list[ProjectOut]:
    customer_ids = {p.customer_id for p in projects if p.customer_id}
    customer_creator_map: dict[int, int | None] = {}
    if customer_ids:
        rows = db.query(Customer.id, Customer.created_by_user_id).filter(Customer.id.in_(customer_ids)).all()
        customer_creator_map = {r.id: r.created_by_user_id for r in rows}

    user_ids = {uid for uid in customer_creator_map.values() if uid}
    names = _get_user_names(db, user_ids)

    project_ids = [p.id for p in projects]
    spec_totals = _specification_totals_by_project(db, project_ids)

    status_ids = {p.status_id for p in projects if p.status_id}
    status_by_id: dict[int, ProjectStatus] = {}
    if status_ids:
        for st in db.query(ProjectStatus).filter(ProjectStatus.id.in_(status_ids)).all():
            status_by_id[st.id] = st

    result = []
    for p in projects:
        out = ProjectOut.model_validate(p)
        creator_id = customer_creator_map.get(p.customer_id) if p.customer_id else None
        out.created_by_user_id = creator_id
        out.created_by_name = names.get(creator_id) if creator_id else None
        out.specifications_total_amount = spec_totals.get(p.id, 0.0)
        st = status_by_id.get(p.status_id) if p.status_id else None
        if st:
            exec_days = getattr(st, "execution_days", None)
            out.status_execution_days = exec_days
            try:
                out.status_action = resolve_status_action_display(st)
            except Exception:
                out.status_action = (getattr(st, "action", None) or "").strip() or None
            started = getattr(p, "status_started_at", None)
            out.status_remaining_seconds = remaining_seconds(started, exec_days)
            out.status_sla_overdue = is_overdue(started, exec_days)
        result.append(out)
    return result


@router.get("", response_model=list[ProjectOut])
def list_projects(
    customer_id: int | None = Query(None, description="Фильтр по клиенту"),
    status_id: int | None = Query(None, description="Фильтр по статусу проекта"),
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if customer_id is not None:
        projects = service.list_by_customer(db, customer_id)
    elif status_id is not None:
        projects = service.list_by_status(db, status_id, skip=skip, limit=limit)
    else:
        projects = service.list_all(db, skip=skip, limit=limit)

    from app.services.user_hierarchy import get_visible_project_ids

    visible_project_ids = get_visible_project_ids(db, user)
    if visible_project_ids is not None:
        projects = [p for p in projects if p.id in visible_project_ids]

    try:
        return _enrich_projects(db, projects)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка загрузки проектов: {exc}",
        ) from exc


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Проект не найден")
    enriched = _enrich_projects(db, [row])
    return enriched[0]


@router.get("/{project_id}/consolidated-kp")
def get_consolidated_kp(project_id: int, db: Session = Depends(get_db)):
    """Сводное КП: согласованные спецификации проекта, сгруппированные по одинаковому составу позиций."""
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    return consolidated_kp_service.get_consolidated_kp(db, project_id)


@router.get("/{project_id}/contract-data", response_model=ProjectContractDataOut)
def get_project_contract_data(project_id: int, db: Session = Depends(get_db)):
    """Данные для договора по проекту (1:1). При отсутствии создаётся пустая запись."""
    project = service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project_contract_data_service.get_or_create_for_project(db, project_id)


@router.get("/{project_id}/contract-documents", response_model=list[ProjectContractDocumentOut])
def list_project_contract_documents(project_id: int, db: Session = Depends(get_db)):
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project_contract_document_service.list_for_project(db, project_id)


@router.get(
    "/{project_id}/contract-documents/{document_id}",
    response_model=ProjectContractDocumentOut,
)
def get_project_contract_document(
    project_id: int,
    document_id: str,
    db: Session = Depends(get_db),
):
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    try:
        return project_contract_document_service.get_or_create(db, project_id, document_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch(
    "/{project_id}/contract-documents/{document_id}",
    response_model=ProjectContractDocumentOut,
)
def update_project_contract_document(
    project_id: int,
    document_id: str,
    payload: ProjectContractDocumentUpdate,
    db: Session = Depends(get_db),
):
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    try:
        return project_contract_document_service.upsert_html(
            db,
            project_id,
            document_id,
            payload.html_body,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{project_id}/contract-document-pdf")
async def post_project_contract_document_pdf(
    project_id: int,
    payload: ContractDocumentPdfRequest,
    db: Session = Depends(get_db),
):
    """PDF договора с подстановками и подписями Потребитель/Поставщик на каждой странице."""
    contract_patch = (
        payload.contract_data.model_dump(exclude_unset=True)
        if payload.contract_data
        else None
    )
    try:
        pdf_bytes, filename = await contract_document_pdf_service.build_project_contract_pdf(
            db,
            project_id,
            payload.document_id,
            html_body=payload.html_body,
            contract_data_patch=contract_patch,
            customer_patch=payload.customer,
            specification_id=payload.specification_id,
            filename=payload.filename,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка формирования PDF: {e}") from e

    encoded = quote(filename)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded}"},
    )


@router.post("/{project_id}/sync-contract-documents")
def sync_project_contract_documents(
    project_id: int,
    document_id: str | None = Query(
        None,
        description="supply_contract, supply_appendix, …; без параметра — все документы",
    ),
    overwrite: bool = Query(False, description="Перезаписать непустые поля"),
    db: Session = Depends(get_db),
):
    """Копирует HTML из шаблонов (contract_templates) в project_contract_documents."""
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    contract_data = project_contract_data_service.get_or_create_for_project(db, project_id)
    party = getattr(contract_data, "buyer_party_type", None)
    try:
        if document_id:
            html = project_contract_documents_service.copy_template_html_to_project(
                db,
                project_id,
                document_id,
                buyer_party_type=party,
                overwrite=overwrite,
            )
            if not html:
                raise HTTPException(
                    status_code=400,
                    detail=f"Шаблон для {document_id} пуст или не найден",
                )
            return {"document_id": document_id, "copied": True}
        return project_contract_documents_service.copy_all_templates_to_project(
            db,
            project_id,
            buyer_party_type=party,
            overwrite=overwrite,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/{project_id}/contract-data", response_model=ProjectContractDataOut)
def update_project_contract_data(
    project_id: int,
    payload: ProjectContractDataUpdate,
    db: Session = Depends(get_db),
):
    if not service.get_by_id(db, project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    data = payload.model_dump(exclude_unset=True)
    row = project_contract_data_service.update_for_project(db, project_id, **data)
    return row


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    data = payload.model_dump()
    data["created_by_user_id"] = user.id
    project = service.create(db, actor_user_id=user.id, **data)
    return _enrich_projects(db, [project])[0]


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    row = service.update(
        db,
        project_id,
        changed_by_user_id=user.id,
        **payload.model_dump(exclude_unset=True),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return _enrich_projects(db, [row])[0]


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    try:
        if not service.delete(db, project_id):
            raise HTTPException(status_code=404, detail="Проект не найден")
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Не удалось удалить проект: остались связанные записи в базе.",
        ) from e
    return None
