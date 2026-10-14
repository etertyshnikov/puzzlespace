# -*- coding: utf-8 -*-
"""Пост-DDL шаги: переименования legacy-колонок, идемпотентные DDL и seed данных."""
from sqlalchemy import text

from app.database import engine


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pg_table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :t LIMIT 1"
        ),
        {"t": table},
    ).fetchone()
    return row is not None


def _pg_column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).fetchone()
    return row is not None


# ---------------------------------------------------------------------------
# migrate_user_hierarchy
# ---------------------------------------------------------------------------

def _migrate_user_hierarchy(conn) -> None:
    if not _pg_column_exists(conn, "auth_user", "parent_user_id"):
        conn.execute(text(
            "ALTER TABLE auth_user ADD COLUMN parent_user_id INTEGER REFERENCES auth_user(id)"
        ))
    if not _pg_column_exists(conn, "auth_user", "hierarchy_level"):
        conn.execute(text(
            "ALTER TABLE auth_user ADD COLUMN hierarchy_level INTEGER NOT NULL DEFAULT 2"
        ))
        conn.execute(text(
            "UPDATE auth_user SET hierarchy_level = 0 "
            "WHERE role_id IN (SELECT id FROM user_roles WHERE name = 'admin')"
        ))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS user_hierarchy (
            ancestor_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
            descendant_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
            depth INTEGER NOT NULL,
            PRIMARY KEY (ancestor_id, descendant_id),
            CONSTRAINT uq_user_hierarchy_pair UNIQUE (ancestor_id, descendant_id)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS user_invites (
            id SERIAL PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            inviter_user_id INTEGER NOT NULL REFERENCES auth_user(id),
            parent_user_id INTEGER NOT NULL REFERENCES auth_user(id),
            target_hierarchy_level INTEGER NOT NULL,
            role_id INTEGER REFERENCES user_roles(id),
            nic VARCHAR(128),
            email VARCHAR(512),
            first_name VARCHAR(128),
            last_name VARCHAR(128),
            expires_at TIMESTAMP NOT NULL,
            accepted_at TIMESTAMP,
            accepted_user_id INTEGER REFERENCES auth_user(id),
            created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_user_invites_token ON user_invites (token)"
    ))

    HIERARCHY_ROLES = [("manager", "Менеджер", 1), ("agent", "Агент", 2)]
    for name, desc, order in HIERARCHY_ROLES:
        exists = conn.execute(
            text("SELECT id FROM user_roles WHERE name = :n"), {"n": name}
        ).fetchone()
        if not exists:
            conn.execute(text(
                "INSERT INTO user_roles (name, description, sort_order, is_active) "
                "VALUES (:n, :d, :o, true)"
            ), {"n": name, "d": desc, "o": order})

    # rebuild closure table
    conn.execute(text("DELETE FROM user_hierarchy"))
    users = conn.execute(
        text("SELECT id, parent_user_id FROM auth_user ORDER BY id")
    ).fetchall()
    by_id = {int(r[0]): (int(r[1]) if r[1] is not None else None) for r in users}
    paths: dict = {}

    def path_for(uid):
        if uid in paths:
            return paths[uid]
        parent = by_id.get(uid)
        if parent is None:
            paths[uid] = [(uid, 0)]
            return paths[uid]
        paths[uid] = [(uid, 0)] + [(a, d + 1) for a, d in path_for(parent)]
        return paths[uid]

    for uid in by_id:
        for ancestor_id, depth in path_for(uid):
            conn.execute(text(
                "INSERT INTO user_hierarchy (ancestor_id, descendant_id, depth) "
                "VALUES (:a, :d, :depth) ON CONFLICT DO NOTHING"
            ), {"a": ancestor_id, "d": uid, "depth": depth})


# ---------------------------------------------------------------------------
# migrate_role_names
# ---------------------------------------------------------------------------

