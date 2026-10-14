# -*- coding: utf-8 -*-
from datetime import date, datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_serializer


def _serialize_utc(dt: datetime | None) -> str | None:
    """Сериализуем naive datetime из БД как UTC (с Z), чтобы фронт показывал в местном времени."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace('+00:00', 'Z')


class ProjectBase(BaseModel):
    name: str
    customer_id: Optional[int] = None
    project_number: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status_id: Optional[int] = None
    status_started_at: Optional[datetime] = None
    budget: Optional[float] = None
    total_amount: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    organization_id_supply: Optional[int] = None
    organization_id_mount: Optional[int] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    customer_id: Optional[int] = None
    project_number: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status_id: Optional[int] = None
    budget: Optional[float] = None
    total_amount: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    organization_id_supply: Optional[int] = None
    organization_id_mount: Optional[int] = None


class ProjectOut(ProjectBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None
    specifications_total_amount: Optional[float] = Field(
        default=None,
        description="Сумма total_amount по всем спецификациям проекта (для дашборда).",
    )
    status_execution_days: Optional[int] = Field(
        default=None,
        description="Срок исполнения текущего статуса (дней), из project_statuses.",
    )
    status_remaining_seconds: Optional[int] = Field(
        default=None,
        description="Осталось секунд до конца срока статуса (0 если просрочено).",
    )
    status_sla_overdue: Optional[bool] = Field(
        default=None,
        description="True, если срок исполнения текущего статуса истёк.",
    )
    status_action: Optional[str] = Field(
        default=None,
        description="Действие из project_statuses.action (с fallback по названию статуса).",
    )

    model_config = {"from_attributes": True}

    @field_serializer("status_started_at", "created_on", "modified_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        return _serialize_utc(dt)
