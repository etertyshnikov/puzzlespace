# -*- coding: utf-8 -*-
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import get_settings
from app.database import SessionLocal
from app.services.auth import get_current_user
from app.routers import (
    customers,
    branches,
    lead_sources,
    health,
    specification_statuses,
    project_statuses,
    project_status_logs,
    projects,
    specifications,
    parts,
    nomenclature_items,
    required_item_templates,
    house_specification_templates,
    house_templates,
    required_item_materials,
    specification_required_items,
    organizations,
    companies,
    contract_templates,
    kp_html_templates,
    print_settings,
    amount_to_words as amount_to_words_router,
    generate_pdf,
    specification_photos,
    auth as auth_router,
    users as users_router,
    invites as invites_router,
    register_links as register_links_router,
    notifications as notifications_router,
    chat as chat_router,
    team as team_router,
    schemaspy as schemaspy_router,
    portal as portal_router,
    estimate_quiz as estimate_quiz_router,
)

import app.models  # noqa: F401 — регистрация ORM-моделей для роутеров


def _seed_roles() -> None:
    from app.models.crm import UserRole
    db = SessionLocal()
    try:
        for idx, (name, desc) in enumerate([
            ("admin", "Администратор"),
            ("admin_manager", "Админ/менеджер"),
            ("manager", "Менеджер"),
            ("agent", "Агент"),
            ("viewer", "Просмотр"),
        ]):
            if not db.query(UserRole).filter(UserRole.name == name).first():
                db.add(UserRole(name=name, description=desc, sort_order=idx))
        db.commit()
    finally:
        db.close()


def _seed_project_statuses() -> None:
    from app.services import project_status as project_status_service

    db = SessionLocal()
    try:
        project_status_service.ensure_default_statuses_seeded(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """При старте: seed справочников (роли, статусы проектов). Схема БД — alembic upgrade head."""
    try:
        _seed_roles()
    except Exception:
        pass
    try:
        _seed_project_statuses()
    except Exception:
        pass
    yield


settings = get_settings()

# Корень проекта (папка smetadoma03)
BASE_DIR = Path(__file__).resolve().parent.parent
# Статика: в FastAPI принято хранить в каталоге static в корне проекта
STATIC_DIR = BASE_DIR / "static"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

app = FastAPI(
    title="Smetadoma03 API",
    description="CRM для учёта клиентов и номенклатуры деревянных домов",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Раздача статики по /static (CSS, JS, изображения из static/)
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

_auth_dep = [Depends(get_current_user)]

app.include_router(health.router, tags=["health"])
app.include_router(portal_router.router, prefix="/api/portal", tags=["portal"])
app.include_router(estimate_quiz_router.router, prefix="/api/estimate", tags=["estimate"])
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router.router, prefix="/api/users", tags=["users"])
app.include_router(invites_router.router, prefix="/api/invites", tags=["invites"])
app.include_router(register_links_router.router, prefix="/api/register-links", tags=["register-links"])
app.include_router(notifications_router.router, prefix="/api/notifications", tags=["notifications"], dependencies=_auth_dep)
app.include_router(chat_router.router, prefix="/api/chat", tags=["chat"], dependencies=_auth_dep)
app.include_router(team_router.router, prefix="/api/team", tags=["team"], dependencies=_auth_dep)
app.include_router(customers.router, prefix="/api/customers", tags=["customers"], dependencies=_auth_dep)
app.include_router(branches.router, prefix="/api/branches", tags=["branches"], dependencies=_auth_dep)
app.include_router(lead_sources.router, prefix="/api/lead-sources", tags=["lead_sources"], dependencies=_auth_dep)
app.include_router(specification_statuses.router, prefix="/api/specification-statuses", tags=["specification_statuses"], dependencies=_auth_dep)
app.include_router(project_statuses.router, prefix="/api/project-statuses", tags=["project_statuses"], dependencies=_auth_dep)
app.include_router(project_status_logs.router, prefix="/api/project-status-logs", tags=["project_status_logs"], dependencies=_auth_dep)
app.include_router(projects.router, prefix="/api/projects", tags=["projects"], dependencies=_auth_dep)
app.include_router(specifications.router, prefix="/api/specifications", tags=["specifications"], dependencies=_auth_dep)
app.include_router(parts.router, prefix="/api/parts", tags=["parts"], dependencies=_auth_dep)
app.include_router(nomenclature_items.router, prefix="/api/nomenclature-items", tags=["nomenclature_items"], dependencies=_auth_dep)
app.include_router(required_item_templates.router, prefix="/api/required-item-templates", tags=["required_item_templates"], dependencies=_auth_dep)
app.include_router(house_specification_templates.router, prefix="/api/house-specification-templates", tags=["house_specification_templates"], dependencies=_auth_dep)
app.include_router(house_templates.router, prefix="/api/house-templates", tags=["house_templates"], dependencies=_auth_dep)
app.include_router(required_item_materials.router, prefix="/api/required-item-materials", tags=["required_item_materials"], dependencies=_auth_dep)
app.include_router(specification_required_items.router, prefix="/api/specification-required-items", tags=["specification_required_items"], dependencies=_auth_dep)
app.include_router(organizations.router, prefix="/api/organizations", tags=["organizations"], dependencies=_auth_dep)
app.include_router(companies.router, prefix="/api/companies", tags=["companies"], dependencies=_auth_dep)
app.include_router(contract_templates.router, prefix="/api/contract-templates", tags=["contract_templates"], dependencies=_auth_dep)
app.include_router(kp_html_templates.router, prefix="/api/kp-html-templates", tags=["kp_html_templates"], dependencies=_auth_dep)
app.include_router(print_settings.router, prefix="/api/print-settings", tags=["print_settings"], dependencies=_auth_dep)
app.include_router(amount_to_words_router.router, prefix="/api/amount-to-words", tags=["amount_to_words"], dependencies=_auth_dep)
app.include_router(generate_pdf.router, prefix="/api/generate-pdf", tags=["generate_pdf"], dependencies=_auth_dep)
app.include_router(specification_photos.router, prefix="/api/specification-photos", tags=["specification_photos"], dependencies=_auth_dep)

# SchemaSpy API — явная регистрация (избегаем 405 на POST, если include_router не подхватился)
app.add_api_route(
    "/api/dev/schemaspy/status",
    schemaspy_router.schemaspy_status,
    methods=["GET"],
    tags=["dev"],
)
app.add_api_route(
    "/api/dev/schemaspy/generate",
    schemaspy_router.schemaspy_generate,
    methods=["POST"],
    tags=["dev"],
)


@app.api_route("/api/{rest_of_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"], include_in_schema=False)
async def api_not_found(rest_of_path: str):
    """Неизвестный API-маршрут — 404 вместо 405 от SPA catch-all."""
    raise HTTPException(status_code=404, detail=f"Unknown API: /api/{rest_of_path}")