def _migrate_role_names(conn) -> None:
    def role_id(name):
        row = conn.execute(
            text("SELECT id FROM user_roles WHERE name = :n"), {"n": name}
        ).fetchone()
        return int(row[0]) if row else None

    def merge_role(source, target, desc):
        sid = role_id(source)
        if sid is None:
            return
        tid = role_id(target)
        if tid is None:
            conn.execute(text(
                "UPDATE user_roles SET name = :t, description = :d WHERE name = :s"
            ), {"t": target, "d": desc, "s": source})
        else:
            conn.execute(text("UPDATE auth_user SET role_id = :t WHERE role_id = :s"), {"t": tid, "s": sid})
            conn.execute(text("UPDATE user_invites SET role_id = :t WHERE role_id = :s"), {"t": tid, "s": sid})
            conn.execute(text("DELETE FROM user_roles WHERE id = :s"), {"s": sid})

    merge_role("manager_l1", "manager", "Менеджер")
    merge_role("manager_l2", "agent", "Агент")

    manager_id = role_id("manager")
    if manager_id:
        conn.execute(text(
            "UPDATE auth_user SET hierarchy_level = 1 WHERE role_id = :r "
            "AND hierarchy_level = 2 AND COALESCE(parent_user_id, 0) = 0"
        ), {"r": manager_id})

    if not role_id("agent"):
        conn.execute(text(
            "INSERT INTO user_roles (name, description, sort_order, is_active) "
            "VALUES ('agent', 'Агент', 11, true)"
        ))

    admin_id = role_id("admin")
    if admin_id:
        conn.execute(text(
            "UPDATE auth_user SET hierarchy_level = 0 WHERE role_id = :r"
        ), {"r": admin_id})

    if not role_id("admin_manager"):
        conn.execute(text(
            "INSERT INTO user_roles (name, description, sort_order, is_active) "
            "VALUES ('admin_manager', 'Админ/менеджер', 2, true)"
        ))
    am_id = role_id("admin_manager")
    if am_id:
        conn.execute(text(
            "UPDATE auth_user SET hierarchy_level = 1 WHERE role_id = :r"
        ), {"r": am_id})


# ---------------------------------------------------------------------------
# migrate_customer_created_by
# ---------------------------------------------------------------------------

def _migrate_customer_created_by(conn) -> None:
    if not _pg_column_exists(conn, "customers", "created_by_user_id"):
        conn.execute(text(
            "ALTER TABLE customers ADD COLUMN created_by_user_id INTEGER REFERENCES auth_user(id)"
        ))


# ---------------------------------------------------------------------------
# migrate_specification_photos
# ---------------------------------------------------------------------------

def _migrate_specification_photos(conn) -> None:
    if not _pg_table_exists(conn, "specification_photos"):
        conn.execute(text("""
            CREATE TABLE specification_photos (
                id SERIAL PRIMARY KEY,
                specification_id INTEGER REFERENCES specifications(id),
                house_specification_template_id INTEGER REFERENCES house_specification_templates(id),
                image_data BYTEA NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                filename VARCHAR(255),
                sort_order INTEGER DEFAULT 0,
                created_on TIMESTAMP DEFAULT NOW()
            )
        """))


# ---------------------------------------------------------------------------
# migrate_user_activity
# ---------------------------------------------------------------------------

def _migrate_user_activity(conn) -> None:
    if not _pg_table_exists(conn, "user_activity_events"):
        conn.execute(text("""
            CREATE TABLE user_activity_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES auth_user(id),
                event_type VARCHAR(50) NOT NULL,
                occurred_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                entity_type VARCHAR(30),
                entity_id INTEGER,
                project_id INTEGER REFERENCES projects(id),
                meta_json TEXT
            )
        """))
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS ix_user_activity_events_user_id ON user_activity_events (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_user_activity_events_event_type ON user_activity_events (event_type)",
            "CREATE INDEX IF NOT EXISTS ix_user_activity_events_occurred_at ON user_activity_events (occurred_at)",
            "CREATE INDEX IF NOT EXISTS ix_user_activity_events_project_id ON user_activity_events (project_id)",
        ]:
            conn.execute(text(idx_sql))

    if not _pg_column_exists(conn, "specifications", "created_by_user_id"):
        conn.execute(text(
            "ALTER TABLE specifications ADD COLUMN created_by_user_id INTEGER REFERENCES auth_user(id)"
        ))
    if not _pg_column_exists(conn, "project_status_logs", "changed_by_user_id"):
        conn.execute(text(
            "ALTER TABLE project_status_logs ADD COLUMN changed_by_user_id INTEGER REFERENCES auth_user(id)"
        ))


