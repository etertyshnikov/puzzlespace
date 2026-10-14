# Smetadoma05 — описание реализованной системы

Документ фиксирует текущее состояние CRM **smetadoma05** (FastAPI + React + PostgreSQL)  
на момент составления. Предназначен для переноса на Go и для согласования требований.

---

## 1. Назначение

CRM для продажи деревянных домов: учёт клиентов, проектов, спецификаций (смет), коммерческих предложений, договоров, номенклатуры и команды продаж с иерархией «директор → менеджер → агент».

**Стек:** Python 3.10+, FastAPI, SQLAlchemy, PostgreSQL, JWT (bcrypt + python-jose), React 19 + TypeScript + Vite, Gentelella-подобный UI.

**Точки входа:** API `:8008`, SPA из `frontend/dist`, первичная настройка через `/setup` если БД без пользователей.

---

## 2. Сущности (таблицы БД)

### 2.1. Пользователи и доступ

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **AuthUser** | `auth_user` | Учётная запись: `nic` (логин), `password` (bcrypt), ФИО, email, `role_id`, `branch_id`, `parent_user_id`, `hierarchy_level` (0/1/2), `dashboard_columns_json` |
| **UserRole** | `user_roles` | Роли: `admin`, `manager`, `agent`, `viewer` (справочник) |
| **UserHierarchy** | `user_hierarchy` | Closure table: пары `ancestor_id` / `descendant_id` / `depth` для быстрого поиска подчинённых |
| **UserInvite** | `user_invites` | Приглашение по ссылке: `token`, `inviter_user_id`, `parent_user_id`, `target_hierarchy_level`, срок `expires_at` (14 дней), `accepted_at` |
| **Branch** | `branches` | Филиалы |
| **UserActivityEvent** | `user_activity_events` | Журнал действий: `user_id`, `event_type`, `occurred_at`, `entity_type`, `entity_id`, `project_id`, `meta_json` |

### 2.2. Клиенты и воронка

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **Customer** | `customers` | Клиент: ФИО, телефон (уникальный), адрес, паспорт, юр. реквизиты, `deal_status` (`in_progress` / `success` / `rejected`), `number` (A00001), `created_by_user_id`, скан паспорта в BLOB |
| **LeadSource** | `lead_sources` | Источники лидов |
| **Project** | `projects` | Проект клиента: `name`, `customer_id`, `project_number` (A00001-P01), `status_id`, `manager_id`, `created_by_user_id`, `total_amount`, SLA (`status_started_at`, `sla_hours`), ссылки на `specification_id` / `order_id`, организации для договоров |
| **ProjectStatus** | `project_statuses` | Статусы проекта: `name`, `action` (текст действия на дашборде), `execution_days`, `sort_order` |
| **ProjectStatusLog** | `project_status_logs` | История смены статуса: `old_status_id`, `new_status_id`, `changed_by_user_id` |
| **ProjectContractData** | `project_contract_data` | Данные договора 1:1 с проектом (суммы, предоплата, даты, `buyer_legal_json`) |
| **ProjectContractDocument** | `project_contract_documents` | HTML договоров/приложений/актов по типу `document_id` |

### 2.3. Спецификации и номенклатура

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **Specification** | `specifications` | Смета: привязка к `customer_id`, `project_id`, габариты дома, `building_type` (house/banya), `kp_approved`, `total_amount`, `number` (A00001-P01-S01), `created_by_user_id` |
| **SpecificationItem** | `specification_items` | Строки сметы: номенклатура, цена, скидка, правила количества (`qty_basis`, `quantity_auto` / `quantity_manual`) |
| **SpecificationStatus** | `specification_statuses` | Статусы спецификации |
| **SpecificationPhoto** | `specification_photos` | Фото для КП (BLOB) |
| **SpecificationRequiredItem** | `specification_required_items` | Обязательные позиции в спецификации |
| **Part** | `parts` | Части дома (стены, кровля и т.д.) |
| **NomenclatureItem** | `nomenclature_items` | Позиции номенклатуры с ценой |
| **RequiredItemTemplate** | `required_item_templates` | Шаблоны обязательных позиций по части дома |
| **RequiredItemMaterial** | `required_item_materials` | Допустимые материалы для обязательной позиции |
| **HouseSpecificationTemplate** | `house_specification_templates` | Шаблон спецификации дома |
| **HouseTemplate** | `house_templates` | Строки шаблона дома с правилами `qty_basis` |

