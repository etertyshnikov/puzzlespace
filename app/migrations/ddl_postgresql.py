# -*- coding: utf-8 -*-
"""
Идемпотентный DDL PostgreSQL: таблицы, колонки и индексы.
Дополняет Base.metadata.create_all() для старых БД (web2py и ранние версии).
"""

MIGRATION_ID = "001_full_schema"

MIGRATION_STATEMENTS: list[str] = [
    # --- учёт миграций ---
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(64) PRIMARY KEY,
        description TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # --- companies / organizations ---
    """
    CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(300) NOT NULL,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        name VARCHAR(300) NOT NULL,
        inn VARCHAR(20),
        kpp VARCHAR(20),
        address TEXT,
        bank VARCHAR(300),
        bank_account VARCHAR(50),
        bik VARCHAR(20),
        director_name VARCHAR(200),
        director_position VARCHAR(200),
        is_default BOOLEAN DEFAULT FALSE,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL",
    # --- auth_user ---
    "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS parent_user_id INTEGER REFERENCES auth_user(id)",
    "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER NOT NULL DEFAULT 2",
    "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS dashboard_columns_json TEXT",
    "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS registration_link_enabled BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS registration_link_registrations_count INTEGER NOT NULL DEFAULT 0",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_user_registration_key_unique
        ON auth_user (registration_key) WHERE registration_key IS NOT NULL
    """,
    # --- user_hierarchy / invites ---
    """
    CREATE TABLE IF NOT EXISTS user_hierarchy (
        ancestor_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
        descendant_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
        depth INTEGER NOT NULL,
        PRIMARY KEY (ancestor_id, descendant_id),
        CONSTRAINT uq_user_hierarchy_pair UNIQUE (ancestor_id, descendant_id)
    )
    """,
    """
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
    """,
    "CREATE INDEX IF NOT EXISTS ix_user_invites_token ON user_invites (token)",
    # --- customers ---
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS number VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_series VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_number VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_issued_by VARCHAR(500)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_issue_date DATE",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_department_code VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date DATE",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_place VARCHAR(500)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_scan VARCHAR(500)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_scan_data BYTEA",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS passport_scan_content_type VARCHAR(100)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS deal_status VARCHAR(30) NOT NULL DEFAULT 'in_progress'",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS age_bracket VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS budget NUMERIC(10, 2)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_company_name VARCHAR(500)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_inn VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_kpp VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_ogrn VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_company_address TEXT",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_bank VARCHAR(300)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_bank_account VARCHAR(50)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_bik VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_signatory_name VARCHAR(200)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_signatory_basis VARCHAR(300)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES auth_user(id)",
    # --- projects ---
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_started_at TIMESTAMP",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS sla_hours INTEGER",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES auth_user(id)",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id_supply INTEGER REFERENCES organizations(id)",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id_mount INTEGER REFERENCES organizations(id)",
    # --- project_statuses ---
    "ALTER TABLE project_statuses ADD COLUMN IF NOT EXISTS action VARCHAR(500)",
    "ALTER TABLE project_statuses ADD COLUMN IF NOT EXISTS execution_days INTEGER",
    # --- project_status_logs ---
    "ALTER TABLE project_status_logs ADD COLUMN IF NOT EXISTS changed_by_user_id INTEGER REFERENCES auth_user(id)",
    # --- project_contract_data ---
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS city VARCHAR(200)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS contract_supply_amount NUMERIC(12, 2)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS contract_supply_amount_words VARCHAR(500)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS house_kits_count INTEGER",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS prepayment_amount NUMERIC(12, 2)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS prepayment_words VARCHAR(500)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12, 2)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS balance_words VARCHAR(500)",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS delivery_deadline DATE",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS buyer_party_type VARCHAR(20) DEFAULT 'individual'",
    "ALTER TABLE project_contract_data ADD COLUMN IF NOT EXISTS buyer_legal_json TEXT",
    # --- project_contract_documents ---
    """
    CREATE TABLE IF NOT EXISTS project_contract_documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        document_id VARCHAR(50) NOT NULL,
        html_body TEXT,
        created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        modified_on TIMESTAMP WITHOUT TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        CONSTRAINT uq_project_contract_documents_project_doc UNIQUE (project_id, document_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_project_contract_documents_project_id
        ON project_contract_documents (project_id)
    """,
    # --- specifications ---
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS length_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS width_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS floors INTEGER",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS room_count INTEGER",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS double_timber BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS terrace_length_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS terrace_width_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS terrace_second_floor BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS balcony_length_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS wall_height_m NUMERIC(12, 2)",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS kp_internal_comment TEXT",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS comment TEXT",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS building_type VARCHAR(10) NOT NULL DEFAULT 'house'",
    "ALTER TABLE specifications ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES auth_user(id)",
    # --- specification_items ---
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS template_line_no INTEGER",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS include_in_total BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(6, 2) NOT NULL DEFAULT 0",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS qty_basis VARCHAR(40)",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS qty_multiplier NUMERIC(12, 4)",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS qty_use_floors BOOLEAN DEFAULT TRUE",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS quantity_auto NUMERIC(12, 4)",
    "ALTER TABLE specification_items ADD COLUMN IF NOT EXISTS quantity_manual NUMERIC(12, 4)",
    # --- house_templates ---
    "ALTER TABLE house_templates ADD COLUMN IF NOT EXISTS qty_basis VARCHAR(40)",
    "ALTER TABLE house_templates ADD COLUMN IF NOT EXISTS qty_multiplier NUMERIC(12, 4) DEFAULT 1",
    "ALTER TABLE house_templates ADD COLUMN IF NOT EXISTS qty_use_floors BOOLEAN DEFAULT TRUE",
    # --- parts / contract_templates ---
    "ALTER TABLE parts ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
    "ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
    # --- specification_photos ---
    """
    CREATE TABLE IF NOT EXISTS specification_photos (
        id SERIAL PRIMARY KEY,
        specification_id INTEGER REFERENCES specifications(id),
        house_specification_template_id INTEGER REFERENCES house_specification_templates(id),
        image_data BYTEA NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        filename VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        created_on TIMESTAMP DEFAULT NOW()
    )
    """,
    # --- chat / notifications ---
    """
    CREATE TABLE IF NOT EXISTS chat_threads (
        id SERIAL PRIMARY KEY,
        thread_type VARCHAR(20) NOT NULL DEFAULT 'direct',
        title VARCHAR(200),
        direct_manager_user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
        direct_agent_user_id INTEGER REFERENCES auth_user(id) ON DELETE CASCADE,
        created_by_user_id INTEGER REFERENCES auth_user(id),
        created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
        updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_threads_direct_pair
        ON chat_threads (direct_manager_user_id, direct_agent_user_id)
        WHERE thread_type = 'direct'
        AND direct_manager_user_id IS NOT NULL
        AND direct_agent_user_id IS NOT NULL
    """,
    "CREATE INDEX IF NOT EXISTS ix_chat_threads_updated_at ON chat_threads (updated_at DESC)",
    """
    CREATE TABLE IF NOT EXISTS chat_thread_members (
        thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
        last_read_message_id INTEGER,
        last_read_at TIMESTAMP,
        PRIMARY KEY (thread_id, user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        sender_user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        meta_json TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_chat_messages_thread_created ON chat_messages (thread_id, created_at DESC)",
    """
    CREATE TABLE IF NOT EXISTS notifications (
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
    """,
    "CREATE INDEX IF NOT EXISTS ix_notifications_recipient_created ON notifications (recipient_user_id, created_at DESC)",
    """
    CREATE INDEX IF NOT EXISTS ix_notifications_recipient_unread
        ON notifications (recipient_user_id) WHERE read_at IS NULL
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_message_attachments (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        filename VARCHAR(255),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_chat_message_attachments_message
        ON chat_message_attachments (message_id, sort_order, id)
    """,
    # --- user_activity_events ---
    """
    CREATE TABLE IF NOT EXISTS user_activity_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES auth_user(id),
        event_type VARCHAR(50) NOT NULL,
        occurred_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
        entity_type VARCHAR(30),
        entity_id INTEGER,
        project_id INTEGER REFERENCES projects(id),
        meta_json TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_user_activity_events_user_id ON user_activity_events (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_user_activity_events_event_type ON user_activity_events (event_type)",
    "CREATE INDEX IF NOT EXISTS ix_user_activity_events_occurred_at ON user_activity_events (occurred_at)",
    "CREATE INDEX IF NOT EXISTS ix_user_activity_events_project_id ON user_activity_events (project_id)",
]
