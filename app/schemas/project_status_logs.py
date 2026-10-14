# -*- coding: utf-8 -*-
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_serializer


def _serialize_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        from datetime import timezone
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


class ProjectStatusLogOut(BaseModel):
    id: int
    project_id: int
    project_number: Optional[str] = None
    project_name: Optional[str] = None
    old_status_id: Optional[int] = None
    old_status_name: Optional[str] = None
    new_status_id: Optional[int] = None
    new_status_name: Optional[str] = None
    changed_at: datetime

    model_config = {"from_attributes": False}

    @field_serializer("changed_at")
    def _serialize_changed_at(self, dt: datetime) -> str:
        out = _serialize_utc(dt)
        return out or ""
