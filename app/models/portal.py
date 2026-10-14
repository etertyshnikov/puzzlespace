# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.database import Base


class PortalUser(Base):
    __tablename__ = "portal_users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(320), nullable=False, unique=True, index=True)
    password_hash = Column(String(512), nullable=False)
    name = Column(String(200), nullable=False)
    phone = Column(String(40), nullable=False, default="")
    pd_consent = Column(Boolean, nullable=False, default=False)
    pd_consent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PortalListing(Base):
    __tablename__ = "portal_listings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("portal_users.id"), nullable=False, index=True)
    kind = Column(String(32), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    body_json = Column(Text, nullable=False, default="{}")
    status = Column(String(32), nullable=False, default="pending", index=True)
    publish_log = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at = Column(DateTime, nullable=True)


class PortalChannel(Base):
    """Куда публиковать объявление выбранного типа: отдельный чат Max, Telegram или URL Дзена."""
    __tablename__ = "portal_channels"
    __table_args__ = (UniqueConstraint("kind", "network", name="uq_portal_channel_kind_network"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(32), nullable=False)
    network = Column(String(32), nullable=False)
    target = Column(String(500), nullable=False, default="")
    enabled = Column(Boolean, nullable=False, default=True)
