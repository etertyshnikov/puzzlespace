# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.companies import CompanyCreate, CompanyUpdate, CompanyOut
from app.schemas.organizations import OrganizationOut, build_organization_out
from app.services import company as service
from app.services import organization as organization_service

router = APIRouter()


@router.get("", response_model=list[CompanyOut])
def list_companies(skip: int = 0, limit: int = 500, db: Session = Depends(get_db)):
    return service.list_all(db, skip=skip, limit=limit)


@router.get("/{company_id}/organizations", response_model=list[OrganizationOut])
def list_company_organizations(company_id: int, db: Session = Depends(get_db)):
    if not service.get_by_id(db, company_id):
        raise HTTPException(status_code=404, detail="Компания не найдена")
    rows = service.list_organizations(db, company_id)
    names = organization_service.company_names_by_ids(db, {company_id})
    return [
        build_organization_out(row, company_name=names.get(company_id))
        for row in rows
    ]


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, db: Session = Depends(get_db)):
    row = service.get_by_id(db, company_id)
    if not row:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return row


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("code") == "":
        data["code"] = None
    return service.create(db, **data)


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] == "":
        data["code"] = None
    row = service.update(db, company_id, **data)
    if not row:
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return row


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: int, db: Session = Depends(get_db)):
    if not service.delete(db, company_id):
        raise HTTPException(status_code=404, detail="Компания не найдена")
    return None