### 2.4. Заказы и КП

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **Order** | `orders` | Заказ: `order_number`, связь со спецификацией и проектом |
| **OrderItem** | `order_items` | Позиции заказа |
| **CommercialProposal** | `commercial_proposals` | КП (историческая сущность, связана со спецификацией) |
| **CommercialProposalItem** | `commercial_proposal_items` | Строки КП |

### 2.5. Справочники печати и договоров

| Сущность | Таблица | Назначение |
|----------|---------|------------|
| **Organization** | `organizations` | Организация-исполнитель для договоров |
| **ContractTemplate** | `contract_templates` | HTML-шаблоны договоров (`code`: supply, mount, footer, приложения) |
| **KpHtmlTemplate** | `kp_html_templates` | HTML-шаблоны КП |
| **PrintSettings** | `print_settings` | Поля печати (поля, шрифт) — синглтон |
| **NextStep** | `next_steps` | Следующие шаги (справочник для спецификаций) |

### 2.6. Связи (упрощённо)

```
Customer 1—* Project 1—* Specification 1—* SpecificationItem
                |              |
                |              +—* SpecificationPhoto, CommercialProposal
                +— ProjectContractData, ProjectContractDocument
                +— ProjectStatusLog, UserActivityEvent (по project_id)

AuthUser — parent_user_id → AuthUser
AuthUser — UserHierarchy (closure)
Customer.created_by_user_id → AuthUser
Project.created_by_user_id, manager_id → AuthUser
```

Циклические FK (разрешаются через `use_alter` / nullify при удалении):  
`Project.specification_id` ↔ `Specification.project_id`, `Project.order_id` ↔ `Order.project_id`.

---

## 3. Иерархия пользователей и роли

### 3.1. Уровни (`hierarchy_level`)

| Уровень | Роль в UI | `UserRole.name` | Права |
|---------|-----------|-----------------|-------|
| **0** | Директор | `admin` | Видит всё; управляет пользователями; приглашает менеджеров и агентов |
| **1** | Менеджер | `manager` | Видит себя и подчинённых агентов; приглашает только агентов; настройки — только чтение (кроме «Моя команда») |
| **2** | Агент | `agent` | Видит только свои клиенты/проекты |

**Определение директора:** `hierarchy_level == 0` **или** `role.name == admin` (без учёта регистра).

### 3.2. Видимость данных

Реализовано в `app/services/user_hierarchy.py`:

- **`get_visible_user_ids`:** директор → `None` (все); менеджер → себя + потомки из `user_hierarchy`; агент → только `{self.id}`.
- **`get_visible_project_ids`:** директор → все проекты; иначе проект виден, если пересечение `{customer.created_by, project.created_by, project.manager_id}` с видимыми user id не пусто.
- **Клиенты:** фильтр по `created_by_user_id` в видимых user id.
- **Спецификации (список без project_id):** все для директора; для остальных — только по видимым `project_id`.
- **Пользователи (`/api/users`):** только директор (`require_admin`).

### 3.3. Иерархия при создании пользователя

При регистрации по приглашению или через `create_user_with_hierarchy`:

1. Создаётся `AuthUser` с `parent_user_id` и `hierarchy_level`.
2. В `user_hierarchy` добавляется строка `(user, user, depth=0)` и строки от всех предков родителя.

**Приглашения (`UserInvite`):**

- Директор приглашает менеджера (level 1): `parent_user_id` = директор.
- Директор приглашает агента (level 2): обязателен `parent_user_id` — менеджер level 1.
- Менеджер приглашает только агента (level 2): `parent` = сам менеджер.
- Срок ссылки: **14 дней**. URL: `/register?invite={token}`.
- Роль подставляется автоматически: level 1 → `manager`, level 2 → `agent`.

