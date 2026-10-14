# -*- coding: utf-8 -*-
"""Журнал активности пользователей и агрегация для дашборда."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import AuthUser, Project, ProjectStatus, Specification, UserActivityEvent
from app.services.user_hierarchy import get_descendant_user_ids, is_director, is_manager

TZ_MOSCOW = ZoneInfo("Europe/Moscow")

EVENT_CUSTOMER_CREATED = "customer_created"
EVENT_PROJECT_CREATED = "project_created"
EVENT_SPECIFICATION_CREATED = "specification_created"
EVENT_KP_SENT = "kp_sent"
EVENT_CALL_AFTER_KP = "call_after_kp"
EVENT_CONTRACT_STARTED = "contract_started"

EVENT_TYPES_ORDER = [
    EVENT_CUSTOMER_CREATED,
    EVENT_PROJECT_CREATED,
    EVENT_SPECIFICATION_CREATED,
    EVENT_KP_SENT,
    EVENT_CALL_AFTER_KP,
    EVENT_CONTRACT_STARTED,
]

EVENT_TYPE_LABELS: dict[str, str] = {
    EVENT_CUSTOMER_CREATED: "Клиенты",
    EVENT_PROJECT_CREATED: "Проекты",
    EVENT_SPECIFICATION_CREATED: "Спецификации",
    EVENT_KP_SENT: "КП отправлено",
    EVENT_CALL_AFTER_KP: "Звонки",
    EVENT_CONTRACT_STARTED: "Договор",
}


def _norm(value: str | None) -> str:
    return (value or "").strip().lower().replace("\xa0", " ").replace("  ", " ")


def resolve_status_event_type(status: ProjectStatus | None) -> str | None:
    """Тип события по новому статусу проекта (как плашки на дашборде)."""
    if not status:
        return None
    name = _norm(status.name)
    action = _norm(status.action)
    if re.search(r"кп\s*отправлен", name):
        return EVENT_KP_SENT
    if re.search(r"позвон", action):
        return EVENT_CALL_AFTER_KP
    if re.search(r"составить", action) and re.search(r"договор", action):
        return EVENT_CONTRACT_STARTED
    if re.search(r"состав", name) and re.search(r"договор", name):
        return EVENT_CONTRACT_STARTED
    return None


def log_event(
    db: Session,
    user_id: int | None,
    event_type: str,
    *,
    entity_type: str | None = None,
    entity_id: int | None = None,
    project_id: int | None = None,
    meta: dict | None = None,
    occurred_at: datetime | None = None,
) -> None:
    if not user_id:
        return
    row = UserActivityEvent(
        user_id=user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        project_id=project_id,
        meta_json=json.dumps(meta, ensure_ascii=False) if meta else None,
        occurred_at=occurred_at or datetime.utcnow(),
    )
    db.add(row)


def log_status_change(
    db: Session,
    user_id: int | None,
    project_id: int,
    new_status_id: int,
    *,
    old_status_id: int | None = None,
) -> None:
    if not user_id:
        return
    status = db.query(ProjectStatus).filter(ProjectStatus.id == new_status_id).first()
    event_type = resolve_status_event_type(status)
    if not event_type:
        return
    log_event(
        db,
        user_id,
        event_type,
        entity_type="project",
        entity_id=project_id,
        project_id=project_id,
        meta={"old_status_id": old_status_id, "new_status_id": new_status_id},
    )


def moscow_day_bounds(day: date) -> tuple[datetime, datetime]:
    """Границы календарного дня по Москве в naive UTC (как в БД)."""
    start_local = datetime.combine(day, time.min, tzinfo=TZ_MOSCOW)
    end_local = start_local + timedelta(days=1)
    utc = timezone.utc
    return (
        start_local.astimezone(utc).replace(tzinfo=None),
        end_local.astimezone(utc).replace(tzinfo=None),
    )


def get_activity_agent_ids(db: Session, user: AuthUser) -> list[int]:
    """Агенты, по которым строится отчёт для текущего пользователя."""
    if is_director(user, db):
        rows = (
            db.query(AuthUser.id)
            .filter(AuthUser.hierarchy_level == 2)
            .order_by(AuthUser.id)
            .all()
        )
        return [int(r[0]) for r in rows]
    if is_manager(user, db):
        descendant_ids = get_descendant_user_ids(db, user.id)
        descendant_ids.discard(user.id)
        if not descendant_ids:
            return []
        rows = (
            db.query(AuthUser.id)
            .filter(AuthUser.id.in_(descendant_ids), AuthUser.hierarchy_level == 2)
            .order_by(AuthUser.id)
            .all()
        )
        return [int(r[0]) for r in rows]
    return [user.id]


def _member_display_name(user: AuthUser) -> str:
    name = " ".join(p for p in (user.first_name, user.last_name) if p).strip()
    return name or user.nic


def aggregate_team_activity(
    db: Session,
    viewer: AuthUser,
    *,
    day: date,
) -> dict:
    agent_ids = get_activity_agent_ids(db, viewer)
    start_utc, end_utc = moscow_day_bounds(day)

    agents: list[AuthUser] = []
    if agent_ids:
        agents = (
            db.query(AuthUser)
            .filter(AuthUser.id.in_(agent_ids))
            .order_by(AuthUser.first_name, AuthUser.last_name, AuthUser.nic)
            .all()
        )

    counts_map: dict[int, dict[str, int]] = {aid: {} for aid in agent_ids}
    if agent_ids:
        rows = (
            db.query(
                UserActivityEvent.user_id,
                UserActivityEvent.event_type,
                func.count(UserActivityEvent.id),
            )
            .filter(
                UserActivityEvent.user_id.in_(agent_ids),
                UserActivityEvent.occurred_at >= start_utc,
                UserActivityEvent.occurred_at < end_utc,
            )
            .group_by(UserActivityEvent.user_id, UserActivityEvent.event_type)
            .all()
        )
        for user_id, event_type, cnt in rows:
            counts_map.setdefault(int(user_id), {})[str(event_type)] = int(cnt)

    team_totals: dict[str, int] = {}
    agent_rows = []
    for agent in agents:
        counts = counts_map.get(agent.id, {})
        total = sum(counts.values())
        for et, c in counts.items():
            team_totals[et] = team_totals.get(et, 0) + c
        agent_rows.append(
            {
                "user_id": agent.id,
                "name": _member_display_name(agent),
                "counts": counts,
                "total": total,
            }
        )

    return {
        "date": day.isoformat(),
        "event_types": [
            {"code": code, "label": EVENT_TYPE_LABELS.get(code, code)}
            for code in EVENT_TYPES_ORDER
        ],
        "agents": agent_rows,
        "team_totals": team_totals,
        "agents_count": len(agent_rows),
    }


def list_activity_details(
    db: Session,
    viewer: AuthUser,
    *,
    user_id: int,
    event_type: str,
    day: date,
    limit: int = 100,
) -> list[dict]:
    allowed_ids = set(get_activity_agent_ids(db, viewer))
    if user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Нет доступа к активности этого пользователя")
    if event_type not in EVENT_TYPE_LABELS:
        raise HTTPException(status_code=400, detail="Неизвестный тип события")

    start_utc, end_utc = moscow_day_bounds(day)
    rows = (
        db.query(UserActivityEvent)
        .filter(
            UserActivityEvent.user_id == user_id,
            UserActivityEvent.event_type == event_type,
            UserActivityEvent.occurred_at >= start_utc,
            UserActivityEvent.occurred_at < end_utc,
        )
        .order_by(UserActivityEvent.occurred_at.desc())
        .limit(limit)
        .all()
    )

    project_ids = {r.project_id for r in rows if r.project_id}
    projects_by_id: dict[int, Project] = {}
    if project_ids:
        for p in db.query(Project).filter(Project.id.in_(project_ids)).all():
            projects_by_id[p.id] = p

    spec_ids = {
        r.entity_id for r in rows if r.entity_type == "specification" and r.entity_id
    }
    specs_by_id: dict[int, Specification] = {}
    if spec_ids:
        for s in db.query(Specification).filter(Specification.id.in_(spec_ids)).all():
            specs_by_id[s.id] = s

    result = []
    for row in rows:
        project = projects_by_id.get(row.project_id) if row.project_id else None
        label = EVENT_TYPE_LABELS.get(row.event_type, row.event_type)
        if row.entity_type == "specification" and row.entity_id:
            spec = specs_by_id.get(row.entity_id)
            if spec and spec.number:
                label = f"Спецификация {spec.number}"
        elif project:
            pn = (project.project_number or "").strip()
            pname = (project.name or "").strip()
            label = f"{pn} {pname}".strip() or f"Проект #{project.id}"

        result.append(
            {
                "id": row.id,
                "occurred_at": row.occurred_at,
                "event_type": row.event_type,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "project_id": row.project_id,
                "label": label,
                "project_number": project.project_number if project else None,
                "project_name": project.name if project else None,
            }
        )
    return result
