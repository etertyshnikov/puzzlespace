# -*- coding: utf-8 -*-
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer


def _serialize_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


class KpHtmlTemplateBase(BaseModel):
    title: str
    html_content: Optional[str] = ""
    description: Optional[str] = None


class KpHtmlTemplateCreate(KpHtmlTemplateBase):
    pass


class KpHtmlTemplateUpdate(BaseModel):
    title: Optional[str] = None
    html_content: Optional[str] = None
    description: Optional[str] = None


class KpHtmlTemplateOut(KpHtmlTemplateBase):
    id: int
    created_on: Optional[datetime] = None
    modified_on: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("created_on", "modified_on")
    def _serialize_datetime(self, dt: datetime | None) -> str | None:
        return _serialize_utc(dt)
