# -*- coding: utf-8 -*-
"""Справочники companies / organizations и привязка к projects.

На боевой БД, созданной до появления организаций, таблицы отсутствуют —
PDF (КП, договоры) падает при запросе organization_service.get_default().
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "002_companies_organizations"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_table(inspector, "companies"):
        op.create_table(
            "companies",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.String(length=300), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
            sa.Column("created_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("modified_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )

    if not _has_table(inspector, "organizations"):
        op.create_table(
            "organizations",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("company_id", sa.Integer(), nullable=True),
            sa.Column("name", sa.String(length=300), nullable=False),
            sa.Column("inn", sa.String(length=20), nullable=True),
            sa.Column("kpp", sa.String(length=20), nullable=True),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("bank", sa.String(length=300), nullable=True),
            sa.Column("bank_account", sa.String(length=50), nullable=True),
            sa.Column("bik", sa.String(length=20), nullable=True),
            sa.Column("director_name", sa.String(length=200), nullable=True),
            sa.Column("director_position", sa.String(length=200), nullable=True),
            sa.Column("is_default", sa.Boolean(), server_default=sa.text("FALSE"), nullable=True),
            sa.Column("created_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("modified_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_organizations_company_id", "organizations", ["company_id"], unique=False)
    elif _has_table(inspector, "organizations"):
        # Таблица уже есть (старая схема) — добавить недостающие колонки.
        org_columns: list[tuple[str, sa.Column]] = [
            ("company_id", sa.Column("company_id", sa.Integer(), nullable=True)),
            ("inn", sa.Column("inn", sa.String(length=20), nullable=True)),
            ("kpp", sa.Column("kpp", sa.String(length=20), nullable=True)),
            ("address", sa.Column("address", sa.Text(), nullable=True)),
            ("bank", sa.Column("bank", sa.String(length=300), nullable=True)),
            ("bank_account", sa.Column("bank_account", sa.String(length=50), nullable=True)),
            ("bik", sa.Column("bik", sa.String(length=20), nullable=True)),
            ("director_name", sa.Column("director_name", sa.String(length=200), nullable=True)),
            ("director_position", sa.Column("director_position", sa.String(length=200), nullable=True)),
            ("is_default", sa.Column("is_default", sa.Boolean(), server_default=sa.text("FALSE"), nullable=True)),
            ("created_on", sa.Column("created_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True)),
            ("modified_on", sa.Column("modified_on", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True)),
        ]
        for col_name, col_def in org_columns:
            if not _has_column(inspector, "organizations", col_name):
                op.add_column("organizations", col_def)
        inspector = inspect(bind)
        if _has_column(inspector, "organizations", "company_id"):
            fk_exists = any(
                fk.get("referred_table") == "companies" and "company_id" in (fk.get("constrained_columns") or [])
                for fk in inspector.get_foreign_keys("organizations")
            )
            if not fk_exists:
                op.create_foreign_key(
                    "fk_organizations_company_id",
                    "organizations",
                    "companies",
                    ["company_id"],
                    ["id"],
                    ondelete="SET NULL",
                )
            index_names = {idx["name"] for idx in inspector.get_indexes("organizations")}
            if "ix_organizations_company_id" not in index_names:
                op.create_index("ix_organizations_company_id", "organizations", ["company_id"], unique=False)

    if _has_table(inspector, "projects"):
        if not _has_column(inspector, "projects", "organization_id_supply"):
            op.add_column(
                "projects",
                sa.Column("organization_id_supply", sa.Integer(), nullable=True),
            )
            op.create_foreign_key(
                "fk_projects_organization_id_supply",
                "projects",
                "organizations",
                ["organization_id_supply"],
                ["id"],
            )
        if not _has_column(inspector, "projects", "organization_id_mount"):
            op.add_column(
                "projects",
                sa.Column("organization_id_mount", sa.Integer(), nullable=True),
            )
            op.create_foreign_key(
                "fk_projects_organization_id_mount",
                "projects",
                "organizations",
                ["organization_id_mount"],
                ["id"],
            )

    # Seed: проверяем через SQL (inspector может быть устаревшим после create_table).
    if bind.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'companies'"
        )
    ).fetchone():
        company_count = bind.execute(text("SELECT COUNT(*) FROM companies")).scalar() or 0
        if company_count == 0:
            bind.execute(
                text(
                    """
                    INSERT INTO companies (name, is_active, created_on, modified_on)
                    VALUES ('Компания по умолчанию', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                )
            )

    if bind.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'organizations'"
        )
    ).fetchone():
        org_count = bind.execute(text("SELECT COUNT(*) FROM organizations")).scalar() or 0
        default_company_id = bind.execute(
            text("SELECT id FROM companies ORDER BY id ASC LIMIT 1")
        ).scalar()
        if bind.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'company_id'"
            )
        ).fetchone():
            bind.execute(
                text("UPDATE organizations SET company_id = :cid WHERE company_id IS NULL"),
                {"cid": default_company_id},
            )
        if org_count == 0:
            bind.execute(
                text(
                    """
                    INSERT INTO organizations (company_id, name, is_default, created_on, modified_on)
                    VALUES (:company_id, 'Организация по умолчанию', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {"company_id": default_company_id},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _has_table(inspector, "projects"):
        if _has_column(inspector, "projects", "organization_id_mount"):
            op.drop_constraint("fk_projects_organization_id_mount", "projects", type_="foreignkey")
            op.drop_column("projects", "organization_id_mount")
        if _has_column(inspector, "projects", "organization_id_supply"):
            op.drop_constraint("fk_projects_organization_id_supply", "projects", type_="foreignkey")
            op.drop_column("projects", "organization_id_supply")

    if _has_table(inspector, "organizations"):
        op.drop_index("ix_organizations_company_id", table_name="organizations")
        op.drop_table("organizations")

    if _has_table(inspector, "companies"):
        op.drop_table("companies")
