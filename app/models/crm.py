# -*- coding: utf-8 -*-
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, Date, DateTime, LargeBinary,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(100))
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class UserRole(Base):
    __tablename__ = "user_roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class AuthUser(Base):
    __tablename__ = "auth_user"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nic = Column(String(128), nullable=False, unique=True)
    first_name = Column(String(128))
    last_name = Column(String(128))
    email = Column(String(512))
    password = Column(String(512))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    role_id = Column(Integer, ForeignKey("user_roles.id"))
    registration_key = Column(String(512), nullable=True, unique=True, index=True)
    registration_id = Column(String(512))
    registration_link_enabled = Column(Boolean, nullable=False, default=True)
    registration_link_registrations_count = Column(Integer, nullable=False, default=0)
    dashboard_columns_json = Column(Text, nullable=True)
    parent_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    # 0 — директор, 1 — менеджер, 2 — агент
    hierarchy_level = Column(Integer, nullable=False, default=2)


class UserHierarchy(Base):
    """Closure table: все предки и потомки в иерархии продаж."""
    __tablename__ = "user_hierarchy"
    __table_args__ = (
        UniqueConstraint("ancestor_id", "descendant_id", name="uq_user_hierarchy_pair"),
    )
    ancestor_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), primary_key=True)
    descendant_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), primary_key=True)
    depth = Column(Integer, nullable=False)


class UserInvite(Base):
    """Приглашение в команду по ссылке."""
    __tablename__ = "user_invites"
    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    inviter_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=False)
    parent_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=False)
    target_hierarchy_level = Column(Integer, nullable=False)
    role_id = Column(Integer, ForeignKey("user_roles.id"), nullable=True)
    nic = Column(String(128), nullable=True)
    email = Column(String(512), nullable=True)
    first_name = Column(String(128), nullable=True)
    last_name = Column(String(128), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    accepted_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow)


