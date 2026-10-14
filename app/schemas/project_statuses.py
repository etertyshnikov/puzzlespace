# -*- coding: utf-8 -*-
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProjectStatusBase(BaseModel):
    name: str
    description: Optional[str] = None
    action: Optional[str] = None  # Действие
    execution_days: Optional[int] = None  # Время исполнения (дней)
    sort_order: int = 0
    is_active: bool = True


class ProjectStatusCreate(ProjectStatusBase):
    pass


class ProjectStatusUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    action: Optional[str] = None
    execution_days: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ProjectStatusOut(ProjectStatusBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
