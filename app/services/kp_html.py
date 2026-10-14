# -*- coding: utf-8 -*-
"""Генерация HTML КП (вариант с фотографиями и двухколоночным макетом)."""
import base64
from decimal import Decimal
from xml.sax.saxutils import escape as xml_escape


def _num(v) -> float:
    if v is None:
        return 0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _fmt(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ")


def build_kp_html(
    specification_number: str | None,
    total_amount,
    items: list[dict],
    parts: list[dict],
    photos: list[dict] | None = None,
    hide_prices: bool = False,
) -> str:
    """Собирает полный HTML-документ КП в стиле kp04.

    photos — список dict с ключами image_data (bytes), content_type (str), filename (str).
    hide_prices — если True, столбцы «Цена» и «Сумма» скрываются (но «Итого» остаётся).
    """
    spec_label = specification_number or "—"

    by_part: dict = {}
    for it in items:
        key = it.get("part_id") if it.get("part_id") is not None else "none"
        by_part.setdefault(key, []).append(it)

    parts_by_id = {p["id"]: p["name"] for p in parts}
    part_order: list = []
    for p in parts:
        if p["id"] in by_part:
            part_order.append(p["id"])
    if "none" in by_part:
        part_order.append("none")
    for key in by_part:
        if key not in part_order:
            part_order.append(key)

    # --- фотографии как base64 data URI ---
    photo_tags = ""
    if photos:
        for ph in photos:
            data = ph.get("image_data")
            ct = ph.get("content_type", "image/jpeg")
            if not data:
                continue
            b64 = base64.b64encode(data).decode("ascii")
            photo_tags += f'<img src="data:{ct};base64,{b64}" alt="{xml_escape(ph.get("filename", "фото"))}">\n'

    # --- таблицы по частям ---
    col_count = 4 if hide_prices else 6
    tables_html = ""
    row_idx = 1
    for part_key in part_order:
        part_items = by_part.get(part_key, [])
        if not part_items:
            continue
        part_name = (
            "Без части"
            if part_key == "none"
            else (parts_by_id.get(part_key) or f"Часть #{part_key}")
        )
        tables_html += f'<tr class="part-header"><td colspan="{col_count}">{xml_escape(part_name)}</td></tr>\n'

        for it in part_items:
            name = xml_escape(it.get("item_name") or "—")
            qty = _num(it.get("quantity"))
            unit = xml_escape((it.get("unit") or "шт").replace("\n", " "))
            price = _num(it.get("price"))
            total = _num(it.get("total"))
            if total == 0 and qty and price:
                total = qty * price
            qty_s = f"{qty:.2f}".rstrip("0").rstrip(".")
            if hide_prices:
                tables_html += (
                    f"<tr>"
                    f"<td class='num'>{row_idx}</td>"
                    f"<td class='name'>{name}</td>"
                    f"<td class='qty'>{qty_s}</td>"
                    f"<td class='unit'>{unit}</td>"
                    f"</tr>\n"
                )
            else:
                tables_html += (
                    f"<tr>"
                    f"<td class='num'>{row_idx}</td>"
                    f"<td class='name'>{name}</td>"
                    f"<td class='qty'>{qty_s}</td>"
                    f"<td class='unit'>{unit}</td>"
                    f"<td class='price'>{_fmt(price)}</td>"
                    f"<td class='sum'>{_fmt(total)}</td>"
                    f"</tr>\n"
                )
            row_idx += 1

    total_sum = (
        _num(total_amount)
        if total_amount is not None
        else sum(
            _num(it.get("total")) or _num(it.get("quantity")) * _num(it.get("price"))
            for it in items
        )
    )

    has_photos = bool(photo_tags.strip())
    left_width = "33%" if has_photos else "0"
    right_width = "67%" if has_photos else "100%"

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Коммерческое предложение {xml_escape(spec_label)}</title>
<style>
* {{ box-sizing: border-box; }}
body {{
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
    margin: 0;
    padding: 20px 24px;
    color: #000;
    font-size: 13px;
    line-height: 1.4;
}}
h1 {{
    font-size: 20px;
    margin: 0 0 16px 0;
    text-align: center;
}}
.layout {{
    display: flex;
    gap: 20px;
}}
.left {{
    width: {left_width};
    flex-shrink: 0;
}}
.right {{
    width: {right_width};
    flex: 1;
    min-width: 0;
}}
.left img {{
    width: 100%;
    margin-bottom: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    display: block;
}}
table {{
    width: 100%;
    border-collapse: collapse;
}}
th, td {{
    border: 1px solid #ccc;
    padding: 5px 8px;
    font-size: 12px;
    vertical-align: top;
}}
th {{
    background: #f0f0f0;
    font-weight: 600;
    text-align: center;
}}
td.num {{ text-align: center; width: 30px; }}
td.name {{ }}
td.qty {{ text-align: right; width: 50px; }}
td.unit {{ text-align: center; width: 40px; }}
td.price {{ text-align: right; width: 75px; white-space: nowrap; }}
td.sum {{ text-align: right; width: 85px; white-space: nowrap; }}
.part-header td {{
    background: #e6e9ed;
    font-weight: 600;
    font-size: 13px;
    padding: 6px 8px;
}}
.total-row th {{
    text-align: right;
    font-size: 13px;
}}
@media print {{
    body {{ margin: 0; padding: 10px 14px; }}
    .layout {{ display: flex; flex-direction: row; }}
    .left {{ width: {left_width}; }}
    .right {{ width: {right_width}; }}
}}
</style>
</head>
<body>
<h1>Коммерческое предложение &numero; {xml_escape(spec_label)}</h1>
<div class="layout">
"""
    if has_photos:
        html += f'<div class="left">\n{photo_tags}</div>\n'

    if hide_prices:
        thead_cols = """    <th>№</th>
    <th>Наименование</th>
    <th>Кол-во</th>
    <th>Ед.</th>"""
        tfoot_html = f"""<tr class="total-row">
    <th colspan="2" style="text-align:right;">Итого:</th>
    <th colspan="2" style="text-align:right;">{_fmt(total_sum)} ₽</th>
</tr>"""
    else:
        thead_cols = """    <th>№</th>
    <th>Наименование</th>
    <th>Кол-во</th>
    <th>Ед.</th>
    <th>Цена, ₽</th>
    <th>Сумма, ₽</th>"""
        tfoot_html = f"""<tr class="total-row">
    <th colspan="5" style="text-align:right;">Итого:</th>
    <th style="text-align:right;">{_fmt(total_sum)} ₽</th>
</tr>"""

    html += f"""<div class="right">
<table>
<thead>
<tr>
{thead_cols}
</tr>
</thead>
<tbody>
{tables_html}
</tbody>
<tfoot>
{tfoot_html}
</tfoot>
</table>
</div>
</div>
</body>
</html>"""
    return html
