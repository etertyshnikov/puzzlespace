# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


class EstimateQuote(Base):
    """Сохранённый проход квиза. Публичная страница открывается по slug."""

    __tablename__ = "estimate_quotes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(32), nullable=False, unique=True, index=True)
    payload_json = Column(Text, nullable=False)
    result_json = Column(Text, nullable=False)
    photo_path = Column(String(500), nullable=True)
    publish_log = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
