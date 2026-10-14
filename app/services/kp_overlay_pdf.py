# -*- coding: utf-8 -*-
"""
КП в PDF: подложка (шаблон) + текст ReportLab + объединение pypdf.
Аналог подхода template_landscape.pdf + canvas + merge_page.
"""
from __future__ import annotations

import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.utils import ImageReader

KP_LOGO_MAX_W = 320.0
KP_LOGO_MAX_H = 100.0
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.services.kp_crm_data import (
    KpDocumentData,
    _payment_for_spec,
    collect_kp_document_data,
)
from app.services.kp_landscape_assets import (
    KP_CONTACTS_EXTRA_CATALOG_LINKS,
    KP_CONTACTS_EXTRA_LINKS,
    KP_CONTACTS_EXTRA_MATERIALS_LINK,
    KP_CONTACTS_OFFICE_ADDRESSES,
    KP_DEFAULT_MANAGER_PHONE,
    KP_DEFAULT_MANAGER_PHONE_TEL,
    KP_FOOTER_DISCLAIMER_CLIENT,
    KP_FOOTER_DISCLAIMER_INTERNAL,
    KP_SIGNOFF_ORGANIZATION,
    _resolve_background_path,
    _resolve_logo_path,
    pdf_safe_link_url,
)
from app.services.kp_crm_data import _fmt_money, _num

PAGE_SIZE = landscape(A4)
PAGE_W, PAGE_H = PAGE_SIZE

ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_CACHED = ROOT / "static" / "templates" / "kp_landscape_template.pdf"

# Шрифт с кириллицей
try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    FONT_NAME = "Helvetica"
    FONT_BOLD = "Helvetica-Bold"
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        str(ROOT / "fonts" / "DejaVuSans.ttf"),
    ]:
        if os.path.isfile(path):
            pdfmetrics.registerFont(TTFont("KpCyrillic", path))
            FONT_NAME = "KpCyrillic"
            break
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if os.path.isfile(bold_path):
        pdfmetrics.registerFont(TTFont("KpCyrillic-Bold", bold_path))
        FONT_BOLD = "KpCyrillic-Bold"
    elif FONT_NAME == "KpCyrillic":
        FONT_BOLD = FONT_NAME
except Exception:
    FONT_NAME = "Helvetica"
    FONT_BOLD = "Helvetica-Bold"

MARGIN_L = 50
PAGE1_SPLIT_X = PAGE_W * 0.56
PAGE1_LEFT_MAX_CHARS = 48
TABLE_ROWS_PER_PAGE = 24
TABLE_ROW_LINE_H = 14
TABLE_NAME_COL_WIDTH = 268.0  # ширина колонки «Наименование» (с ценой)
FOOTER_PLAQUE_BOTTOM = 8.0
FOOTER_PLAQUE_HEIGHT = 44.0


def _background_page_pdf(width: float, height: float, image_path: Path) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    img = ImageReader(str(image_path))
    iw, ih = img.getSize()
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    x = (width - dw) / 2
    y = (height - dh) / 2
    c.drawImage(img, x, y, width=dw, height=dh, mask="auto")
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


@lru_cache(maxsize=1)
def _landscape_template_bytes() -> bytes:
    png = _resolve_background_path()
    if not png:
        raise FileNotFoundError(
            "Не найден файл подложки static/images/IMG_20260518_095427.png"
        )
    if TEMPLATE_CACHED.is_file():
        if TEMPLATE_CACHED.stat().st_mtime >= png.stat().st_mtime:
            return TEMPLATE_CACHED.read_bytes()
    data = _background_page_pdf(PAGE_W, PAGE_H, png)
    TEMPLATE_CACHED.parent.mkdir(parents=True, exist_ok=True)
    TEMPLATE_CACHED.write_bytes(data)
    return data


def _canvas_overlay(draw) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=PAGE_SIZE)
    draw(c)
    c.save()
    buf.seek(0)
    return buf.read()


def _merge_template_overlay(template_bytes: bytes, overlay_bytes: bytes) -> bytes:
    page = PdfReader(BytesIO(template_bytes)).pages[0]
    overlay = PdfReader(BytesIO(overlay_bytes)).pages[0]
    page.merge_page(overlay)
    out = BytesIO()
    writer = PdfWriter()
    writer.add_page(page)
    writer.write(out)
    return out.getvalue()


def _truncate(text: str, max_len: int) -> str:
    t = (text or "—").replace("\n", " ")
    return t if len(t) <= max_len else t[: max_len - 1] + "…"


def _load_specification_photos(db: Session, specification_id: int) -> list[tuple[bytes, str]]:
    from app.models.crm import SpecificationPhoto

    rows = (
        db.query(SpecificationPhoto)
        .filter(SpecificationPhoto.specification_id == specification_id)
        .order_by(SpecificationPhoto.sort_order, SpecificationPhoto.id)
        .all()
    )
    out: list[tuple[bytes, str]] = []
    for p in rows:
        if p.image_data:
            out.append((bytes(p.image_data), p.content_type or "image/jpeg"))
    return out