# ---------------------------------------------------------------------------
# migrate_notifications_chat
# ---------------------------------------------------------------------------

def _migrate_notifications_chat(conn) -> None:
    if not _pg_table_exists(conn, "chat_threads"):
        conn.execute(text("""
            CREATE TABLE chat_threads (
                id SERIAL PRIMARY KEY,
                thread_type VARCHAR(20) NOT NULL DEFAULT 'direct',
                title VARCHAR(200),
                direct_manager_user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
                direct_agent_user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
                created_by_user_id INTEGER REFERENCES auth_user(id),
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )
        """))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_threads_direct_pair "
            "ON chat_threads (direct_manager_user_id, direct_agent_user_id) "
            "WHERE thread_type = 'direct' AND direct_manager_user_id IS NOT NULL "
            "AND direct_agent_user_id IS NOT NULL"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_chat_threads_updated_at ON chat_threads (updated_at DESC)"
        ))

    if not _pg_table_exists(conn, "chat_thread_members"):
        conn.execute(text("""
            CREATE TABLE chat_thread_members (
                thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
                last_read_message_id INTEGER,
                last_read_at TIMESTAMP,
                PRIMARY KEY (thread_id, user_id)
            )
        """))

    if not _pg_table_exists(conn, "chat_messages"):
        conn.execute(text("""
            CREATE TABLE chat_messages (
                id SERIAL PRIMARY KEY,
                thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                sender_user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
                body TEXT NOT NULL,
                is_system BOOLEAN NOT NULL DEFAULT FALSE,
                meta_json TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_chat_messages_thread_created "
            "ON chat_messages (thread_id, created_at DESC)"
        ))

    if not _pg_table_exists(conn, "notifications"):
        conn.execute(text("""
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                recipient_user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
                actor_user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
                event_type VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                body TEXT,
                entity_type VARCHAR(30),
                entity_id INTEGER,
                link_path VARCHAR(500),
                chat_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
                read_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_recipient_created "
            "ON notifications (recipient_user_id, created_at DESC)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_recipient_unread "
            "ON notifications (recipient_user_id) WHERE read_at IS NULL"
        ))


# ---------------------------------------------------------------------------
# migrate_chat_attachments
# ---------------------------------------------------------------------------

