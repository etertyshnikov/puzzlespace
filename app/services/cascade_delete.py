# -*- coding: utf-8 -*-
"""Каскадное удаление связанных сущностей CRM."""
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    Project,
    ProjectContractData,
    ProjectContractDocument,
    ProjectStatusLog,
    Specification,
    SpecificationItem,
    SpecificationPhoto,
    SpecificationRequiredItem,
    UserActivityEvent,
)


def delete_specifications_bundle(db: Session, spec_ids: list[int]) -> None:
    if not spec_ids:
        return
    db.query(SpecificationRequiredItem).filter(
        SpecificationRequiredItem.spec_id.in_(spec_ids)
    ).delete(synchronize_session=False)
    db.query(SpecificationPhoto).filter(
        SpecificationPhoto.specification_id.in_(spec_ids)
    ).delete(synchronize_session=False)
    db.query(SpecificationItem).filter(
        SpecificationItem.specification_id.in_(spec_ids)
    ).delete(synchronize_session=False)
    db.query(Specification).filter(Specification.id.in_(spec_ids)).delete(synchronize_session=False)


def delete_projects_bundle(db: Session, project_ids: list[int]) -> None:
    """Проекты и всё, что на них ссылается (спецификации, договоры, логи)."""
    if not project_ids:
        return

    spec_ids = [
        sid
        for (sid,) in db.query(Specification.id)
        .filter(Specification.project_id.in_(project_ids))
        .all()
    ]
    delete_specifications_bundle(db, spec_ids)

    db.query(UserActivityEvent).filter(
        UserActivityEvent.project_id.in_(project_ids)
    ).delete(synchronize_session=False)
    db.query(ProjectContractDocument).filter(
        ProjectContractDocument.project_id.in_(project_ids)
    ).delete(synchronize_session=False)
    db.query(ProjectContractData).filter(
        ProjectContractData.project_id.in_(project_ids)
    ).delete(synchronize_session=False)
    db.query(ProjectStatusLog).filter(
        ProjectStatusLog.project_id.in_(project_ids)
    ).delete(synchronize_session=False)
    db.flush()
    db.query(Project).filter(Project.id.in_(project_ids)).delete(synchronize_session=False)


def delete_customer_bundle(db: Session, customer_id: int) -> bool:
    """Клиент и все связанные проекты и спецификации."""
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        return False

    project_ids = [
        pid
        for (pid,) in db.query(Project.id).filter(Project.customer_id == customer_id).all()
    ]
    delete_projects_bundle(db, project_ids)

    spec_ids = [
        sid
        for (sid,) in db.query(Specification.id)
        .filter(Specification.customer_id == customer_id)
        .all()
    ]
    delete_specifications_bundle(db, spec_ids)

    db.flush()
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer:
        db.delete(customer)
    return True