def _iter_table_rows(
    data: KpDocumentData,
    *,
    hide_unit_price: bool = False,
) -> list[tuple[str, str, str, str, str, str, bool]]:
    """Строки таблицы: (№, имя, ед, кол-во, цена, сумма, is_part_header). Цена пустая при hide_unit_price."""
    by_part: dict = {}
    for it in data.items_data:
        key = it.get("part_id") if it.get("part_id") is not None else "none"
        by_part.setdefault(key, []).append(it)

    part_order: list = []
    for p in data.parts_data:
        if p["id"] in by_part:
            part_order.append(p["id"])
    if "none" in by_part:
        part_order.append("none")
    for key in by_part:
        if key not in part_order:
            part_order.append(key)

    parts_by_id = {p["id"]: p["name"] for p in data.parts_data}
    rows: list[tuple[str, str, str, str, str, str, bool]] = []
    n = 0
    for key in part_order:
        group = by_part.get(key, [])
        if not group:
            continue
        if key != "none" and len(part_order) > 1:
            part_name = parts_by_id.get(key, "Часть")
            rows.append(("", part_name, "", "", "", "", True))
        for it in group:
            n += 1
            qty = _num(it.get("quantity"))
            price = "" if hide_unit_price else _fmt_money(it.get("price"))
            total = _fmt_money(it.get("total"))
            rows.append(
                (
                    str(n),
                    str(it.get("item_name") or "—"),
                    str(it.get("unit") or "шт"),
                    f"{qty:g}",
                    price,
                    total,
                    False,
                )
            )
    if not rows:
        rows.append(("", "Позиции не добавлены", "", "", "", "", False))
    return rows


def _draw_kp_logo(c: canvas.Canvas, x: float, y_top: float, d: KpDocumentData) -> float:
    """Рисует логотип; возвращает Y нижней границы блока логотипа."""
    path = _resolve_logo_path()
    if not path:
        c.setFont(FONT_BOLD, 18)
        c.setFillColor(colors.HexColor("#1e7e6a"))
        c.drawString(x, y_top - 16, d.organization_name)
        return y_top - 22

    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = min(KP_LOGO_MAX_W / iw, KP_LOGO_MAX_H / ih)
    dw, dh = iw * scale, ih * scale
    y_bottom = y_top - dh
    c.drawImage(img, x, y_bottom, width=dw, height=dh, mask="auto")
    return y_bottom


def _draw_page1_header(c: canvas.Canvas, d: KpDocumentData, *, hide_branding: bool = False) -> float:
    """Шапка первой страницы; возвращает Y ниже логотипа/подзаголовка."""
    if hide_branding:
        c.setFont(FONT_BOLD, 14)
        c.setFillColor(colors.black)
        c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 55, "Коммерческое предложение")
        c.setFont(FONT_NAME, 11)
        c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 75, f"№ {d.kp_number} от {d.kp_date}")
        c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 90, "Срок действия: 14 календарных дней")
        return PAGE_H - 126

    logo_bottom = _draw_kp_logo(c, MARGIN_L, PAGE_H - 55, d)

    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.HexColor("#444444"))
    c.drawString(MARGIN_L, logo_bottom - 14, "Дома из минибруса")

    c.setFont(FONT_BOLD, 14)
    c.setFillColor(colors.black)
    c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 55, "Коммерческое предложение")
    c.setFont(FONT_NAME, 11)
    c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 75, f"№ {d.kp_number} от {d.kp_date}")
    c.drawRightString(PAGE_W - MARGIN_L, PAGE_H - 90, "Срок действия: 14 календарных дней")
    return logo_bottom - 36


def _text_width(c: canvas.Canvas, text: str, font: str, size: int) -> float:
    c.setFont(font, size)
    return c.stringWidth(text, font, size)


def _value_column_x(
    c: canvas.Canvas,
    labels: list[str],
    x_left: float,
    *,
    gap: float = 6,
) -> float:
    """X начала значения: после самой длинной подписи «…:»."""
    max_w = 0.0
    for label in labels:
        label_text = label if label.endswith(":") else f"{label}:"
        max_w = max(max_w, _text_width(c, label_text, FONT_BOLD, 10))
    return x_left + max_w + gap


def _value_lines(val: str, wrap_chars: int) -> list[str]:
    """Строки значения: переводы строк сохраняются, длинные части переносятся по словам."""
    text = str(val or "—")
    lines: list[str] = []
    for part in text.replace("\r\n", "\n").split("\n"):
        part = part.strip()
        if not part:
            continue
        wrapped = _wrap_text(part, wrap_chars)
        lines.extend(wrapped if wrapped else [""])
    return lines or ["—"]