@app.get("/schemaspy", include_in_schema=False)
@app.get("/schemaspy/{file_path:path}", include_in_schema=False)
def serve_schemaspy(file_path: str = ""):
    """Статический HTML-отчёт SchemaSpy (генерируется scripts/schemaspy-generate.sh)."""
    return schemaspy_router.serve_schemaspy_file(file_path)


def _spa_path_allowed(path: str) -> bool:
    """Маршруты API/статики бэкенда не отдаём через SPA."""
    if not path:
        return True
    head = path.split("/", 1)[0]
    if head in ("api", "static", "schemaspy", "docs", "redoc", "health", "openapi.json"):
        return False
    return True


if FRONTEND_DIST.is_dir():
    _spa_assets = FRONTEND_DIST / "assets"
    if _spa_assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_spa_assets)), name="frontend-assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa_fallback(full_path: str = ""):
        """React Router: при F5 на /projects/… отдаём index.html, а не JSON 404."""
        if not _spa_path_allowed(full_path):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path:
            file_path = (FRONTEND_DIST / full_path).resolve()
            try:
                file_path.relative_to(FRONTEND_DIST.resolve())
            except ValueError:
                raise HTTPException(status_code=404, detail="Not Found") from None
            if file_path.is_file():
                return FileResponse(file_path)
        index_path = FRONTEND_DIST / "index.html"
        if index_path.is_file():
            return FileResponse(
                index_path,
                headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
            )
        raise HTTPException(status_code=404, detail="Not Found")
else:

    @app.get("/")
    def root():
        return {
            "message": "Smetadoma03 API. Соберите фронт: cd frontend && npm run build",
            "docs": "/docs",
        }
