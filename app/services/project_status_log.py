# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session, aliased
from sqlalchemy import desc

from app.models import ProjectStatusLog, Project, ProjectStatus


def list_logs(
    db: Session,
    skip: int = 0,
    limit: int = 200,
    project_id: int | None = None,
) -> list[dict]:
    """Список записей лога смены статусов с подставленными именами проекта и статусов."""
    OldStatus = aliased(ProjectStatus)
    NewStatus = aliased(ProjectStatus)
    q = (
        db.query(
            ProjectStatusLog.id,
            ProjectStatusLog.project_id,
            Project.project_number,
            Project.name.label("project_name"),
            ProjectStatusLog.old_status_id,
            OldStatus.name.label("old_status_name"),
            ProjectStatusLog.new_status_id,
            NewStatus.name.label("new_status_name"),
            ProjectStatusLog.changed_at,
        )
        .select_from(ProjectStatusLog)
        .join(Project, ProjectStatusLog.project_id == Project.id)
        .outerjoin(OldStatus, ProjectStatusLog.old_status_id == OldStatus.id)
        .outerjoin(NewStatus, ProjectStatusLog.new_status_id == NewStatus.id)
        .order_by(desc(ProjectStatusLog.changed_at))
    )
    if project_id is not None:
        q = q.filter(ProjectStatusLog.project_id == project_id)
    rows = q.offset(skip).limit(limit).all()

    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "project_number": r.project_number,
            "project_name": r.project_name,
            "old_status_id": r.old_status_id,
            "old_status_name": r.old_status_name,
            "new_status_id": r.new_status_id,
            "new_status_name": r.new_status_name,
            "changed_at": r.changed_at,
        }
        for r in rows
    ]