def _draw_page1_params(
    c: canvas.Canvas,
    d: KpDocumentData,
    y_start: float,
    *,
    x_left: float = MARGIN_L,
    label_offset: float = 155,
    value_max_len: int = 60,
    wrap_intro: int = 95,
    col_right: float | None = None,
    stacked_labels: bool = False,
    auto_value_column: bool = False,
) -> float:
    """Рисует блок параметров; возвращает Y нижней строки."""
    y = y_start
    line_h = 13
    c.setFont(FONT_NAME, 11)
    c.drawString(x_left, y, f"Уважаемый(ая) {d.customer_full_name}!")
    y -= 22
    intro = (
        f"Направляем Вам коммерческое предложение по проекту «{d.project_title}» "
        f"на основании спецификации {d.specification_number}."
    )
    for line in _wrap_text(intro, wrap_intro):
        c.drawString(x_left, y, line)
        y -= 14

    y -= 8
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(colors.HexColor("#1e7e6a"))
    c.drawString(x_left, y, "1. Параметры объекта")
    y -= 18
    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.black)
    params = [
        ("Проект", f"{d.project_number} — {d.project_name}"),
        ("Спецификация", d.specification_number),
        ("Заказчик", d.customer_contact_line),
        ("Адрес участка", d.customer_address),
        ("Тип дома", d.house_type),
        ("Площадь", d.house_area),
        ("Этажность", d.floors_label),
        ("Количество комнат", d.room_count_label),
        ("Двойной брус", d.double_timber_label),
        ("Терраса", d.terrace_label),
        ("Терраса на втором этаже", d.terrace_second_floor_label),
        ("Примечание", d.foundation),
        ("Срок поставки комплекта", d.delivery_terms),
    ]
    if auto_value_column:
        value_x = _value_column_x(c, [p[0] for p in params], x_left)
    else:
        value_x = x_left + label_offset
    max_value_w = (col_right - value_x) if col_right is not None else None
    wrap_chars = (
        max(12, int((col_right - x_left - 12) / 5.2))
        if col_right is not None
        else value_max_len
    )

    for label, value in params:
        label_text = label if label.endswith(":") else f"{label}:"
        val = str(value or "—")
        use_stacked = stacked_labels
        if not use_stacked and col_right is not None:
            lw = _text_width(c, label_text, FONT_BOLD, 10)
            use_stacked = lw + 8 > label_offset

        if use_stacked:
            c.setFont(FONT_BOLD, 10)
            c.drawString(x_left, y, label_text)
            y -= line_h
            c.setFont(FONT_NAME, 10)
            for vline in _value_lines(val, wrap_chars):
                if max_value_w is not None and max_value_w > 0:
                    while vline and _text_width(c, vline, FONT_NAME, 10) > max_value_w:
                        vline = vline[:-1]
                c.drawString(x_left + 10, y, vline)
                y -= line_h
            y -= 2
        else:
            val_lines = _value_lines(val, wrap_chars)
            c.setFont(FONT_BOLD, 10)
            c.drawString(x_left, y, label_text)
            c.setFont(FONT_NAME, 10)
            for vi, vline in enumerate(val_lines):
                shown = vline
                if max_value_w is not None and max_value_w > 0:
                    while shown and _text_width(c, shown, FONT_NAME, 10) > max_value_w:
                        shown = shown[:-1]
                elif len(val_lines) == 1:
                    shown = _truncate(shown, value_max_len)
                c.drawString(value_x, y, shown)
                y -= line_h

    return y


def _draw_page1_photos(
    c: canvas.Canvas,
    photos: list[tuple[bytes, str]],
    *,
    x: float,
    y_top: float,
    width: float,
    y_bottom: float = FOOTER_PLAQUE_BOTTOM + FOOTER_PLAQUE_HEIGHT + 12,
    grid_cols: int = 2,
    grid_rows: int = 2,
) -> None:
    """Фото в сетке (по умолчанию 2×2, не более 4 снимков)."""
    if not photos:
        return
    height = y_top - y_bottom
    if height <= 40 or width <= 40:
        return
    gap = 8.0
    cols = max(1, grid_cols)
    rows = max(1, grid_rows)
    cell_w = (width - gap * (cols - 1)) / cols
    cell_h = (height - gap * (rows - 1)) / rows
    max_slots = cols * rows

    for idx, (raw, _content_type) in enumerate(photos[:max_slots]):
        try:
            img = ImageReader(BytesIO(raw))
        except Exception:
            continue
        iw, ih = img.getSize()
        if iw <= 0 or ih <= 0:
            continue
        col = idx % cols
        row = idx // cols
        cell_x = x + col * (cell_w + gap)
        cell_y_top = y_top - row * (cell_h + gap)
        scale = min(cell_w / iw, cell_h / ih)
        dw, dh = iw * scale, ih * scale
        px = cell_x + (cell_w - dw) / 2
        py = cell_y_top - cell_h + (cell_h - dh) / 2
        c.drawImage(img, px, py, width=dw, height=dh, mask="auto")


def _draw_page1(c: canvas.Canvas, d: KpDocumentData, *, hide_branding: bool = False) -> None:
    y = _draw_page1_header(c, d, hide_branding=hide_branding)
    _draw_page1_params(c, d, y)


def _draw_page1_client(
    c: canvas.Canvas,
    d: KpDocumentData,
    photos: list[tuple[bytes, str]],
    *,
    hide_branding: bool = False,
) -> None:
    content_top = _draw_page1_header(c, d, hide_branding=hide_branding)
    photo_x = PAGE1_SPLIT_X + 8
    photo_w = PAGE_W - MARGIN_L - photo_x
    # Правая колонка: фиксированная высота от шапки до подвала (не от низа текста слева).
    _draw_page1_photos(
        c,
        photos,
        x=photo_x,
        y_top=content_top,
        width=photo_w,
        y_bottom=FOOTER_PLAQUE_BOTTOM + FOOTER_PLAQUE_HEIGHT + 16,
    )
    _draw_page1_params(
        c,
        d,
        content_top,
        x_left=MARGIN_L,
        wrap_intro=PAGE1_LEFT_MAX_CHARS,
        col_right=PAGE1_SPLIT_X - 10,
        stacked_labels=False,
        auto_value_column=True,
    )


