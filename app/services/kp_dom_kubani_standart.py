# -*- coding: utf-8 -*-
"""Шаблон КП «Дома кубани Стандарт» — предварительный расчёт дома 6×4,5 м."""
from __future__ import annotations

from xml.sax.saxutils import escape as xml_escape

from app.services.kp_landscape_assets import (
    KP_CLIENT_TABLE_MARKER,
    KP_CONTACTS_RESOURCES_SECTION,
    KP_LAYOUT_MARKER,
)

KP_DOM_KUBANI_STANDART_CLIENT_TITLE = "КП Дома кубани Стандарт — для клиента"

KP_DOM_KUBANI_STANDART_TITLE = "КП Дома кубани Стандарт"
KP_STANDART_DEFAULT_TOTAL = 1_054_400

# (№ в колонке, наименование, ед., кол-во, цена, сумма, css-класс строки)
_STANDART_LINE_ITEMS: list[tuple[str, str, str, float, float, float, str]] = [
    ("1", "Фундамент, бетонные блоки 200х200х400 (кол-во по проекту)", "шт", 20, 800, 16_000, "kp-row-warm"),
    ("3", "Гидроизоляция фундамента Рубероид", "шт", 1, 1_000, 1_000, "kp-row-warm"),
    (
        "4",
        "Стеновой комплект из минибруса сечением 45х145 мм по м² стен. "
        "Высота стен не менее 2,2 м. Высота в коньке не менее 3,2 м",
        "м2",
        73,
        3_500,
        254_800,
        "kp-row-warm",
    ),
    (
        "5",
        "Перекрытие пола, каркас пола брус 50х150 мм, лаги пола 50х150 мм через 600 мм",
        "м2",
        27,
        1_100,
        29_700,
        "",
    ),
    ("6", "Опорный брус из строенных досок сечением 50х150 мм антисептированный", "шт.", 4, 4_500, 18_000, ""),
    ("7", "Пол-доска h=28 мм", "м2", 27, 1_800, 48_600, ""),
    ("9", "Обрешетка 25х100 мм", "м2", 27, 1_000, 27_000, ""),
    ("", "Контррешётка", "м2", 27, 1_000, 27_000, ""),
    ("", "Стропильная конструкция — брус 50х100 мм", "м2", 27, 1_100, 29_700, ""),
    ("", "Потолок (вагонка штиль 13х110 мм)", "м2", 27, 1_000, 27_000, ""),
    ("", "Ветровая планка (строганная доска h=13 мм)", "м.пог", 22, 250, 5_500, ""),
    ("", "Карнизы (вагонка штиль 13х110 мм). Вылет карнизов 300 мм", "м.пог", 12, 400, 4_800, ""),
    ("", "Металлочерепица", "м2", 35, 1_800, 63_180, ""),
    ("", "Наличники окон и дверей (толщиной 13 х110 мм)", "м.пог", 25, 270, 6_750, ""),
    ("", "Плинтус 40 мм (пол, потолок)", "м.пог", 33, 250, 8_250, ""),
    (
        "",
        "Оконная группа фасадная, панорамная, остекленная с входной дверью, белая, "
        "размер профиля 58 мм. Окна без перемычек, дверь с перемычкой, открывание двери правое, "
        "порог алюминиевый",
        "шт",
        2,
        60_000,
        120_000,
        "kp-row-cool",
    ),
    ("", "Дверь межкомнатная филёнчатая", "шт", 2, 12_000, 24_000, "kp-row-cool"),
    (
        "",
        "Окно ПВХ стандарт, с однокамерным стеклопакетом, профиль белый, толщина профиля 58 мм, "
        "размер 1200*1000 мм, поворотно-откидное",
        "шт",
        3,
        22_000,
        66_000,
        "kp-row-cool",
    ),
    (
        "",
        "Утепление потолка каменной ватой 100 мм с устройством изолирующих плёнок",
        "м2",
        35,
        1_200,
        42_120,
        "kp-row-warm",
    ),
    (
        "",
        "Утепление пола минеральной ватой 100 мм с устройством изолирующих плёнок",
        "м2",
        27,
        1_200,
        32_400,
        "kp-row-warm",
    ),
    ("", "Сетка от грызунов", "м2", 27, 100, 2_700, ""),
    ("", "Покраска дома", "м2", 73, 500, 36_400, ""),
    ("", "Лестница", "шт", 1, 10_000, 10_000, ""),
    ("", "Крепеж", "к-т", 1, 15_000, 15_000, ""),
    ("", "Сборка домокомплекта на участке", "м2", 27, 5_500, 148_500, ""),
]