class SpecificationStatus(Base):
    __tablename__ = "specification_statuses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class LeadSource(Base):
    __tablename__ = "lead_sources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    number = Column(String(20), unique=True, nullable=True)  # человекочитаемый номер A00001 (5 цифр)
    name = Column(String(200), nullable=False)
    middle_name = Column(String(200))
    last_name = Column(String(200))
    full_name = Column(String(600))
    phone = Column(String(50), nullable=False)
    email = Column(String(100))
    address = Column(Text, nullable=False)
    lead_source_id = Column(Integer, ForeignKey("lead_sources.id"))
    link = Column(String(500))
    notes = Column(Text)
    comments = Column(Text)
    # Пол и возрастная группа (анкета): male | female; 18_24 | 25_30 | 31_40 | 41_50 | 51_plus
    gender = Column(String(20), nullable=True)
    age_bracket = Column(String(20), nullable=True)
    # Паспортные данные
    passport_series = Column(String(20))
    passport_number = Column(String(20))
    passport_issued_by = Column(String(500))  # кем выдан
    passport_issue_date = Column(Date)
    passport_department_code = Column(String(20))  # код подразделения
    birth_date = Column(Date)
    birth_place = Column(String(500))
    passport_scan_data = Column(LargeBinary)  # скан паспорта (изображение в БД)
    passport_scan_content_type = Column(String(100))  # image/jpeg, image/png и т.д.
    # Данные юр. лица (договор)
    legal_company_name = Column(String(500))
    legal_inn = Column(String(20))
    legal_kpp = Column(String(20))
    legal_ogrn = Column(String(20))
    legal_company_address = Column(Text)
    legal_bank = Column(String(300))
    legal_bank_account = Column(String(50))
    legal_bik = Column(String(20))
    legal_signatory_name = Column(String(200))
    legal_signatory_basis = Column(String(300))
    # Статус сделки: in_progress | success | rejected (подписи в UI: В работе, Успех, Отказ)
    deal_status = Column(String(30), nullable=False, default="in_progress")
    budget = Column(Numeric(10, 2), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def has_passport_scan(self) -> bool:
        return bool(getattr(self, "passport_scan_data", None))


class ProjectStatus(Base):
    __tablename__ = "project_statuses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    action = Column(String(500))  # Действие (настройки / дашборд)
    execution_days = Column(Integer)  # Время исполнения (дней), отсчёт с projects.status_started_at
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class Organization(Base):
    """Юрлицо (исполнитель), от имени которого составляются договоры. Принадлежит компании."""
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(300), nullable=False)
    inn = Column(String(20))
    kpp = Column(String(20))
    address = Column(Text)
    bank = Column(String(300))
    bank_account = Column(String(50))
    bik = Column(String(20))
    director_name = Column(String(200))
    director_position = Column(String(200))
    is_default = Column(Boolean, default=False)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Company(Base):
    """Компания / бизнес-единица (справочник). Может включать несколько организаций."""
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(300), nullable=False)
    code = Column(String(50), unique=True, nullable=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ContractTemplate(Base):
    """Шаблон типового договора (на поставку, на установку или подписи/футер)."""
    __tablename__ = "contract_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)  # 'supply' | 'mount' | 'footer'
    title = Column(String(200), nullable=False)
    body = Column(Text)  # HTML содержимое шаблона
    sort_order = Column(Integer, default=0)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KpHtmlTemplate(Base):
    """Сохранённый HTML-шаблон коммерческого предложения для редактирования и превью."""
    __tablename__ = "kp_html_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    html_content = Column(Text, default="")
    description = Column(Text)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PrintSettings(Base):
    """Настройки печати договоров (одна запись — синглтон)."""
    __tablename__ = "print_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    margin_top_mm = Column(Integer, default=20)
    margin_bottom_mm = Column(Integer, default=25)
    margin_left_mm = Column(Integer, default=15)
    margin_right_mm = Column(Integer, default=15)
    font_size_pt = Column(Integer, default=12)
    font_family = Column(String(200), default="Arial, 'Liberation Sans', Helvetica, sans-serif")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    project_number = Column(String(50), unique=True, nullable=True)  # человекочитаемый A00001-P01 (P — 2 цифры)
    start_date = Column(Date)
    end_date = Column(Date)
    status_id = Column(Integer, ForeignKey("project_statuses.id"))
    budget = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), default=0)
    description = Column(Text)
    notes = Column(Text)
    organization_id_supply = Column(Integer, ForeignKey("organizations.id"))  # организация для договора на поставку; null = по умолчанию
    organization_id_mount = Column(Integer, ForeignKey("organizations.id"))  # организация для договора на установку; null = по умолчанию
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status_started_at = Column(DateTime, default=datetime.utcnow)
    created_by_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)