def _wrap_text_by_width(
    c: canvas.Canvas,
    text: str,
    font: str,
    size: int,
    max_width: float,
) -> list[str]:
    """Перенос по словам с учётом ширины строки в PDF."""
    raw = (text or "—").replace("\n", " ").strip()
    if not raw:
        return ["—"]
    words = raw.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip() if current else word
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
            continue
        if current:
            lines.append(current)
            current = ""
        if c.stringWidth(word, font, size) <= max_width:
            current = word
            continue
        chunk = ""
        for ch in word:
            nxt = chunk + ch
            if c.stringWidth(nxt, font, size) <= max_width:
                chunk = nxt
            else:
                if chunk:
                    lines.append(chunk)
                chunk = ch
        current = chunk
    if current:
        lines.append(current)
    return lines or ["—"]


def _table_name_col_width(hide_unit_price: bool) -> float:
    if hide_unit_price:
        return (MARGIN_L + 310) - (MARGIN_L + 22) - 6
    return TABLE_NAME_COL_WIDTH


def _table_row_line_count(
    c: canvas.Canvas,
    row: tuple[str, str, str, str, str, str, bool],
    *,
    wrap_name: bool,
    hide_unit_price: bool,
) -> int:
    if row[6]:
        if not wrap_name:
            return 1
        return max(
            1,
            len(
                _wrap_text_by_width(
                    c, row[1], FONT_BOLD, 9, PAGE_W - 2 * MARGIN_L - 8
                )
            ),
        )
    if not wrap_name:
        return 1
    name_w = _table_name_col_width(hide_unit_price)
    return max(1, len(_wrap_text_by_width(c, row[1], FONT_NAME, 9, name_w)))


def _chunk_table_rows(
    c: canvas.Canvas,
    rows: list[tuple[str, str, str, str, str, str, bool]],
    *,
    max_units: int = TABLE_ROWS_PER_PAGE,
    wrap_name: bool = False,
    hide_unit_price: bool = False,
) -> list[list[tuple[str, str, str, str, str, str, bool]]]:
    chunks: list[list[tuple[str, str, str, str, str, str, bool]]] = []
    chunk: list[tuple[str, str, str, str, str, str, bool]] = []
    units = 0
    for row in rows:
        need = _table_row_line_count(c, row, wrap_name=wrap_name, hide_unit_price=hide_unit_price)
        if chunk and units + need > max_units:
            chunks.append(chunk)
            chunk = []
            units = 0
        chunk.append(row)
        units += need
    if chunk:
        chunks.append(chunk)
    return chunks if chunks else [[]]