def _fmt_money(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ")


def build_standart_default_items_table_html(*, hide_unit_price: bool = False) -> str:
    """Таблица позиций пакета «Стандарт» 6×4,5 м (если в спецификации CRM нет строк)."""
    colspan = "5" if hide_unit_price else "6"
    rows = [
        f'<tr class="kp-part-title"><td colspan="{colspan}">Материал</td></tr>',
    ]
    for num, name, unit, qty, price, total, row_class in _STANDART_LINE_ITEMS:
        cls = f' class="{row_class}"' if row_class else ""
        price_cell = (
            ""
            if hide_unit_price
            else f'<td style="text-align:right;">{_fmt_money(price)}</td>'
        )
        rows.append(
            f"<tr{cls}>"
            f"<td>{xml_escape(num)}</td>"
            f"<td>{xml_escape(name)}</td>"
            f"<td>{xml_escape(unit)}</td>"
            f'<td style="text-align:right;">{qty:g}</td>'
            f"{price_cell}"
            f'<td style="text-align:right;">{_fmt_money(total)}</td>'
            f"</tr>"
        )
    return "\n".join(rows)


def format_standart_default_total() -> str:
    return _fmt_money(float(KP_STANDART_DEFAULT_TOTAL))


KP_PRELIMINARY_HEADER_HTML = """
    <div class="kp-prelim-cols">
      <div class="kp-prelim-banner">
        <div class="kp-title-banner">{{kp_title_banner}}</div>
      </div>
      <div class="kp-prelim-right">
        <h1 class="kp-prelim-title">ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ</h1>
        <table class="kp-prelim-info">
          <tr><td>Размер дома, м</td><td>{{house_size_m}}</td></tr>
          <tr><td>Количество этажей</td><td>{{floors_label}}</td></tr>
          <tr><td>Количество комнат</td><td>{{room_count_label}}</td></tr>
          <tr><td>Площадь дома, м²</td><td>{{house_area_sqm}}</td></tr>
        </table>
      </div>
    </div>
"""


KP_DOM_KUBANI_STANDART_CLIENT_BODY = (
    KP_LAYOUT_MARKER
    + KP_CLIENT_TABLE_MARKER
    + """
<div class="kp-landscape-doc kp-client-table-only">
  <div class="kp-page">
  <div class="kp-panel kp-panel-table">
"""
    + KP_PRELIMINARY_HEADER_HTML
    + """
    <table class="kp-table">
      <thead>
        <tr>
          <th style="width:5%;">№</th>
          <th>Номенклатура</th>
          <th style="width:8%;">Ед.</th>
          <th style="width:10%;">Кол-во</th>
          <th style="width:12%;">Сумма, ₽</th>
        </tr>
      </thead>
      <tbody>
        {{kp_items_table}}
      </tbody>
    </table>
    <p class="kp-total">Итого: <strong>{{total_amount}}</strong></p>
  </div>
  </div>
{{kp_photos_page}}
</div>"""
)


KP_DOM_KUBANI_STANDART_BODY = (
    KP_LAYOUT_MARKER
    + """
<div class="kp-landscape-doc">
  <div class="kp-page">
  <div class="kp-panel">
"""
    + KP_PRELIMINARY_HEADER_HTML
    + """
    <p class="kp-prelim-meta">КП № {{kp_number}} от {{kp_date}} · срок действия {{kp_validity_days}} дн.</p>
    <p>Уважаемый(ая) <strong>{{customer_full_name}}</strong>!</p>
    <p>
      Направляем предварительный расчёт стоимости домокомплекта пакета
      <strong>«Стандарт»</strong> по проекту <strong>«{{project_title}}»</strong>
      (спецификация <strong>{{specification_number}}</strong>).
    </p>
    <section class="kp-block">
      <h2>Заказчик и объект</h2>
      <table class="kp-info">
        <tr><td>Заказчик</td><td>{{customer_contact_line}}</td></tr>
        <tr><td>Адрес участка</td><td>{{customer_address}}</td></tr>
        <tr><td>Проект</td><td>{{project_number}} — {{project_name}}</td></tr>
        <tr><td>Примечание</td><td>{{foundation}}</td></tr>
      </table>
    </section>
  </div>
  </div>

  <div class="kp-page">
  <div class="kp-panel kp-panel-table">
    <section class="kp-block">
      <h2>Состав предложения и стоимость</h2>
      <table class="kp-table">
        <thead>
          <tr>
            <th style="width:5%;">№</th>
            <th>Номенклатура</th>
            <th style="width:8%;">Ед.</th>
            <th style="width:10%;">Кол-во</th>
            <th style="width:12%;">Цена, ₽</th>
            <th style="width:12%;">Сумма, ₽</th>
          </tr>
        </thead>
        <tbody>
          {{kp_items_table}}
        </tbody>
      </table>
      <p class="kp-total">Итого: <strong>{{total_amount}}</strong></p>
      <p class="kp-note">Предварительный расчёт. Окончательная стоимость уточняется после согласования комплектации и договора.</p>
    </section>
  </div>
  </div>
{{kp_photos_page}}

  <div class="kp-page">
  <div class="kp-panel">
    <div class="kp-cols">
      <section class="kp-block">
        <h2>Условия</h2>
        <ol>
          <li>Аванс — {{prepayment}} — в течение 5 рабочих дней после подписания договора.</li>
          <li>Остаток — {{balance}} — перед отгрузкой домокомплекта.</li>
          <li>Срок поставки комплекта: {{delivery_terms}}.</li>
        </ol>
      </section>
      <section class="kp-block">
        <h2>Пакет «Стандарт»</h2>
        <ul>
          <li>Домокомплект из минибруса, кровля, окна и двери по ведомости.</li>
          <li>Утепление пола и потолка, крепёж, сборка на участке.</li>
          <li>Покраска фасада — по расчёту.</li>
        </ul>
      </section>
    </div>
"""
    + KP_CONTACTS_RESOURCES_SECTION
    + """
    <p>С уважением,<br/><strong>ПСК &quot;Дома кубани&quot;</strong></p>
  </div>
  <footer class="kp-footer">
    Не является публичной офертой до момента подписания договора.
  </footer>
  </div>
</div>"""
)
