# -*- coding: utf-8 -*-
"""Генерация PDF договора поставки: первая страница — договор, вторая — КП (другой вид)."""
from io import BytesIO
from decimal import Decimal
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak

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


def build_contract_pdf(
    specification_id: int,
    customer_full_name: str,
    customer_address: str,
    customer_phone: str,
    supplier_name: str,
    supplier_phone: str,
    items: list,
    total_amount,
    specification_number: str | None = None,
) -> bytes:
    """Строит PDF: стр.1 — договор поставки, стр.2 — КП (другой вид, плоская таблица).
    items — список dict с полями item_name, quantity, unit, price, total.
    specification_number — человекочитаемый номер (A00001-P01-S01) для отображения.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=22 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="ContractTitle",
        parent=styles["Heading1"],
        fontName=FONT_NAME,
        fontSize=14,
    )
    normal_style = ParagraphStyle(
        name="NormalCyrillic",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=10,
    )
    heading2_style = ParagraphStyle(
        name="H2Cyrillic",
        parent=styles["Heading2"],
        fontName=FONT_NAME,
        fontSize=11,
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

    # ——— Страница 1: Договор поставки ———
    story.append(Paragraph(xml_escape("ДОГОВОР ПОСТАВКИ"), title_style))
    story.append(Spacer(1, 4 * mm))

    intro = (
        "Настоящий договор (далее — «Договор») заключён между организацией, именуемой в дальнейшем «Поставщик», "
        "и гражданином "
        + xml_escape(customer_full_name or "____________________________")
        + ", именуемым в дальнейшем «Покупатель», совместно именуемыми «Стороны»."
    )
    story.append(Paragraph(intro, normal_style))
    story.append(Paragraph(
        "Покупатель: адрес — " + xml_escape(customer_address or "____________________________") + "; "
        "телефон — " + xml_escape(customer_phone or "____________________________") + ".",
        normal_style,
    ))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(xml_escape("1. Предмет договора"), heading2_style))
    story.append(Paragraph(
        "1.1. Поставщик обязуется передать в собственность Покупателя товары (материалы, изделия), "
        "а Покупатель обязуется принять и оплатить их в соответствии с условиями настоящего Договора и приложением — коммерческим предложением (КП).",
        normal_style,
    ))
    story.append(Paragraph(
        "1.2. Перечень, количество, ассортимент и стоимость поставляемых товаров определяются приложением к Договору (КП — другой вид), являющимся неотъемлемой частью Договора.",
        normal_style,
    ))

    story.append(Paragraph(xml_escape("2. Права и обязанности сторон"), heading2_style))
    story.append(Paragraph(
        "2.1. Поставщик обязуется передать товар надлежащего качества, в согласованные сроки.",
        normal_style,
    ))
    story.append(Paragraph(
        "2.2. Покупатель обязуется принять товар и оплатить его в порядке и сроки, установленные Договором.",
        normal_style,
    ))

    story.append(Paragraph(xml_escape("3. Стоимость и порядок расчётов"), heading2_style))
    story.append(Paragraph(
        "3.1. Стоимость поставки определяется приложением (КП) к настоящему Договору.",
        normal_style,
    ))
    story.append(Paragraph(
        "3.2. Оплата производится по реквизитам Поставщика путём безналичного перечисления в срок, согласованный Сторонами.",
        normal_style,
    ))

    story.append(Paragraph(xml_escape("4. Ответственность и разрешение споров"), heading2_style))
    story.append(Paragraph(
        "4.1. Стороны несут ответственность в соответствии с законодательством РФ.",
        normal_style,
    ))
    story.append(Paragraph(
        "4.2. Споры разрешаются путём переговоров, при недостижении согласия — в суде по месту нахождения Поставщика.",
        normal_style,
    ))

    story.append(Paragraph(xml_escape("5. Заключительные положения"), heading2_style))
    story.append(Paragraph(
        "5.1. Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из Сторон.",
        normal_style,
    ))
    story.append(Paragraph(
        "Поставщик: " + xml_escape(supplier_name or "____________________________") + ", тел.: " + xml_escape(supplier_phone or "____________________________"),
        normal_style,
    ))

    story.append(PageBreak())

    # ——— Страница 2: КП (другой вид) ———
    story.append(Paragraph(xml_escape("Коммерческое предложение (другой вид)"), title_style))
    spec_label = specification_number if specification_number else str(specification_id)
    story.append(Paragraph(xml_escape(f"Приложение к договору поставки. Спецификация № {spec_label}"), normal_style))
    story.append(Spacer(1, 4 * mm))

    col_widths = [12 * mm, 75 * mm, 18 * mm, 15 * mm, 25 * mm, 28 * mm]
    table_style = TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E6E9ED")),
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

    data = [[
        Paragraph(xml_escape("№"), cell_style),
        Paragraph(xml_escape("Наименование"), cell_style),
        Paragraph(xml_escape("Кол-во"), cell_style),
        Paragraph(xml_escape("Ед."), cell_style),
        Paragraph(xml_escape("Цена"), cell_style),
        Paragraph(xml_escape("Сумма"), cell_style),
    ]]
    for i, it in enumerate(items, 1):
        name = (it.get("item_name") or "—")
        name_safe = xml_escape(name.replace("\n", "<br/>")).replace("&lt;br/&gt;", "<br/>")
        qty = _num(it.get("quantity"))
        unit = (it.get("unit") or "шт").replace("\n", " ")
        price = _num(it.get("price"))
        total = _num(it.get("total"))
        if total == 0 and qty and price:
            total = qty * price
        data.append([
            Paragraph(xml_escape(str(i)), cell_style),
            Paragraph(name_safe, cell_style),
            Paragraph(xml_escape(f"{qty:.2f}".rstrip("0").rstrip(".")), cell_style),
            Paragraph(xml_escape(unit), cell_style),
            Paragraph(xml_escape(f"{price:,.2f}".replace(",", " ")), cell_style),
            Paragraph(xml_escape(f"{total:,.2f}".replace(",", " ")), cell_style),
        ])

    total_sum = _num(total_amount) if total_amount is not None else sum(
        _num(it.get("total")) or _num(it.get("quantity")) * _num(it.get("price")) for it in items
    )
    data.append([
        "", "", "", "",
        Paragraph(xml_escape("Итого:"), cell_style),
        Paragraph(xml_escape(f"{total_sum:,.2f}".replace(",", " ") + " ₽"), cell_style),
    ])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(table_style)
    story.append(t)

    doc.build(story)
    return buf.getvalue()
