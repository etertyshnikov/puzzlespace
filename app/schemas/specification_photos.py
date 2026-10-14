# -*- coding: utf-8 -*-
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer


class SpecificationPhotoOut(BaseModel):
    id: int
    specification_id: Optional[int] = None
    house_specification_template_id: Optional[int] = None
    filename: Optional[str] = None
    sort_order: int = 0
    created_on: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class SpecificationPhotoSortUpdate(BaseModel):
    sort_order: int