class ProjectContractDocument(Base):
    """HTML договора/приложения/акта по проекту (1 строка на тип документа)."""
    __tablename__ = "project_contract_documents"
    __table_args__ = (
        UniqueConstraint("project_id", "document_id", name="uq_project_contract_documents_project_doc"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(50), nullable=False)
    html_body = Column(Text)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectContractData(Base):
    """Данные для составления договора по проекту (1:1)."""
    __tablename__ = "project_contract_data"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    contract_date = Column(Date)  # дата договора
    city = Column(String(200))  # город (место заключения договора)
    contract_supply_amount = Column(Numeric(12, 2))  # сумма договора поставки (сумма согласованных КП)
    contract_supply_amount_words = Column(String(500))  # сумма договора поставки прописью
    house_kits_count = Column(Integer)  # количество домокомплектов (= количество согласованных КП)
    prepayment_amount = Column(Numeric(12, 2))  # предоплата (цифрой)
    prepayment_words = Column(String(500))  # предоплата прописью
    balance_amount = Column(Numeric(12, 2))  # остаток (цифрой)
    balance_words = Column(String(500))  # остаток прописью
    delivery_deadline = Column(Date)  # дата, до которой поставляется поставка
    buyer_party_type = Column(String(20), nullable=False, default="individual")  # individual | legal
    buyer_legal_json = Column(Text)  # JSON: legal_company_name, legal_inn, … для формы договора
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectStatusLog(Base):
    """Лог смены статуса проекта: когда, по какому проекту, с какого на какой статус."""
    __tablename__ = "project_status_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    old_status_id = Column(Integer, ForeignKey("project_statuses.id"), nullable=True)
    new_status_id = Column(Integer, ForeignKey("project_statuses.id"), nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)


class ChatThread(Base):
    """Диалог direct (менеджер–агент); thread_type=channel — позже."""
    __tablename__ = "chat_threads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_type = Column(String(20), nullable=False, default="direct")
    title = Column(String(200), nullable=True)
    direct_manager_user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=True)
    direct_agent_user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatThreadMember(Base):
    __tablename__ = "chat_thread_members"
    thread_id = Column(Integer, ForeignKey("chat_threads.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), primary_key=True)
    last_read_message_id = Column(Integer, nullable=True)
    last_read_at = Column(DateTime, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(Integer, ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    is_system = Column(Boolean, nullable=False, default=False)
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class ChatMessageAttachment(Base):
    __tablename__ = "chat_message_attachments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    image_data = Column(LargeBinary, nullable=False)
    content_type = Column(String(100), nullable=False)
    filename = Column(String(255))
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    recipient_user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    entity_type = Column(String(30), nullable=True)
    entity_id = Column(Integer, nullable=True)
    link_path = Column(String(500), nullable=True)
    chat_message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class UserActivityEvent(Base):
    """Журнал действий пользователя для отчёта активности команды."""
    __tablename__ = "user_activity_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    occurred_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    entity_type = Column(String(30), nullable=True)
    entity_id = Column(Integer, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    meta_json = Column(Text, nullable=True)


class Specification(Base):
    __tablename__ = "specifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    number = Column(String(30), unique=True, nullable=True)  # человекочитаемый A00001-P01-S01 (S — 2 цифры)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    status_id = Column(Integer, ForeignKey("specification_statuses.id"), nullable=False)
    description = Column(Text)
    total_amount = Column(Numeric(10, 2), default=0)
    kp_approved = Column(Boolean, default=False)
    kp_internal_comment = Column(Text, nullable=True)  # название в договоре
    comment = Column(Text, nullable=True)  # комментарий (отображается в списке спецификаций)
    length_m = Column(Numeric(12, 2), nullable=True)  # длина дома, м
    width_m = Column(Numeric(12, 2), nullable=True)  # ширина дома, м
    terrace_length_m = Column(Numeric(12, 2), nullable=True)  # длина террасы, м
    terrace_width_m = Column(Numeric(12, 2), nullable=True)  # ширина террасы, м
    balcony_length_m = Column(Numeric(12, 2), nullable=True)  # длина балкона, м
    terrace_second_floor = Column(Boolean, default=False, nullable=False)  # терраса на 2-м этаже
    floors = Column(Integer, nullable=True)  # этажность
    room_count = Column(Integer, nullable=True)  # количество комнат
    double_timber = Column(Boolean, default=False)  # двойной брус
    wall_height_m = Column(Numeric(12, 2), nullable=True)  # высота k для площади стен комнат, м
    building_type = Column(String(10), default="house", nullable=False)  # house — Дом, banya — Баня
    created_by_user_id = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Part(Base):
    __tablename__ = "parts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    sort_order = Column(Integer, default=0)


class RequiredItemTemplate(Base):
    __tablename__ = "required_item_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    name = Column(String(200), nullable=False)
    required_qty = Column(Numeric(10, 2), default=1)
    unit = Column(String(50), default="шт")


class NomenclatureItem(Base):
    __tablename__ = "nomenclature_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_number = Column(String(50), unique=True, nullable=False)
    name = Column(String(200))
    part_id = Column(Integer, ForeignKey("parts.id"))
    item_date = Column(Date, default=date.today)
    unit = Column(String(50), default="шт")
    unit_alt = Column(String(100))  # альтернативные единицы измерения
    total_cost = Column(Numeric(10, 2), default=0)
    price_alt = Column(Numeric(10, 2))  # альтернативная цена
    description = Column(Text)
    created_on = Column(DateTime, default=datetime.utcnow)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SpecificationItem(Base):
    __tablename__ = "specification_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    specification_id = Column(Integer, ForeignKey("specifications.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"))
    template_id = Column(Integer, ForeignKey("required_item_templates.id"))
    nomenclature_item_id = Column(Integer, ForeignKey("nomenclature_items.id"))
    item_name = Column(String(200), nullable=False)
    quantity = Column(Numeric(10, 2), default=1)
    unit = Column(String(50), default="шт")
    price = Column(Numeric(10, 2), default=0)
    discount_percent = Column(Numeric(6, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), default=0)
    description = Column(Text)
    # Копия правила из шаблона дома; итог: quantity = quantity_manual ?? quantity_auto
    qty_basis = Column(String(40), nullable=True)
    qty_multiplier = Column(Numeric(12, 4), nullable=True)
    qty_use_floors = Column(Boolean, nullable=True)
    quantity_auto = Column(Numeric(12, 4), nullable=True)
    quantity_manual = Column(Numeric(12, 4), nullable=True)
    template_line_no = Column(Integer, nullable=True)  # № строки в шаблоне дома (1-based)
    include_in_total = Column(Boolean, default=True, nullable=False)  # учёт в total_amount спецификации
    created_on = Column(DateTime, default=datetime.utcnow)


class HouseSpecificationTemplate(Base):
    __tablename__ = "house_specification_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)


class HouseTemplate(Base):
    __tablename__ = "house_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    house_specification_template_id = Column(Integer, ForeignKey("house_specification_templates.id"))
    part_id = Column(Integer, ForeignKey("parts.id"))
    required_item_template_id = Column(Integer, ForeignKey("required_item_templates.id"))
    nomenclature_item_id = Column(Integer, ForeignKey("nomenclature_items.id"))
    unit = Column(String(50), default="шт")
    quantity = Column(Numeric(10, 2), default=1)
    price = Column(Numeric(10, 2), default=0)
    comment = Column(Text)
    # Правило количества: fixed | perimeter | … | area | terrace_area | foundation_blocks_contour_internal
    qty_basis = Column(String(40), nullable=True)
    qty_multiplier = Column(Numeric(12, 4), nullable=True)
    qty_use_floors = Column(Boolean, nullable=True)


class RequiredItemMaterial(Base):
    __tablename__ = "required_item_materials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    required_item_template_id = Column(Integer, ForeignKey("required_item_templates.id"), nullable=False)
    nomenclature_id = Column(Integer, ForeignKey("nomenclature_items.id"), nullable=False)


class SpecificationRequiredItem(Base):
    __tablename__ = "specification_required_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    spec_id = Column(Integer, ForeignKey("specifications.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("required_item_templates.id"), nullable=False)
    required_qty = Column(Numeric(10, 2), default=0)
    added_qty = Column(Numeric(10, 2), default=0)


class SpecificationPhoto(Base):
    __tablename__ = "specification_photos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    specification_id = Column(Integer, ForeignKey("specifications.id"), nullable=True)
    house_specification_template_id = Column(Integer, ForeignKey("house_specification_templates.id"), nullable=True)
    image_data = Column(LargeBinary, nullable=False)
    content_type = Column(String(100), nullable=False)
    filename = Column(String(255))
    sort_order = Column(Integer, default=0)
    created_on = Column(DateTime, default=datetime.utcnow)