def _draw_table_page(
    c: canvas.Canvas,
    d: KpDocumentData,
    rows: list[tuple[str, str, str, str, str, str, bool]],
    *,
    first_table_page: bool,
    last_table_page: bool,
    hide_unit_price: bool = False,
    wrap_name: bool = False,
    footer_total: str | None = None,
) -> None:
    y_top = PAGE_H - 55
    if first_table_page:
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(colors.HexColor("#1e7e6a"))
        c.drawString(MARGIN_L, y_top, "2. Состав предложения и стоимость")
        y = y_top - 22
    else:
        y = y_top - 10

    if hide_unit_price:
        col_x = [MARGIN_L, MARGIN_L + 22, MARGIN_L + 310, MARGIN_L + 355, MARGIN_L + 490]
        headers = ["№", "Наименование", "Ед.", "Кол-во", "Сумма, ₽"]
    else:
        col_x = [MARGIN_L, MARGIN_L + 22, MARGIN_L + 290, MARGIN_L + 330, MARGIN_L + 400, MARGIN_L + 490]
        headers = ["№", "Наименование", "Ед.", "Кол-во", "Цена, ₽", "Сумма, ₽"]
    c.setFillColor(colors.HexColor("#ef8013"))
    c.rect(MARGIN_L, y - 4, PAGE_W - 2 * MARGIN_L, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(FONT_BOLD, 9)
    for i, h in enumerate(headers):
        c.drawString(col_x[i], y, h)
    y -= 18
    c.setFillColor(colors.black)
    c.setFont(FONT_NAME, 9)
    name_w = _table_name_col_width(hide_unit_price)
    y_min = 70

    for row in rows:
        if row[6]:
            if y < y_min + TABLE_ROW_LINE_H:
                break
            c.setFillColor(colors.HexColor("#F7A14C"))
            c.rect(MARGIN_L, y - 3, PAGE_W - 2 * MARGIN_L, 14, fill=1, stroke=0)
            c.setFillColor(colors.black)
            c.setFont(FONT_BOLD, 9)
            header_lines = (
                _wrap_text_by_width(c, row[1], FONT_BOLD, 9, PAGE_W - 2 * MARGIN_L - 8)
                if wrap_name
                else [row[1]]
            )
            for hl in header_lines:
                c.drawString(col_x[1], y, hl)
                y -= TABLE_ROW_LINE_H
            c.setFont(FONT_NAME, 9)
            continue

        name_lines = (
            _wrap_text_by_width(c, row[1], FONT_NAME, 9, name_w)
            if wrap_name
            else [row[1]]
        )
        row_h = TABLE_ROW_LINE_H * len(name_lines)
        if y - row_h < y_min:
            break

        for li, name_line in enumerate(name_lines):
            ly = y - li * TABLE_ROW_LINE_H
            if li == 0:
                c.drawString(col_x[0], ly, row[0])
                c.drawString(col_x[1], ly, name_line)
                c.drawString(col_x[2], ly, row[2])
                c.drawRightString(col_x[3] + 35, ly, row[3])
                if hide_unit_price:
                    c.drawRightString(col_x[4] + 55, ly, row[5])
                else:
                    c.drawRightString(col_x[4] + 55, ly, row[4])
                    c.drawRightString(col_x[5] + 55, ly, row[5])
            else:
                c.drawString(col_x[1], ly, name_line)
        y -= row_h

    if last_table_page:
        y -= 6
        total_label = footer_total if footer_total is not None else d.total_amount
        c.setFont(FONT_BOLD, 12)
        c.drawRightString(PAGE_W - MARGIN_L, max(y, 85), f"Итого по предложению: {total_label}")
        c.setFont(FONT_NAME, 8)
        c.drawString(MARGIN_L, max(y - 16, 70), "Окончательная стоимость фиксируется в договоре после согласования спецификации.")


LINK_COLOR = colors.HexColor("#1e7e6a")


def _link_rect(c: canvas.Canvas, x: float, y: float, text: str, url: str, *, font: str, size: int) -> None:
    if not text or not url:
        return
    width = c.stringWidth(text, font, size)
    safe_url = pdf_safe_link_url(url)
    c.linkURL(safe_url, (x, y - 2, x + width, y + size + 2), relative=0)


def _draw_text_link(
    c: canvas.Canvas,
    x: float,
    y: float,
    prefix: str,
    label: str,
    url: str,
    *,
    font: str = FONT_NAME,
    size: int = 10,
) -> None:
    c.setFont(font, size)
    c.setFillColor(colors.black)
    if prefix:
        c.drawString(x, y, prefix)
        x += c.stringWidth(prefix, font, size)
    c.setFillColor(LINK_COLOR)
    c.drawString(x, y, label)
    _link_rect(c, x, y, label, url, font=font, size=size)
    c.setFillColor(colors.black)


def _draw_centered_text_link(
    c: canvas.Canvas,
    y: float,
    prefix: str,
    label: str,
    url: str,
    *,
    font: str = FONT_NAME,
    size: int = 8,
) -> None:
    c.setFont(font, size)
    total = c.stringWidth(prefix, font, size) + c.stringWidth(label, font, size)
    x = (PAGE_W - total) / 2
    _draw_text_link(c, x, y, prefix, label, url, font=font, size=size)


def _draw_kp_footer_plaque(c: canvas.Canvas, *, for_client: bool = False) -> None:
    """Подвал внизу листа на полупрозрачной плашке (70%)."""
    left = MARGIN_L
    width = PAGE_W - 2 * MARGIN_L
    bottom = FOOTER_PLAQUE_BOTTOM
    top = bottom + FOOTER_PLAQUE_HEIGHT

    c.saveState()
    c.setFillColor(colors.Color(1, 1, 1, alpha=0.7))
    c.roundRect(left, bottom, width, FOOTER_PLAQUE_HEIGHT, 6, fill=1, stroke=0)
    c.restoreState()

    c.setFont(FONT_NAME, 8)
    c.setFillColor(colors.HexColor("#444444"))
    disclaimer = KP_FOOTER_DISCLAIMER_CLIENT if for_client else KP_FOOTER_DISCLAIMER_INTERNAL
    w = c.stringWidth(disclaimer, FONT_NAME, 8)
    c.drawString((PAGE_W - w) / 2, top - 22, disclaimer)


def _draw_manager_line(c: canvas.Canvas, x: float, y: float, d: KpDocumentData) -> float:
    phone = _manager_phone_display(d)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.black)
    c.drawString(x, y, f"Менеджер: {d.manager_name}")
    y -= 14
    tel_prefix = "тел.: "
    c.drawString(x, y, tel_prefix)
    lx = x + c.stringWidth(tel_prefix, FONT_NAME, 10)
    c.setFillColor(LINK_COLOR)
    c.drawString(lx, y, phone)
    tel = "".join(ch for ch in phone if ch.isdigit())
    if tel.startswith("8") and len(tel) == 11:
        tel = "7" + tel[1:]
    if not tel.startswith("+"):
        tel = f"+{tel}" if tel else KP_DEFAULT_MANAGER_PHONE_TEL
    _link_rect(c, lx, y, phone, f"tel:{tel}", font=FONT_NAME, size=10)
    c.setFillColor(colors.black)
    return y - 14


def _manager_phone_display(_d: KpDocumentData) -> str:
    return KP_DEFAULT_MANAGER_PHONE


def _draw_contacts_divider(c: canvas.Canvas, x: float, y: float, width: float) -> float:
    c.setStrokeColor(colors.HexColor("#bbbbbb"))
    c.setLineWidth(0.5)
    c.line(x, y, x + width, y)
    c.setStrokeColor(colors.black)
    return y - 10