---

## 4. Создание и удаление пользователей

### 4.1. Первый пользователь (bootstrap)

`POST /api/auth/setup` — только если в `auth_user` **0 записей**.

- Создаётся пользователь с ролью `admin`, `hierarchy_level = 0`.
- Заполняется `user_hierarchy`.
- Возвращается JWT.

`GET /api/auth/has-users` — проверка без авторизации (для редиректа на setup/login).

### 4.2. Обычный вход

`POST /api/auth/login` — `nic` + `password` → JWT (`sub` = user id, HS256, срок из конфига).

Все `/api/*` (кроме auth/setup/has-users, preview приглашения) требуют заголовок `Authorization: Bearer …`.

### 4.3. Создание через настройки (только директор)

`POST /api/users` — `require_admin`.

Поля: `nic`, `password`, ФИО, email, `role_id`, `branch_id`.

**Ограничение текущей реализации:** этот путь **не** выставляет `hierarchy_level` и **не** строит `user_hierarchy` (в отличие от приглашений). Для полноценной иерархии используется приглашение или доработка вручную в БД.

### 4.4. Создание через приглашение

1. Директор/менеджер: `POST /api/invites` → ссылка.
2. Новый пользователь: `GET /api/invites/preview?token=…` → форма регистрации.
3. `POST /api/auth/register` (с token) → `create_user_with_hierarchy`, invite помечается `accepted_at`.

### 4.5. Изменение пользователя

`PATCH /api/users/{id}` — директор; можно сменить пароль, роль, филиал.

`PATCH /api/auth/me/dashboard-columns` — сохранение видимых столбцов дашборда в `dashboard_columns_json`.

### 4.6. Удаление пользователя

`DELETE /api/users/{id}` — директор.

- **Нельзя** удалить самого себя.
- Жёсткое `db.delete(user)` — **нет** каскадной перепривязки `created_by_user_id` у клиентов/проектов (на практике удаление может упасть по FK или оставить «висячие» ссылки — учесть при переносе на Go).

Отмена неиспользованного приглашения: `DELETE /api/invites/{id}`.

---

## 5. Бизнес-правила

### 5.1. Клиент

- При создании клиента автоматически создаётся **первый проект** со статусом по умолчанию (первый по `sort_order`).
- Номер клиента: `A` + 5 цифр; проекта: `A00001-P01`; спецификации: `A00001-P01-S01`.
- Телефон проверяется на уникальность (`GET /api/customers/check-phone`).
- `deal_status`: в работе / успех / отказ (отдельно от статуса **проекта**).
- **Удаление клиента** — каскадное (`delete_customer_bundle`): проекты, спецификации, заказы, КП, договоры, логи статусов, события активности, затем клиент.

### 5.2. Проект и дашборд

- Статусы проекта настраиваются в «Настройки → Статусы проектов»: поле `action` определяет колонку «Действие» и плитки фильтра (КП, звонок, договор).
- **Терминальные статусы** (по имени содержит «успеш»/«успех» или «отказ»): по умолчанию скрыты в таблице дашборда; в карточке **«Все»** в сумму и счётчик **не входят**.
- Смена статуса пишет `project_status_logs` и при совпадении правил — событие в `user_activity_events` (КП отправлено, звонок, договор).
- SLA: `execution_days` от `status_started_at`; просрочка в `status_sla_overdue`.
- Сумма на дашборде: `specifications_total_amount` проекта или `total_amount`.

### 5.3. Спецификация

- Габариты по умолчанию при создании: 5×6 м, 1 этаж, `wall_height_m = 2.8`.
- Позиции пересчитываются при смене габаритов (`qty_basis`: perimeter, area, linked_wall_kit_qty, wall_insulation_sds и др.).
- `kp_approved = true` → сумма спецификации копируется в `project.total_amount`.
- Генерация PDF/HTML КП и договоров через отдельные сервисы (`kp_pdf`, `kp_html`, `contract_pdf`, шаблоны с плейсхолдерами).
- Шаблон дома (`apply-house-template`) заполняет позиции из `house_templates`.

