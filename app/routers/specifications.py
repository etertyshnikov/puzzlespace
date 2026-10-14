# -*- coding: utf-8 -*-
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NomenclatureItem
from app.schemas.specifications import (
    SpecificationCreate,
    SpecificationOut,
    SpecificationUpdate,
    SpecificationItemOut,
    SpecificationItemUpdate,
    SpecificationItemAddBody,
    ApplyHouseTemplateBody,
)
from app.services import specification as spec_service
from app.services import specification_item as item_service
from app.services import project as project_service
from app.services import part as part_service
from app.services import customer as customer_service
from app.services import branch as branch_service
from app.services import kp_pdf as kp_pdf_service
from app.services import kp_overlay_pdf as kp_overlay_pdf_service
from app.services import kp_html as kp_html_service
from app.services import kp_crm_html as kp_crm_html_service
from app.services import kp_crm_pdf as kp_crm_pdf_service
from app.services import contract_pdf as contract_pdf_service
from app.services.kp_crm_data import _spec_total_amount
from app.services.auth import get_current_user
from app.models.crm import AuthUser
from app.services.user_hierarchy import get_visible_project_ids, is_project_visible_to_user
from app.models.crm import Customer, Project

router = APIRouter()
logger = logging.getLogger(__name__)


def _handle_kp_overlay_exc(exc: Exception) -> None:
    if isinstance(exc, FileNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.exception("KP overlay PDF generation failed")
    raise HTTPException(
        status_code=500,
        detail=f"Ошибка формирования PDF: {exc}",
    ) from exc


def _assert_project_visible(db: Session, user: AuthUser, project_id: int) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    customer_creator_id = None
    if project.customer_id:
        customer_creator_id = (
            db.query(Customer.created_by_user_id)
            .filter(Customer.id == project.customer_id)
            .scalar()
        )
    if not is_project_visible_to_user(
        db,
        user,
        customer_creator_id=customer_creator_id,
        project_created_by_user_id=project.created_by_user_id,
    ):
        raise HTTPException(status_code=403, detail="Нет доступа к проекту")


@router.get("", response_model=list[SpecificationOut])
def list_specifications(
    project_id: int | None = Query(None, description="Фильтр по проекту"),
    skip: int = 0,
    limit: int = Query(10000, le=50000),
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    try:
        if project_id is not None:
            _assert_project_visible(db, user, project_id)
            return spec_service.list_by_project(db, project_id)
        visible_project_ids = get_visible_project_ids(db, user)
        if visible_project_ids is None:
            return spec_service.list_all(db, skip=skip, limit=limit)
        return spec_service.list_for_project_ids(
            db, visible_project_ids, skip=skip, limit=limit
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_specifications failed")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка загрузки спецификаций: {exc}",
        ) from exc


@router.post("", response_model=SpecificationOut, status_code=201)
def create_specification(
    payload: SpecificationCreate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    data = payload.model_dump()
    data["created_by_user_id"] = user.id
    created = spec_service.create(db, actor_user_id=user.id, **data)
    if created.project_id is not None:
        specs_in_project = spec_service.list_by_project(db, created.project_id)
        if len(specs_in_project) == 1:
            project_service.update(
                db,
                created.project_id,
                changed_by_user_id=user.id,
                status_id=7,
            )
    return created


@router.patch("/{specification_id}", response_model=SpecificationOut)
def update_specification(
    specification_id: int,
    payload: SpecificationUpdate,
    db: Session = Depends(get_db),
):
    patch = payload.model_dump(exclude_unset=True)
    row = spec_service.update(db, specification_id, **patch)
    if not row:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    if patch.keys() & {
        "length_m",
        "width_m",
        "terrace_length_m",
        "terrace_width_m",
        "floors",
        "room_count",
        "double_timber",
        "terrace_second_floor",
        "wall_height_m",
    }:
        item_service.recalc_items_for_spec_dimensions(db, specification_id)
    if row.project_id is not None:
        if payload.kp_approved is True:
            amount = float(row.total_amount) if row.total_amount is not None else 0
            project_service.update(db, row.project_id, total_amount=amount)
        elif payload.kp_approved is False:
            project_service.update(db, row.project_id, total_amount=0)
    return row


@router.delete("/{specification_id}", status_code=204)
def delete_specification(specification_id: int, db: Session = Depends(get_db)):
    """Удалить спецификацию и все её позиции."""
    if not spec_service.delete(db, specification_id):
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    return None


@router.get("/{specification_id}/items", response_model=list[SpecificationItemOut])
def list_specification_items(specification_id: int, db: Session = Depends(get_db)):
    items = item_service.list_by_specification(db, specification_id)
    result = []
    for it in items:
        out = SpecificationItemOut.model_validate(it)
        if getattr(it, "nomenclature_item_id", None):
            nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == it.nomenclature_item_id).first()
            if nom:
                out.nomenclature_name = (nom.name or nom.item_number or "—").strip() or nom.item_number
        result.append(out)
    return result


@router.get("/{specification_id}/kp-html")
def get_specification_kp_html(specification_id: int, db: Session = Depends(get_db)):
    """КП в HTML с данными CRM (шаблон из настроек или встроенный)."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        html = kp_crm_html_service.build_kp_crm_html(db, specification_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.get("/{specification_id}/kp-standart-client-html")
def get_specification_kp_standart_client_html(specification_id: int, db: Session = Depends(get_db)):
    """КП «Стандарт» для клиента: только таблица, без подложки и текста."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        html = kp_crm_html_service.build_kp_crm_html(db, specification_id, client_table_only=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.get("/{specification_id}/kp-standart-client-pdf")
async def get_specification_kp_standart_client_pdf(specification_id: int, db: Session = Depends(get_db)):
    """PDF КП «Стандарт» для клиента: только таблица позиций."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes = await kp_crm_pdf_service.build_kp_crm_pdf(
            db, specification_id, client_table_only=True
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}") from e
    spec_number = getattr(spec, "number", None) or str(specification_id)
    filename = f"kp_standart_client_{spec_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-pdf")
def get_specification_kp_pdf(specification_id: int, db: Session = Depends(get_db)):
    """Скачать КП (коммерческое предложение) по позициям спецификации в PDF."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    items = item_service.list_for_kp(db, specification_id)
    parts = part_service.list_all(db)
    items_data = [
        {
            "item_name": getattr(it, "item_name", None),
            "quantity": getattr(it, "quantity", None),
            "unit": getattr(it, "unit", None),
            "price": getattr(it, "price", None),
            "total": getattr(it, "total", None),
            "part_id": getattr(it, "part_id", None),
            "include_in_total": bool(getattr(it, "include_in_total", True)),
        }
        for it in items
    ]
    parts_data = [{"id": p.id, "name": p.name} for p in parts]
    specification_number = getattr(spec, "number", None)
    pdf_bytes = kp_pdf_service.build_kp_pdf(
        specification_id,
        _spec_total_amount(spec, items_data),
        items_data,
        parts_data,
        specification_number=specification_number,
    )
    filename = f"kp_{specification_number or specification_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-overlay-pdf")
def get_specification_kp_overlay_pdf(specification_id: int, db: Session = Depends(get_db)):
    """КП в PDF: подложка landscape + текст (ReportLab + pypdf)."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes = kp_overlay_pdf_service.build_kp_overlay_pdf(db, specification_id)
    except Exception as e:
        _handle_kp_overlay_exc(e)
    spec_number = getattr(spec, "number", None) or str(specification_id)
    filename = f"kp_overlay_{spec_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-overlay-client-pdf")
def get_specification_kp_overlay_client_pdf(specification_id: int, db: Session = Depends(get_db)):
    """КП для клиента: подложка, текст слева / фото справа, таблица без цены за единицу."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes = kp_overlay_pdf_service.build_kp_overlay_client_pdf(db, specification_id)
    except Exception as e:
        _handle_kp_overlay_exc(e)
    spec_number = getattr(spec, "number", None) or str(specification_id)
    filename = f"kp_client_{spec_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-overlay-client2-pdf")