def _draw_wrapped_text_link(
    c: canvas.Canvas,
    x: float,
    y: float,
    text: str,
    url: str,
    max_width: float,
    *,
    font: str = FONT_NAME,
    size: int = 8,
) -> float:
    lines = _wrap_text_by_width(c, text, font, size, max_width)
    line_h = size + 2
    c.setFont(font, size)
    c.setFillColor(LINK_COLOR)
    for line in lines:
        c.drawString(x, y, line)
        _link_rect(c, x, y, line, url, font=font, size=size)
        y -= line_h
    c.setFillColor(colors.black)
    return y


def _draw_contacts_extra_links(c: canvas.Canvas, x: float, y: float) -> float:
    width = PAGE_W - 2 * MARGIN_L
    max_link_w = width - 8
    size = 8
    line_h = size + 3

    def draw_link_group(items: list[tuple[str | None, str, str]]) -> None:
        nonlocal y
        for prefix, label, url in items:
            prefix = prefix or ""
            c.setFont(FONT_NAME, size)
            prefix_w = c.stringWidth(prefix, FONT_NAME, size) if prefix else 0.0
            label_w = c.stringWidth(label, FONT_NAME, size)
            if prefix_w + label_w <= max_link_w:
                _draw_text_link(c, x, y, prefix, label, url, font=FONT_NAME, size=size)
                y -= line_h
            else:
                if prefix:
                    c.setFillColor(colors.black)
                    c.drawString(x, y, prefix)
                    y -= line_h
                y = _draw_wrapped_text_link(c, x, y, label, url, max_link_w, font=FONT_NAME, size=size)
                y -= 2

    y -= 4
    draw_link_group(KP_CONTACTS_EXTRA_LINKS)
    y = _draw_contacts_divider(c, x, y, width)
    draw_link_group(KP_CONTACTS_EXTRA_CATALOG_LINKS)
    y = _draw_contacts_divider(c, x, y, width)
    draw_link_group([KP_CONTACTS_EXTRA_MATERIALS_LINK])
    y = _draw_contacts_divider(c, x, y, width)

    c.setFont(FONT_NAME, size)
    c.setFillColor(colors.black)
    c.drawString(x, y, "Адреса офисов:")
    y -= line_h + 1
    c.setFont(FONT_NAME, size)
    for prefix, label, url in KP_CONTACTS_OFFICE_ADDRESSES:
        prefix_w = c.stringWidth(prefix, FONT_NAME, size)
        if prefix_w + c.stringWidth(label, FONT_NAME, size) <= max_link_w:
            _draw_text_link(c, x, y, prefix, label, url, font=FONT_NAME, size=size)
            y -= line_h
        else:
            c.setFillColor(colors.black)
            c.drawString(x, y, prefix)
            y -= line_h
            y = _draw_wrapped_text_link(c, x, y, label, url, max_link_w, font=FONT_NAME, size=size)
            y -= 2

    return y - 4


def _draw_page_terms(
    c: canvas.Canvas,
    d: KpDocumentData,
    *,
    hide_branding: bool = False,
    for_client: bool = False,
) -> None:
    y = PAGE_H - 55
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(colors.HexColor("#1e7e6a"))
    c.drawString(MARGIN_L, y, "3. Условия")
    y -= 22
    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.black)
    terms_lines = [
        "• Проектная документация и раскройные карты (при заказе домокомплекта).",
        "• Комплект несущих материалов согласно спецификации.",
        "• Крепёж, плёнки, ленты, узловые элементы по ведомости.",
        f"• Аванс — {d.prepayment or '—'}.",
        f"• Остаток — {d.balance or '—'}.",
    ]
    for line in terms_lines:
        c.drawString(MARGIN_L, y, line)
        y -= 14

    y -= 8
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(colors.HexColor("#1e7e6a"))
    c.drawString(MARGIN_L, y, "4. Контакты")
    y -= 20
    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.black)
    y = _draw_manager_line(c, MARGIN_L, y, d)
    if not hide_branding:
        y = _draw_contacts_extra_links(c, MARGIN_L, y)
        c.drawString(MARGIN_L, y, f"С уважением, {KP_SIGNOFF_ORGANIZATION}")
        y -= 14

    _draw_kp_footer_plaque(c, for_client=for_client)


def _wrap_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for w in words:
        chunk = f"{current} {w}".strip()
        if len(chunk) <= max_chars:
            current = chunk
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines or [""]


