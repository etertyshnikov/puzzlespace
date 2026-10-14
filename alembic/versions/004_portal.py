# -*- coding: utf-8 -*-
"""Публичные пользователи, объявления и каналы публикации."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004_portal"
down_revision = "003_organizations_company_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portal_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False, server_default=""),
        sa.Column("pd_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pd_consent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_portal_users_email", "portal_users", ["email"], unique=True)
    op.create_table(
        "portal_listings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("portal_users.id"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("body_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("publish_log", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_portal_listings_user_id", "portal_listings", ["user_id"])
    op.create_index("ix_portal_listings_kind", "portal_listings", ["kind"])
    op.create_index("ix_portal_listings_status", "portal_listings", ["status"])
    op.create_table(
        "portal_channels",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("network", sa.String(32), nullable=False),
        sa.Column("target", sa.String(500), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("kind", "network", name="uq_portal_channel_kind_network"),
    )


def downgrade() -> None:
    op.drop_table("portal_channels")
    op.drop_table("portal_listings")
    op.drop_index("ix_portal_users_email", table_name="portal_users")
    op.drop_table("portal_users")
