# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from app.models import ProjectStatus

_UPDATE_FIELDS = frozenset({
    "name",
    "description",
    "action",
    "execution_days",
    "sort_order",
    "is_active",
})


def list_all(db: Session) -> list[ProjectStatus]:
    return (
        db.query(ProjectStatus)
        .order_by(ProjectStatus.sort_order.asc(), ProjectStatus.id.asc())
        .all()
    )


def get_by_id(db: Session, status_id: int) -> ProjectStatus | None:
    return db.query(ProjectStatus).filter(ProjectStatus.id == status_id).first()


def create(db: Session, **data) -> ProjectStatus:
    obj = ProjectStatus(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, status_id: int, **data) -> ProjectStatus | None:
    row = db.query(ProjectStatus).filter(ProjectStatus.id == status_id).first()
    if not row:
        return None
    for k, v in data.items():
        if k in _UPDATE_FIELDS:
            setattr(row, k, v)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(row)
    return row


def delete(db: Session, status_id: int) -> bool:
    row = db.query(ProjectStatus).filter(ProjectStatus.id == status_id).first()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


_DEFAULT_STATUS_ROWS: list[tuple[str, str | None, int]] = [
    ("Новый", "Проект только создан", 0),
    ("В работе", None, 10),
    ("Завершён", None, 20),
]


def ensure_default_statuses_seeded(db: Session) -> None:
    """Если в project_statuses нет записей — добавить базовый набор (автопроект при создании клиента)."""
    if db.query(ProjectStatus).first() is not None:
        return
    for name, description, sort_order in _DEFAULT_STATUS_ROWS:
        db.add(
            ProjectStatus(
                name=name,
                description=description,
                sort_order=sort_order,
                is_active=True,
            )
        )
    db.commit()