### 5.4. Команда и активность

- `GET /api/team/members` — директор видит всех; менеджер — подчинённых.
- `GET /api/team/activity` — агрегат по дням (МСК) и типам событий для дашборда «Активность команды».
- Типы событий: клиенты, проекты, спецификации, КП, звонки, договор.

### 5.5. Настройки (UI)

- Менеджер: разделы настроек **только для чтения**, кроме **«Моя команда»** (приглашения).
- Директор: полный доступ, включая «Пользователи».

### 5.6. Удаление проекта

`delete_projects_bundle`: заказы → спецификации (с позициями, фото, КП) → события активности → HTML договоров → данные договора → логи статусов → проект.

---

## 6. API (основные префиксы)

| Префикс | Назначение |
|---------|------------|
| `/api/auth` | login, setup, me, dashboard-columns |
| `/api/users` | CRUD пользователей, roles (директор) |
| `/api/invites` | приглашения |
| `/api/team` | members, activity |
| `/api/customers` | клиенты, паспорт (upload/download) |
| `/api/projects` | проекты |
| `/api/specifications` | спецификации, позиции, PDF КП/договоров |
| `/api/project-statuses` | статусы проектов |
| `/api/project-status-logs` | логи |
| `/api/branches`, `/api/lead-sources`, `/api/organizations` | справочники |
| `/api/parts`, `/api/nomenclature-items`, `/api/house-templates`, … | номенклатура и шаблоны |
| `/api/contract-templates`, `/api/kp-html-templates`, `/api/print-settings` | печать |
| `/api/specification-photos` | фото КП |
| `/health`, `/health/db` | healthcheck |

Полный список роутеров: `app/main.py`.

---

## 7. Фронтенд

- **React SPA** (`frontend/src`): маршруты в `App.tsx`.
- Основные экраны: `Dashboard`, `Customers`, `ProjectSpecifications`, `Settings/*`, `Team`, `Login`, `Setup`, `RegisterInvite`.
- Роли на клиенте: `utils/userRoles.ts` (`isAdminUser`, `isManagerUser`, `isAgentUser`).
- API-клиент: `api/client.ts` (fetch + JWT из localStorage).
- Сборка: `npm run build` → `frontend/dist`, отдаётся FastAPI.

---

## 8. Миграции и схема БД

- База могла наследоваться от web2py — много `ensure_*_schema.py` и `migrate_*.py`, запуск при старте (`main.py` lifespan) и через `deploy/run-migrate.sh`.
- Идемпотентные `ALTER TABLE … ADD COLUMN IF NOT EXISTS` для PostgreSQL.
- Отдельные миграции: иерархия пользователей, активность, статусы проектов, building_type, created_by и т.д.

---

## 9. Что учесть при переносе на Go

1. **Паритет API** — желательно сохранить те же URL и JSON-поля для существующего React или параллельной миграции UI.
2. **Иерархия** — closure table + те же правила видимости.
3. **Каскадные удаления** — явная логика в сервисном слое (как `cascade_delete.py`).
4. **PDF/договоры** — отдельный объём (WeasyPrint/wkhtmltopdf или аналог в Go).
5. **Миграции** — golang-migrate / goose с экспортом текущей схемы PostgreSQL.
6. **Создание user через `/api/users`** — сейчас без hierarchy; решить: исправить или оставить только invite-flow.

---

## 10. Файлы-ориентиры в репозитории

| Область | Путь |
|---------|------|
| Модели | `app/models/crm.py` |
| Иерархия | `app/services/user_hierarchy.py` |
| Auth | `app/services/auth.py`, `app/routers/auth.py` |
| Пользователи | `app/routers/users.py` |
| Приглашения | `app/routers/invites.py` |
| Каскадное удаление | `app/services/cascade_delete.py` |
| Активность | `app/services/user_activity.py` |
| Дашборд (UI) | `frontend/src/pages/Dashboard.tsx` |
| Правила статусов | `frontend/src/utils/dashboardActionTiles.ts` |

---

*Документ: `SYSTEM_DESCRIPTION.md` в корне репозитория smetadoma05.*
