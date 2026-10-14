# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.organizations import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationOut,
    build_organization_out,
)
from app.services import organization as service

router = APIRouter()


def _enrich_list(db: Session, rows: list) -> list[OrganizationOut]:
    company_ids = {r.company_id for r in rows if r.company_id is not None}
    names = service.company_names_by_ids(db, company_ids)
    return [
        build_organization_out(
            r,
            company_name=names.get(r.company_id) if r.company_id is not None else None,
        )
        for r in rows
    ]


@router.get("", response_model=list[OrganizationOut])
def list_organizations(
    skip: int = 0,
    limit: int = 100,
    company_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    rows = service.list_all(db, skip=skip, limit=limit, company_id=company_id)
    return _enrich_list(db, rows)


@router.get("/default", response_model=OrganizationOut | None)
def get_default_organization(
    company_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    row = service.get_default(db, company_id=company_id)
    if not row:
        return None
    names = service.company_names_by_ids(db, {row.company_id} if row.company_id else set())
    return build_organization_out(
        row,
        company_name=names.get(row.company_id) if row.company_id is not None else None,
    )


@router.get("/{organization_id}", response_model=OrganizationOut)
def get_organization(organization_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, organization_id)
    if not row:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    names = service.company_names_by_ids(db, {row.company_id} if row.company_id else set())
    return build_organization_out(
        row,
        company_name=names.get(row.company_id) if row.company_id is not None else None,
    )


@router.post("", response_model=OrganizationOut, status_code=201)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)):
    row = service.create(db, **payload.model_dump())
    names = service.company_names_by_ids(db, {row.company_id} if row.company_id else set())
    return build_organization_out(
        row,
        company_name=names.get(row.company_id) if row.company_id is not None else None,
    )


@router.patch("/{organization_id}", response_model=OrganizationOut)
def update_organization(
    organization_id: int,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
):
    row = service.update(db, organization_id, **payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    names = service.company_names_by_ids(db, {row.company_id} if row.company_id else set())
    return build_organization_out(
        row,
        company_name=names.get(row.company_id) if row.company_id is not None else None,
    )


@router.delete("/{organization_id}", status_code=204)
def delete_organization(organization_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, organization_id):
        raise HTTPException(status_code=404, detail="Организация не найдена")
    return None