def get_specification_kp_overlay_client2_pdf(specification_id: int, db: Session = Depends(get_db)):
    """КП для клиента: 1 согласованная спецификация — КП; 2+ — КП сводное."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes, filename_base = kp_overlay_pdf_service.build_kp_overlay_client2_pdf(
            db, specification_id
        )
    except Exception as e:
        _handle_kp_overlay_exc(e)
    filename = f"{filename_base}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-overlay-client-v2-pdf")
def get_specification_kp_overlay_client_v2_pdf(specification_id: int, db: Session = Depends(get_db)):
    """КП для клиента 2: как «КП для клиента», без логотипа и брендинга «Дома кубани»."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes, filename_base = kp_overlay_pdf_service.build_kp_overlay_client_v2_pdf(
            db, specification_id
        )
    except Exception as e:
        _handle_kp_overlay_exc(e)
    filename = f"{filename_base}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-overlay-consolidated-pdf")
def get_specification_kp_overlay_consolidated_pdf(specification_id: int, db: Session = Depends(get_db)):
    """КП сводное: только сводное КП (согласованные спецификации проекта), PDF-подложка."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    try:
        pdf_bytes = kp_overlay_pdf_service.build_kp_overlay_consolidated_pdf(db, specification_id)
    except Exception as e:
        _handle_kp_overlay_exc(e)
    spec_number = getattr(spec, "number", None) or str(specification_id)
    filename = f"kp_consolidated_{spec_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{specification_id}/kp-photo-html")
def get_specification_kp_photo_html(specification_id: int, db: Session = Depends(get_db)):
    """КП с фотографиями: двухколоночный HTML (фото слева, таблица справа, группировка по частям)."""
    from app.models.crm import SpecificationPhoto

    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    items = item_service.list_for_kp(db, specification_id)
    parts = part_service.list_all(db)
    items_data = [
        {
            "item_name": getattr(it, "item_name", None),
            "quantity": getattr(it, "quantity", None),
            "unit": getattr(it, "unit", None),
            "price": getattr(it, "price", None),
            "total": getattr(it, "total", None),
            "part_id": getattr(it, "part_id", None),
            "include_in_total": bool(getattr(it, "include_in_total", True)),
        }
        for it in items
    ]
    parts_data = [{"id": p.id, "name": p.name} for p in parts]

    photos_db = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )
    photos_data = [
        {
            "image_data": p.image_data,
            "content_type": p.content_type or "image/jpeg",
            "filename": p.filename or "photo",
        }
        for p in photos_db
        if p.image_data
    ]

    html = kp_html_service.build_kp_html(
        specification_number=getattr(spec, "number", None),
        total_amount=_spec_total_amount(spec, items_data),
        items=items_data,
        parts=parts_data,
        photos=photos_data,
    )
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.get("/{specification_id}/kp-photo-noprice-html")
def get_specification_kp_photo_noprice_html(specification_id: int, db: Session = Depends(get_db)):
    """КП с фото без цен: фото слева, таблица без столбцов «Цена»/«Сумма», но с «Итого»."""
    from app.models.crm import SpecificationPhoto

    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    items = item_service.list_for_kp(db, specification_id)
    parts = part_service.list_all(db)
    items_data = [
        {
            "item_name": getattr(it, "item_name", None),
            "quantity": getattr(it, "quantity", None),
            "unit": getattr(it, "unit", None),
            "price": getattr(it, "price", None),
            "total": getattr(it, "total", None),
            "part_id": getattr(it, "part_id", None),
            "include_in_total": bool(getattr(it, "include_in_total", True)),
        }
        for it in items
    ]
    parts_data = [{"id": p.id, "name": p.name} for p in parts]

    photos_db = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )
    photos_data = [
        {
            "image_data": p.image_data,
            "content_type": p.content_type or "image/jpeg",
            "filename": p.filename or "photo",
        }
        for p in photos_db
        if p.image_data
    ]

    html = kp_html_service.build_kp_html(
        specification_number=getattr(spec, "number", None),
        total_amount=_spec_total_amount(spec, items_data),
        items=items_data,
        parts=parts_data,
        photos=photos_data,
        hide_prices=True,
    )
    return Response(content=html, media_type="text/html; charset=utf-8")


@router.get("/{specification_id}/contract-pdf")
def get_specification_contract_pdf(specification_id: int, db: Session = Depends(get_db)):
    """Скачать договор поставки (PDF): стр.1 — договор с данными заказчика, стр.2 — КП (другой вид). Файл сохраняется в папку contracts."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    customer_id = getattr(spec, "customer_id", None)
    if not customer_id:
        raise HTTPException(status_code=400, detail="У спецификации не указан заказчик")
    customer = customer_service.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Заказчик не найден")
    items = item_service.list_for_kp(db, specification_id)
    items_data = [
        {
            "item_name": getattr(it, "item_name", None),
            "quantity": getattr(it, "quantity", None),
            "unit": getattr(it, "unit", None),
            "price": getattr(it, "price", None),
            "total": getattr(it, "total", None),
            "include_in_total": bool(getattr(it, "include_in_total", True)),
        }
        for it in items
    ]
    branches = branch_service.list_all(db)
    supplier_name = "Поставщик"
    supplier_phone = ""
    if branches:
        b = branches[0]
        supplier_name = getattr(b, "name", None) or supplier_name
        supplier_phone = getattr(b, "phone", None) or ""
    customer_full_name = getattr(customer, "full_name", None) or " ".join(
        filter(None, [getattr(customer, "last_name", None), getattr(customer, "name", None), getattr(customer, "middle_name", None)])
    ) or getattr(customer, "name", None) or ""
    customer_address = getattr(customer, "address", None) or ""
    customer_phone = getattr(customer, "phone", None) or ""
    specification_number = getattr(spec, "number", None)
    pdf_bytes = contract_pdf_service.build_contract_pdf(
        specification_id=specification_id,
        customer_full_name=customer_full_name,
        customer_address=customer_address,
        customer_phone=customer_phone,
        supplier_name=supplier_name,
        supplier_phone=supplier_phone,
        items=items_data,
        total_amount=_spec_total_amount(spec, items_data),
        specification_number=specification_number,
    )
    filename = f"dogovor_postavki_{specification_number or specification_id}.pdf"
    contracts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "contracts")
    try:
        os.makedirs(contracts_dir, exist_ok=True)
        filepath = os.path.join(contracts_dir, filename)
        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
    except Exception:
        pass
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{specification_id}/items", response_model=SpecificationItemOut, status_code=201)
def create_specification_item(
    specification_id: int,
    payload: SpecificationItemAddBody,
    db: Session = Depends(get_db),
):
    """Добавить позицию в спецификацию."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    data = payload.model_dump(exclude_unset=True)
    item_name = data.pop("item_name", "—")
    if payload.nomenclature_item_id:
        from app.models import NomenclatureItem
        nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == payload.nomenclature_item_id).first()
        if nom:
            item_name = (nom.name or nom.item_number or "—").strip() or (nom.item_number or "—")
    quantity = data.get("quantity", 1)
    price = data.get("price", 0)
    discount_percent = data.get("discount_percent", 0) or 0
    discount_percent = min(max(float(discount_percent), 0.0), 100.0)
    discounted_price = round((float(price) * ((100.0 - discount_percent) / 100.0)) / 10.0) * 10.0
    total = round((float(quantity) * discounted_price) / 50.0) * 50.0
    created = item_service.create(
        db,
        specification_id=specification_id,
        item_name=item_name,
        quantity=quantity,
        unit=data.get("unit", "шт"),
        price=price,
        discount_percent=discount_percent,
        total=total,
        part_id=data.get("part_id"),
        template_id=data.get("template_id"),
        nomenclature_item_id=data.get("nomenclature_item_id"),
        description=data.get("description"),
    )
    return created


@router.patch("/{specification_id}/items/{item_id}", response_model=SpecificationItemOut)
def update_specification_item(
    specification_id: int,
    item_id: int,
    payload: SpecificationItemUpdate,
    db: Session = Depends(get_db),
):
    """Обновить позицию спецификации (кол-во, цена и т.д.)."""
    row = item_service.get_by_id(db, item_id)
    if not row or row.specification_id != specification_id:
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    updated = item_service.update(db, item_id, **payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    out = SpecificationItemOut.model_validate(updated)
    if getattr(updated, "nomenclature_item_id", None):
        nom = db.query(NomenclatureItem).filter(NomenclatureItem.id == updated.nomenclature_item_id).first()
        if nom:
            out.nomenclature_name = (nom.name or nom.item_number or "—").strip() or nom.item_number
    return out


@router.delete("/{specification_id}/items/{item_id}", status_code=204)
def delete_specification_item(
    specification_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    """Удалить позицию из спецификации."""
    row = item_service.get_by_id(db, item_id)
    if not row or row.specification_id != specification_id:
        raise HTTPException(status_code=404, detail="Позиция спецификации не найдена")
    item_service.delete(db, item_id)


@router.post("/{specification_id}/duplicate", response_model=SpecificationOut, status_code=201)
def duplicate_specification(specification_id: int, db: Session = Depends(get_db)):
    """Дублировать спецификацию: создать копию с теми же позициями."""
    created = spec_service.duplicate(db, specification_id)
    if not created:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    return created


@router.post("/{specification_id}/apply-house-template", response_model=list[SpecificationItemOut])
def apply_house_template(
    specification_id: int,
    payload: ApplyHouseTemplateBody,
    db: Session = Depends(get_db),
):
    """Скопировать позиции шаблона спецификации дома в указанную спецификацию."""
    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Спецификация не найдена")
    created = item_service.apply_house_template(
        db, specification_id, payload.house_specification_template_id
    )
    return created
