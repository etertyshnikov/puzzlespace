# -*- coding: utf-8 -*-
"""Генерация PDF КП (коммерческое предложение) из позиций спецификации."""
from io import BytesIO
from decimal import Decimal
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

# Регистрация шрифта для кириллицы (если доступен)
try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        os.path.join(os.path.dirname(__file__), "..", "..", "fonts", "DejaVuSans.ttf"),
    ]:
        if os.path.isfile(path):
            pdfmetrics.registerFont(TTFont("Cyrillic", path))
            FONT_NAME = "Cyrillic"
            break
    else:
        FONT_NAME = "Helvetica"
except Exception:
    FONT_NAME = "Helvetica"


def _num(v):
    if v is None:
        return 0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def build_kp_pdf(specification_id: int, total_amount, items: list, parts: list, specification_number: str | None = None) -> bytes:
    """Строит PDF КП по позициям спецификации с группировкой по частям дома.
    items — список dict с полями item_name, quantity, unit, price, total, part_id.
    parts — список dict с полями id, name (части дома в порядке вывода).
    specification_number — человекочитаемый номер (A00001-P01-S01) для отображения в КП.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="Title",
        parent=styles["Heading1"],
        fontName=FONT_NAME,
        fontSize=16,
    )
    normal_style = ParagraphStyle(
        name="NormalCyrillic",
        parent=styles["Normal"],
        fontName=FONT_NAME,
    )
    part_header_style = ParagraphStyle(
        name="PartHeader",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=11,
        leftIndent=0,
        spaceBefore=6 * mm,
        spaceAfter=2 * mm,
        backColor=colors.HexColor("#E6E9ED"),
        borderPadding=4,
    )
    cell_style = ParagraphStyle(
        name="TableCell",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=9,
        leading=11,
        wordWrap="CJK",
    )

    story = []
    story.append(Paragraph("Коммерческое предложение", title_style))
    spec_label = specification_number if specification_number else f"Спецификация № {specification_id}"
    story.append(Paragraph(f"Спецификация № {spec_label}", normal_style))
    story.append(Spacer(1, 6 * mm))

    # Группировка по part_id
    by_part = {}
    for it in items:
        key = it.get("part_id") if it.get("part_id") is not None else "none"
        if key not in by_part:
            by_part[key] = []
        by_part[key].append(it)

    # Порядок: сначала "Без части", затем части в порядке parts
    part_order = ["none"]
    parts_by_id = {p["id"]: p["name"] for p in parts}
    for p in parts:
        if p["id"] in by_part:
            part_order.append(p["id"])
    for key in by_part:
        if key != "none" and key not in part_order:
            part_order.append(key)

    col_widths = [12 * mm, 75 * mm, 18 * mm, 15 * mm, 25 * mm, 28 * mm]
    table_style = TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E6E9ED")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9F9F9")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    for part_key in part_order:
        part_items = by_part.get(part_key, [])
        if not part_items:
            continue
        part_name = "Без части" if part_key == "none" else (parts_by_id.get(part_key) or f"Часть #{part_key}")
        story.append(Paragraph(xml_escape(part_name), part_header_style))

        data = [
            [Paragraph(xml_escape("№"), cell_style), Paragraph(xml_escape("Наименование"), cell_style), Paragraph(xml_escape("Кол-во"), cell_style), Paragraph(xml_escape("Ед."), cell_style), Paragraph(xml_escape("Цена"), cell_style), Paragraph(xml_escape("Сумма"), cell_style)],
        ]
        for i, it in enumerate(part_items, 1):
            name = (it.get("item_name") or "—")
            name_safe = xml_escape(name.replace("\n", "<br/>")).replace("&lt;br/&gt;", "<br/>")
            qty = _num(it.get("quantity"))
            unit = (it.get("unit") or "шт").replace("\n", " ")
            price = _num(it.get("price"))
            total = _num(it.get("total"))
            if total == 0 and qty and price:
                total = qty * price
            name_para = Paragraph(name_safe, cell_style)
            data.append([
                Paragraph(xml_escape(str(i)), cell_style),
                name_para,
                Paragraph(xml_escape(f"{qty:.2f}".rstrip("0").rstrip(".")), cell_style),
                Paragraph(xml_escape(unit), cell_style),
                Paragraph(xml_escape(f"{price:,.2f}".replace(",", " ")), cell_style),
                Paragraph(xml_escape(f"{total:,.2f}".replace(",", " ")), cell_style),
            ])
        t = Table(data, colWidths=col_widths, repeatRows=1)
        t.setStyle(table_style)
        story.append(t)

    total_sum = _num(total_amount) if total_amount is not None else sum(
        _num(it.get("total")) or _num(it.get("quantity")) * _num(it.get("price")) for it in items
    )
    story.append(Spacer(1, 4 * mm))
    total_data = [[
        "", "", "", "",
        Paragraph(xml_escape("Итого:"), cell_style),
        Paragraph(xml_escape(f"{total_sum:,.2f}".replace(",", " ") + " ₽"), cell_style),
    ]]
    total_table = Table(total_data, colWidths=col_widths)
    total_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E6E9ED")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(total_table)
    doc.build(story)
    return buf.getvalue()
