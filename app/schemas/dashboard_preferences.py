# -*- coding: utf-8 -*-
from pydantic import BaseModel, Field


class DashboardColumnsPreference(BaseModel):
    order: list[str] = Field(default_factory=list)
    hidden: list[str] = Field(default_factory=list)