def _migrate_chat_attachments(conn) -> None:
    if not _pg_table_exists(conn, "chat_message_attachments"):
        conn.execute(text("""
            CREATE TABLE chat_message_attachments (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
                image_data BYTEA NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                filename VARCHAR(255),
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_chat_message_attachments_message "
            "ON chat_message_attachments (message_id, sort_order, id)"
        ))


# ---------------------------------------------------------------------------
# Public entry point (called from apply.py)
# ---------------------------------------------------------------------------

def run_post_migrate_scripts() -> None:
    """Запускает все идемпотентные пост-DDL скрипты (PostgreSQL)."""
    with engine.begin() as conn:
        _migrate_user_hierarchy(conn)
        _migrate_role_names(conn)
        _migrate_customer_created_by(conn)
        _migrate_specification_photos(conn)
        _migrate_user_activity(conn)
        _migrate_notifications_chat(conn)
        _migrate_chat_attachments(conn)


def _pg_columns(conn, table: str) -> set[str]:
    rows = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": table},
    ).fetchall()
    return {r[0] for r in rows}


def _sqlite_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _rename_project_status_columns(conn, dialect: str, cols: set[str]) -> set[str]:
    if dialect == "postgresql":
        if "action1" in cols:
            if "action" in cols:
                conn.execute(text("ALTER TABLE project_statuses DROP COLUMN action"))
            conn.execute(text("ALTER TABLE project_statuses RENAME COLUMN action1 TO action"))
            cols = (cols - {"action1", "action"}) | {"action"}
        elif "action" not in cols:
            conn.execute(text("ALTER TABLE project_statuses ADD COLUMN action VARCHAR(500)"))
            cols.add("action")

        if "execution_days1" in cols:
            if "execution_days" in cols:
                conn.execute(text("ALTER TABLE project_statuses DROP COLUMN execution_days"))
            conn.execute(text(
                "ALTER TABLE project_statuses RENAME COLUMN execution_days1 TO execution_days"
            ))
            cols = (cols - {"execution_days1", "execution_days"}) | {"execution_days"}
        elif "execution_days" not in cols:
            conn.execute(text("ALTER TABLE project_statuses ADD COLUMN execution_days INTEGER"))
            cols.add("execution_days")
        return cols

    if "action1" in cols and "action" not in cols:
        conn.execute(text("ALTER TABLE project_statuses RENAME COLUMN action1 TO action"))
        cols = (cols - {"action1"}) | {"action"}
    elif "action1" in cols and "action" in cols:
        conn.execute(text("ALTER TABLE project_statuses DROP COLUMN action"))
        conn.execute(text("ALTER TABLE project_statuses RENAME COLUMN action1 TO action"))
        cols = (cols - {"action1", "action"}) | {"action"}
    elif "action" not in cols:
        conn.execute(text("ALTER TABLE project_statuses ADD COLUMN action VARCHAR(500)"))
        cols.add("action")

    if "execution_days1" in cols and "execution_days" not in cols:
        conn.execute(text(
            "ALTER TABLE project_statuses RENAME COLUMN execution_days1 TO execution_days"
        ))
        cols = (cols - {"execution_days1"}) | {"execution_days"}
    elif "execution_days1" in cols and "execution_days" in cols:
        conn.execute(text("ALTER TABLE project_statuses DROP COLUMN execution_days"))
        conn.execute(text(
            "ALTER TABLE project_statuses RENAME COLUMN execution_days1 TO execution_days"
        ))
        cols = (cols - {"execution_days1", "execution_days"}) | {"execution_days"}
    elif "execution_days" not in cols:
        conn.execute(text("ALTER TABLE project_statuses ADD COLUMN execution_days INTEGER"))
        cols.add("execution_days")
    return cols


def rename_project_status_columns() -> None:
    """action1/execution_days1 → action/execution_days (legacy web2py)."""
    dialect = engine.dialect.name
    table = "project_statuses"
    with engine.begin() as conn:
        cols = _pg_columns(conn, table) if dialect == "postgresql" else _sqlite_columns(conn, table)
        _rename_project_status_columns(conn, dialect, cols)


def seed_companies_organizations() -> None:
    """Начальные компания и организация, если справочники пустые."""
    if engine.dialect.name != "postgresql":
        return

    def _table_exists(conn, table: str) -> bool:
        row = conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :t"
            ),
            {"t": table},
        ).fetchone()
        return row is not None

    def _column_exists(conn, table: str, column: str) -> bool:
        row = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).fetchone()
        return row is not None

    with engine.begin() as conn:
        if _table_exists(conn, "companies"):
            company_count = conn.execute(text("SELECT COUNT(*) FROM companies")).scalar() or 0
            if company_count == 0:
                conn.execute(
                    text(
                        """
                        INSERT INTO companies (name, is_active, created_on, modified_on)
                        VALUES ('Компания по умолчанию', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """
                    )
                )

            default_company_id = conn.execute(
                text("SELECT id FROM companies ORDER BY id ASC LIMIT 1")
            ).scalar()
            if default_company_id is not None and _column_exists(conn, "organizations", "company_id"):
                conn.execute(
                    text("UPDATE organizations SET company_id = :cid WHERE company_id IS NULL"),
                    {"cid": default_company_id},
                )

        if _table_exists(conn, "organizations"):
            org_count = conn.execute(text("SELECT COUNT(*) FROM organizations")).scalar() or 0
            if org_count == 0:
                default_company_id = conn.execute(
                    text("SELECT id FROM companies ORDER BY id ASC LIMIT 1")
                ).scalar()
                conn.execute(
                    text(
                        """
                        INSERT INTO organizations (company_id, name, is_default, created_on, modified_on)
                        VALUES (:company_id, 'Организация по умолчанию', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """
                    ),
                    {"company_id": default_company_id},
                )