def _overlays_to_pdf_bytes(overlays: list[bytes], template: bytes) -> bytes:
    writer = PdfWriter()
    for overlay in overlays:
        merged = _merge_template_overlay(template, overlay)
        writer.add_page(PdfReader(BytesIO(merged)).pages[0])
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _collect_kp_overlay_overlays(
    db: Session,
    specification_id: int,
    *,
    for_client: bool = False,
    hide_branding: bool = False,
) -> list[bytes]:
    data = collect_kp_document_data(db, specification_id)
    hide_price = for_client
    all_rows = _iter_table_rows(data, hide_unit_price=hide_price)
    photos = _load_specification_photos(db, specification_id) if for_client else []

    overlays: list[bytes] = []
    if for_client:
        overlays.append(
            _canvas_overlay(
                lambda c, _photos=photos, _hb=hide_branding: _draw_page1_client(
                    c, data, _photos, hide_branding=_hb
                )
            )
        )
    else:
        overlays.append(
            _canvas_overlay(lambda c, _hb=hide_branding: _draw_page1(c, data, hide_branding=_hb))
        )

    probe = canvas.Canvas(BytesIO(), pagesize=PAGE_SIZE)
    row_chunks = _chunk_table_rows(
        probe,
        all_rows,
        wrap_name=True,
        hide_unit_price=hide_price,
    )

    for i, chunk in enumerate(row_chunks):
        is_first = i == 0
        is_last = i == len(row_chunks) - 1

        def _draw(
            c,
            _rows=chunk,
            _f=is_first,
            _l=is_last,
            _hp=hide_price,
            _d=data,
        ):
            _draw_table_page(
                c,
                _d,
                _rows,
                first_table_page=_f,
                last_table_page=_l,
                hide_unit_price=_hp,
                wrap_name=True,
            )

        overlays.append(_canvas_overlay(_draw))

    overlays.append(
        _canvas_overlay(
            lambda c, _d=data, _hb=hide_branding, _fc=for_client: _draw_page_terms(
                c, _d, hide_branding=_hb, for_client=_fc
            )
        )
    )
    return overlays


def _build_kp_overlay_pdf_pages(
    db: Session,
    specification_id: int,
    *,
    for_client: bool = False,
    hide_branding: bool = False,
) -> bytes:
    """PDF КП: PNG-подложка + текст поверх (pypdf merge_page)."""
    template = _landscape_template_bytes()
    overlays = _collect_kp_overlay_overlays(
        db, specification_id, for_client=for_client, hide_branding=hide_branding
    )
    return _overlays_to_pdf_bytes(overlays, template)


def build_kp_overlay_pdf(db: Session, specification_id: int) -> bytes:
    return _build_kp_overlay_pdf_pages(db, specification_id, for_client=False)


def build_kp_overlay_client_pdf(db: Session, specification_id: int, *, hide_branding: bool = False) -> bytes:
    """КП для клиента: подложка, текст слева / фото справа, таблица без цены за единицу."""
    return _build_kp_overlay_pdf_pages(
        db, specification_id, for_client=True, hide_branding=hide_branding
    )


def _kp_approved(spec) -> bool:
    v = getattr(spec, "kp_approved", None)
    if v is True:
        return True
    if isinstance(v, int) and v == 1:
        return True
    return False


def _agreed_specs_for_project(db: Session, project_id: int) -> list:
    from app.services import specification as spec_service

    specs = spec_service.list_by_project(db, project_id)
    return [s for s in specs if _kp_approved(s)]


def build_kp_overlay_client2_pdf(
    db: Session,
    specification_id: int,
    *,
    hide_branding: bool = False,
) -> tuple[bytes, str]:
    """
    КП для клиента: 1 согласованная спецификация — КП по ней;
    2 и более — КП сводное по проекту.
    Возвращает (pdf_bytes, имя файла без расширения).
    """
    from app.services import specification as spec_service

    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise ValueError("Спецификация не найдена")
    project_id = getattr(spec, "project_id", None)
    if not project_id:
        raise ValueError("У спецификации не указан проект")

    agreed = _agreed_specs_for_project(db, project_id)
    if not agreed:
        raise ValueError(
            "Нет согласованных спецификаций. Согласуйте КП по спецификациям проекта."
        )

    ctx_number = getattr(spec, "number", None) or str(specification_id)
    suffix = "_v2" if hide_branding else ""
    if len(agreed) >= 2:
        return (
            build_kp_overlay_consolidated_pdf(db, specification_id, hide_branding=hide_branding),
            f"kp_consolidated{suffix}_{ctx_number}",
        )

    target = agreed[0]
    target_number = getattr(target, "number", None) or str(target.id)
    return (
        build_kp_overlay_client_pdf(db, target.id, hide_branding=hide_branding),
        f"kp_client{suffix}_{target_number}",
    )


def build_kp_overlay_client_v2_pdf(db: Session, specification_id: int) -> tuple[bytes, str]:
    """КП для клиента 2: как «КП для клиента», без логотипа и упоминаний «Дома кубани»."""
    return build_kp_overlay_client2_pdf(db, specification_id, hide_branding=True)


def _plural_houses(n: int) -> str:
    n = abs(int(n))
    if 11 <= n % 100 <= 14:
        return "домов"
    r = n % 10
    if r == 1:
        return "дом"
    if 2 <= r <= 4:
        return "дома"
    return "домов"


