# -*- coding: utf-8 -*-
"""Сметы квиза /estimate."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "005_estimate_quotes"
down_revision = "004_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "estimate_quotes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(32), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("photo_path", sa.String(500), nullable=True),
        sa.Column("publish_log", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_estimate_quotes_slug", "estimate_quotes", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_estimate_quotes_slug", table_name="estimate_quotes")
    op.drop_table("estimate_quotes")
