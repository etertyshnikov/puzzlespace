# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project_status_logs import ProjectStatusLogOut
from app.services import project_status_log as service

router = APIRouter()


@router.get("", response_model=list[ProjectStatusLogOut])
def list_project_status_logs(
    skip: int = 0,
    limit: int = Query(200, le=500),
    project_id: int | None = Query(None, description="Фильтр по проекту"),
    db: Session = Depends(get_db),
):
    return service.list_logs(db, skip=skip, limit=limit, project_id=project_id)
