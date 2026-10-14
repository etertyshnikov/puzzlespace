# -*- coding: utf-8 -*-
from datetime import datetime

from pydantic import BaseModel


class ActivityEventTypeOut(BaseModel):
    code: str
    label: str


class AgentActivityOut(BaseModel):
    user_id: int
    name: str
    counts: dict[str, int]
    total: int


class TeamActivityOut(BaseModel):
    date: str
    event_types: list[ActivityEventTypeOut]
    agents: list[AgentActivityOut]
    team_totals: dict[str, int]
    agents_count: int


class ActivityDetailOut(BaseModel):
    id: int
    occurred_at: datetime
    event_type: str
    entity_type: str | None = None
    entity_id: int | None = None
    project_id: int | None = None
    label: str
    project_number: str | None = None
    project_name: str | None = None