def _iter_consolidated_table_rows(
    groups: list[dict],
) -> list[tuple[str, str, str, str, str, str, bool]]:
    """Строки сводного КП в формате таблицы «2. Состав предложения и стоимость»."""
    rows: list[tuple[str, str, str, str, str, str, bool]] = []
    n = 0
    multi_group = len(groups) > 1

    for group in groups:
        spec_nums = ", ".join(str(s) for s in (group.get("spec_numbers") or []))
        house_count = int(group.get("house_count") or 0)
        if multi_group:
            header = (
                f"Спецификации: {spec_nums} — {house_count} "
                f"{_plural_houses(house_count)} (одинаковый состав)"
            )
            rows.append(("", header, "", "", "", "", True))

        for r in group.get("rows") or []:
            n += 1
            rows.append(
                (
                    str(n),
                    str(r.get("item_name") or "—"),
                    str(r.get("unit") or "шт"),
                    f"{_num(r.get('total_quantity')):g}",
                    _fmt_money(r.get("price")),
                    _fmt_money(r.get("total_sum")),
                    False,
                )
            )

    if not rows:
        rows.append(("", "Позиции не добавлены", "", "", "", "", False))
    return rows


def _draw_consolidated_cover(
    c: canvas.Canvas,
    d: KpDocumentData,
    *,
    agreed_spec_labels: list[str],
    grand_total: float,
    hide_branding: bool = False,
) -> None:
    y = _draw_page1_header(c, d, hide_branding=hide_branding)
    c.setFont(FONT_BOLD, 14)
    c.setFillColor(colors.HexColor("#1e7e6a"))
    c.drawString(MARGIN_L, y, "Сводное коммерческое предложение")
    y -= 22
    c.setFont(FONT_NAME, 10)
    c.setFillColor(colors.black)
    intro = (
        f"По проекту «{d.project_title}» ({d.project_number}). "
        "Ниже — состав и стоимость по согласованным спецификациям "
        "(каждая уникальная комплектация — в одном экземпляре, количество домов учтено в колонке «Кол-во»)."
    )
    for line in _wrap_text(intro, 105):
        c.drawString(MARGIN_L, y, line)
        y -= 14
    if agreed_spec_labels:
        y -= 4
        specs_line = "Согласованные спецификации: " + ", ".join(agreed_spec_labels)
        for line in _wrap_text(specs_line, 105):
            c.drawString(MARGIN_L, y, line)
            y -= 14
    y -= 8
    c.setFont(FONT_BOLD, 11)
    c.drawString(MARGIN_L, y, f"Общая сумма сводного КП: {_fmt_money(grand_total)} ₽")
    _draw_kp_footer_plaque(c, for_client=True)


def _build_consolidated_overlay_pages(
    db: Session,
    project_id: int,
    d: KpDocumentData,
    *,
    hide_branding: bool = False,
) -> list[bytes]:
    from dataclasses import replace

    from app.services.consolidated_kp import get_consolidated_kp

    groups = get_consolidated_kp(db, project_id)
    if not groups:
        return []

    grand_total = sum(float(g.get("group_total") or 0) for g in groups)
    agreed_labels: list[str] = []
    for g in groups:
        agreed_labels.extend(str(s) for s in (g.get("spec_numbers") or []))

    all_rows = _iter_consolidated_table_rows(groups)
    prepayment, balance, _, _ = _payment_for_spec(grand_total, d.contract_data)
    d_table = replace(
        d,
        total_amount=f"{_fmt_money(grand_total)} ₽",
        prepayment=prepayment,
        balance=balance,
    )

    overlays: list[bytes] = []
    overlays.append(
        _canvas_overlay(
            lambda c, _labels=agreed_labels, _gt=grand_total, _hb=hide_branding: _draw_consolidated_cover(
                c, d, agreed_spec_labels=_labels, grand_total=_gt, hide_branding=_hb
            )
        )
    )

    probe = canvas.Canvas(BytesIO(), pagesize=PAGE_SIZE)
    row_chunks = _chunk_table_rows(
        probe,
        all_rows,
        wrap_name=True,
        hide_unit_price=False,
    )

    for ci, part in enumerate(row_chunks):
        is_first = ci == 0
        is_last = ci == len(row_chunks) - 1

        def _draw(
            c,
            _rows=part,
            _f=is_first,
            _l=is_last,
            _d=d_table,
        ):
            _draw_table_page(
                c,
                _d,
                _rows,
                first_table_page=_f,
                last_table_page=_l,
                hide_unit_price=False,
                wrap_name=True,
            )

        overlays.append(_canvas_overlay(_draw))

    overlays.append(
        _canvas_overlay(
            lambda c, _d=d_table, _hb=hide_branding: _draw_page_terms(
                c, _d, hide_branding=_hb, for_client=True
            )
        )
    )
    return overlays


def build_kp_overlay_consolidated_pdf(
    db: Session,
    specification_id: int,
    *,
    hide_branding: bool = False,
) -> bytes:
    """
    КП сводное: только согласованные спецификации проекта (сводное КП),
    таблица «2. Состав предложения и стоимость», с переносом наименований.
    """
    from app.services import specification as spec_service

    spec = spec_service.get_by_id(db, specification_id)
    if not spec:
        raise ValueError("Спецификация не найдена")
    project_id = getattr(spec, "project_id", None)
    if not project_id:
        raise ValueError("У спецификации не указан проект")

    template = _landscape_template_bytes()
    data = collect_kp_document_data(db, specification_id)
    overlays = _build_consolidated_overlay_pages(db, project_id, data, hide_branding=hide_branding)
    if not overlays:
        raise ValueError(
            "Нет согласованных спецификаций для сводного КП. Согласуйте КП по спецификациям проекта."
        )
    return _overlays_to_pdf_bytes(overlays, template)
