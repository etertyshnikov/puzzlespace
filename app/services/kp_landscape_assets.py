# -*- coding: utf-8 -*-
"""Подложка и стили альбомного КП (A4 landscape)."""
from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse, urlunparse

KP_BACKGROUND_FILENAME = "IMG_20260518_095427.png"
KP_LOGO_FILENAME = "logo KP.png"
KP_TITLE_BANNER_FILENAME = "title psk doma kubani.png"
KP_LAYOUT_MARKER = "<!-- kp-layout:landscape -->"
KP_CLIENT_TABLE_MARKER = "<!-- kp-layout:client-table-only -->"
KP_DEFAULT_MANAGER_PHONE = "+7 (961) 282-99-38"
KP_DEFAULT_MANAGER_PHONE_TEL = "+79612829938"
KP_SIGNOFF_ORGANIZATION = 'ПСК "Дома кубани"'
KP_FOOTER_DISCLAIMER_INTERNAL = "Не является публичной офертой до момента подписания договора."
KP_FOOTER_DISCLAIMER_CLIENT = "Сформировано в системе smetadomacrm.ru"

# Ссылки и адреса офисов (КП для клиента): после телефона менеджера, до подписи.
KP_CONTACTS_EXTRA_LINKS: list[tuple[str | None, str, str]] = [
    (None, "МАХ ПСК Дома Кубани", "https://max.ru/id583709933350_biz"),
    (None, "Телеграм ПСК Дома Кубани", "https://t.me/minibrus123"),
    (None, "Сайт ПСК Дома Кубани", "http://domakubani.ru"),
]
KP_CONTACTS_EXTRA_CATALOG_LINKS: list[tuple[str | None, str, str]] = [
    (None, "Каталог домов в МАХ", "https://max.ru/id614902200022_biz"),
    (None, "Каталог домов", "https://pskdoma.ru"),
]
KP_CONTACTS_EXTRA_MATERIALS_LINK: tuple[str | None, str, str] = (
    None,
    "Каталог пиломатериала и поганажных изделий",
    "https://xn--80aafh8a4a.xn--p1ai/",
)
KP_CONTACTS_OFFICE_ADDRESSES: list[tuple[str, str, str]] = [
    (
        "Краснодар - ",
        "улица Тургеневское шоссе, 17, аул Новая Адыгея, г. Краснодар",
        "https://yandex.ru/maps/org/doma_kubani/42109294970?si=ecoShifts",
    ),
    (
        "Сочи - ",
        "Краснодарский край, Сочи, микрорайон Молдовка, ул Комстроская д 188",
        "https://yandex.ru/maps/org/doma_kubani/10649433614?si=ecoShifts",
    ),
    (
        "Симферополь - ",
        "Коммунальная ул., 28Б, Симферополь",
        "https://yandex.ru/maps/org/psk_doma/209385774028?si=ecoShifts",
    ),
]


def pdf_safe_link_url(url: str) -> str:
    """ASCII-URL для PDF-аннотаций (IDN-домены → punycode)."""
    parsed = urlparse((url or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return url
    host = parsed.hostname or ""
    try:
        host_ascii = host.encode("idna").decode("ascii")
    except (UnicodeError, AttributeError):
        host_ascii = host
    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{host_ascii}{port}"
    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth += f":{parsed.password}"
        netloc = f"{auth}@{netloc}"
    return urlunparse(
        (parsed.scheme, netloc, parsed.path or "", parsed.params, parsed.query, parsed.fragment)
    )


def _kp_contacts_link_html(prefix: str | None, label: str, url: str) -> str:
    safe_url = pdf_safe_link_url(url).replace('"', "&quot;")
    return (
        f'<p class="kp-contacts-link-line">{prefix or ""}'
        f'<a href="{safe_url}" target="_blank" rel="noopener noreferrer">{label}</a></p>'
    )


def kp_contacts_extra_links_html() -> str:
    parts: list[str] = ['<div class="kp-contacts-extra">']
    for prefix, label, url in KP_CONTACTS_EXTRA_LINKS:
        parts.append(_kp_contacts_link_html(prefix, label, url))
    parts.append('<hr class="kp-contacts-divider"/>')
    for prefix, label, url in KP_CONTACTS_EXTRA_CATALOG_LINKS:
        parts.append(_kp_contacts_link_html(prefix, label, url))
    parts.append('<hr class="kp-contacts-divider"/>')
    prefix, label, url = KP_CONTACTS_EXTRA_MATERIALS_LINK
    parts.append(_kp_contacts_link_html(prefix, label, url))
    parts.append('<hr class="kp-contacts-divider"/>')
    parts.append('<p class="kp-contacts-offices-title"><strong>Адреса офисов:</strong></p>')
    for prefix, label, url in KP_CONTACTS_OFFICE_ADDRESSES:
        parts.append(_kp_contacts_link_html(prefix, label, url))
    parts.append("</div>")
    return "\n".join(parts)


# Блок «Контакты» (HTML-шаблон КП)
KP_CONTACTS_RESOURCES_SECTION = (
    f"""
    <section class="kp-block">
      <h2>5. Контакты</h2>
      <p><strong>Менеджер:</strong> {{{{manager_name}}}}<br>
        тел.:
        <a href="tel:{KP_DEFAULT_MANAGER_PHONE_TEL}">{{{{contact_phone}}}}</a></p>
"""
    + kp_contacts_extra_links_html()
    + """
    </section>"""
)

def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _resolve_background_path() -> Path | None:
    root = _project_root()
    for candidate in (
        root / "static" / "images" / KP_BACKGROUND_FILENAME,
        Path.cwd() / "static" / "images" / KP_BACKGROUND_FILENAME,
        Path("/opt/fastapi/smetadoma05/static/images") / KP_BACKGROUND_FILENAME,
    ):
        if candidate.is_file():
            return candidate
    return None


def _resolve_logo_path() -> Path | None:
    root = _project_root()
    for candidate in (
        root / "static" / "images" / KP_LOGO_FILENAME,
        Path.cwd() / "static" / "images" / KP_LOGO_FILENAME,
        Path("/opt/fastapi/smetadoma05/static/images") / KP_LOGO_FILENAME,
    ):
        if candidate.is_file():
            return candidate
    return None


def _resolve_title_banner_path() -> Path | None:
    root = _project_root()
    for candidate in (
        root / "static" / "images" / KP_TITLE_BANNER_FILENAME,
        Path.cwd() / "static" / "images" / KP_TITLE_BANNER_FILENAME,
        Path("/opt/fastapi/smetadoma05/static/images") / KP_TITLE_BANNER_FILENAME,
    ):
        if candidate.is_file():
            return candidate
    return None


@lru_cache(maxsize=1)
def logo_image_data_uri() -> str:
    path = _resolve_logo_path()
    if not path:
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def kp_logo_img_markup() -> str:
    """HTML логотипа для шапки КП (data URI — работает в PDF и превью)."""
    uri = logo_image_data_uri()
    if not uri:
        return ""
    return (
        f'<img class="kp-logo-img" src="{uri}" alt="Дома Кубани" '
        'width="320" height="96" style="height:96px;width:auto;max-width:320px;"/>'
    )


@lru_cache(maxsize=1)
def title_banner_image_data_uri() -> str:
    path = _resolve_title_banner_path()
    if not path:
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    suffix = path.suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg"
    return f"data:{mime};base64,{encoded}"


def kp_title_banner_markup() -> str:
    """Верхний баннер КП (ПСК Дома Кубани)."""
    uri = title_banner_image_data_uri()
    if not uri:
        return ""
    return (
        f'<img class="kp-title-banner-img" src="{uri}" alt="ПСК Дома Кубани"/>'
    )


def inject_kp_logo_markup(html: str) -> str:
    """Подставляет логотип вместо названия организации в блоке .kp-logo."""
    import re

    markup = kp_logo_img_markup()
    if not markup:
        return html
    out = re.sub(r"\{\{\s*kp_logo\s*\}\}", markup, html, flags=re.I)
    out = re.sub(
        r'(<div class="kp-logo">)\s*(?:<img[^>]*>\s*)?(?:(?!<span>).)+?(?=\s*<span>)',
        rf"\1\n          {markup}\n          ",
        out,
        count=1,
        flags=re.I | re.DOTALL,
    )
    return out


def inject_kp_title_banner(html: str) -> str:
    """Подставляет верхний баннер {{kp_title_banner}}."""
    import re

    markup = kp_title_banner_markup()
    if not markup:
        return html
    return re.sub(r"\{\{\s*kp_title_banner\s*\}\}", markup, html, flags=re.I)


def inject_kp_assets(html: str) -> str:
    """Логотип и верхний баннер."""
    return inject_kp_title_banner(inject_kp_logo_markup(html))


@lru_cache(maxsize=1)
def background_image_data_uri() -> str:
    path = _resolve_background_path()
    if not path:
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"url('data:image/png;base64,{encoded}')"


def landscape_background_css_var() -> str:
    bg = background_image_data_uri()
    return bg if bg else "none"


def _kp_preliminary_header_css() -> str:
    return """
.kp-prelim-cols {
  display: flex;
  gap: 12px;
  align-items: stretch;
  margin-bottom: 10px;
}
.kp-prelim-banner {
  flex: 0 0 40%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
}
.kp-prelim-banner .kp-title-banner {
  margin: 0;
  width: 100%;
  text-align: center;
}
.kp-title-banner-img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 42mm;
  object-fit: contain;
  margin: 0 auto;
}
.kp-prelim-right {
  flex: 1 1 60%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kp-prelim-right .kp-prelim-title {
  text-align: center;
  font-size: 13pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0;
  padding: 6px 10px;
  background: #fff3cd;
  border: 1px solid #e6c200;
  color: #1a1a1a;
}
.kp-prelim-info {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  line-height: 1.25;
}
.kp-prelim-info td {
  border: 1px solid #e6c200;
  padding: 4px 8px;
  vertical-align: middle;
}
.kp-prelim-info td:first-child {
  width: 58%;
  background: #fff3cd;
  font-weight: 600;
  color: #1a1a1a;
}
.kp-prelim-info td:last-child {
  background: #fff;
  text-align: center;
  font-weight: 600;
}
.kp-prelim-meta { font-size: 8.5pt; color: #555; margin: 0 0 8px; }
.kp-page-photos {
  page-break-after: always;
  break-after: page;
}
.kp-page-photos:last-of-type {
  page-break-after: auto;
  break-after: auto;
}
.kp-page-photos .kp-panel-photos {
  padding: 8mm 10mm;
  min-height: 175mm;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.kp-photos-grid {
  display: flex;
  gap: 10mm;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}
.kp-photo-slot {
  flex: 1 1 50%;
  min-width: 0;
  max-height: 170mm;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kp-photo-slot img,
.kp-photo-slot .kp-photo-img {
  display: block;
  max-width: 100%;
  max-height: 165mm;
  width: auto;
  height: auto;
  object-fit: contain;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.kp-photo-slot-empty { visibility: hidden; }
"""


def _kp_table_compact_css(*, ultra: bool = False) -> str:
    """Общие стили таблицы позиций КП (компактная вёрстка). ultra — вариант «только таблица»."""
    fs = "7.5pt" if ultra else "8pt"
    fs_head = "7.5pt" if ultra else "8pt"
    pad = "1px 3px" if ultra else "2px 4px"
    lh = "1.12" if ultra else "1.2"
    total_mt = "4px" if ultra else "6px"
    total_fs = "9pt" if ultra else "10pt"
    total_strong = "10pt" if ultra else "11pt"
    return f"""
table.kp-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: {fs};
  line-height: {lh};
}}
table.kp-table th, table.kp-table td {{
  border: 1px solid #bbb;
  padding: {pad};
  vertical-align: top;
}}
table.kp-table th {{
  background: #ef8013;
  color: #fff;
  font-weight: 600;
  font-size: {fs_head};
  padding-top: 3px;
  padding-bottom: 3px;
}}
table.kp-table td:nth-child(1),
table.kp-table td:nth-child(3),
table.kp-table td:nth-child(4),
table.kp-table td:nth-child(5),
table.kp-table td:nth-child(6) {{
  white-space: nowrap;
}}
table.kp-table td:nth-child(2) {{
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}}
.kp-part-title td {{
  background: #F7A14C;
  color: #1a1a1a;
  font-weight: 600;
  font-size: {fs_head};
  padding: {pad};
}}
table.kp-table tr.kp-row-warm td {{ background: #fdebd0; }}
table.kp-table tr.kp-row-cool td {{ background: #d6eaf8; }}
.kp-total {{ margin-top: {total_mt}; text-align: right; font-size: {total_fs}; line-height: 1.2; }}
.kp-total strong {{ font-size: {total_strong}; color: #1e7e6a; }}
table.kp-table thead {{ display: table-header-group; }}
table.kp-table tr {{ page-break-inside: avoid; }}
.kp-panel-table {{ padding: 6px 8px !important; }}
.kp-panel-table .kp-block h2 {{
  font-size: 10pt;
  margin: 0 0 4px;
  padding-bottom: 2px;
}}
"""


def landscape_print_css() -> str:
    """Стили КП: подложка на каждый .kp-page (data URI) + дублирование в pdf_kp_background при PDF."""
    bg = landscape_background_css_var()
    page_bg = (
        f"background-image: {bg}; background-size: cover; "
        "background-position: center; background-repeat: no-repeat;"
        if bg != "none"
        else ""
    )
    kp_page = (
        ".kp-page {\n"
        "  position: relative;\n"
        "  min-height: 190mm;\n"
        "  padding: 8mm 10mm;\n"
        "  page-break-after: always;\n"
        "  break-after: page;\n"
        f"  {page_bg}\n"
        "}"
    )
    return (
        """
@page {
  size: A4 landscape;
  margin: 0;
}
@media print {
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  font-size: 10.5pt; line-height: 1.45; color: #1a1a1a;
  background: transparent !important;
}
.kp-landscape-doc { width: 100%; background: transparent; }
"""
        + kp_page
        + """
.kp-page:last-child { page-break-after: auto; break-after: auto; }
.kp-panel {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  page-break-inside: avoid;
}
.kp-panel-table { page-break-inside: auto; background: rgba(255, 255, 255, 0.78); }
.kp-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 20px; margin-bottom: 4px;
}
.kp-logo {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
}
.kp-logo-img {
  height: 96px; width: auto; max-width: 320px; object-fit: contain; display: block;
}
.kp-logo span { display: block; font-size: 10pt; font-weight: 400; color: #444; }
.kp-meta { text-align: right; font-size: 10pt; }
.kp-meta strong { display: block; font-size: 12pt; margin-bottom: 4px; color: #1a1a1a; }
.kp-badge {
  display: inline-block; margin-top: 6px; padding: 3px 10px;
  background: #d4f0ea; color: #1e7e6a; font-size: 9pt; border-radius: 4px;
}
.kp-badge-standart { background: #fff3cd; color: #856404; font-weight: 600; }
.kp-params-bar {
  background: #fff3cd; border: 1px solid #e6c200; border-radius: 6px;
  padding: 10px 14px; margin: 10px 0 12px;
}
.kp-params-grid { width: 100%; border-collapse: collapse; font-size: 10pt; }
.kp-params-grid th, .kp-params-grid td {
  border: 1px solid #e6c200; padding: 6px 10px; text-align: center;
}
.kp-params-grid th { background: #ffe69c; font-weight: 600; color: #1a1a1a; }
.kp-block h2 {
  font-size: 12pt; color: #1e7e6a; margin: 0 0 8px;
  border-bottom: 2px solid #26B99A; padding-bottom: 4px;
}
.kp-info { width: 100%; border-collapse: collapse; }
.kp-info td { border: none; padding: 3px 8px 3px 0; vertical-align: top; }
.kp-info td:first-child { width: 32%; color: #555; font-weight: 600; }
"""
        + _kp_preliminary_header_css()
        + _kp_table_compact_css()
        + """
.kp-note { font-size: 8pt; color: #666; margin-top: 4px; line-height: 1.2; }
.kp-cols { display: flex; gap: 16px; flex-wrap: wrap; }
.kp-cols > section { flex: 1; min-width: 45%; }
.kp-page:last-child { padding-bottom: 32mm; }
.kp-footer {
  position: absolute;
  left: 10mm;
  right: 10mm;
  bottom: 5mm;
  margin: 0;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  font-size: 8.5pt;
  line-height: 1.45;
  color: #444;
  text-align: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.kp-block a, .kp-footer a {
  color: #1e7e6a; text-decoration: underline;
}
.kp-block a:hover, .kp-footer a:hover { color: #156b58; }
.kp-contacts-extra { margin-top: 8px; font-size: 9pt; }
.kp-contacts-link-line { margin: 2px 0; line-height: 1.35; }
.kp-contacts-divider { border: none; border-top: 1px solid #bbb; margin: 7px 0; }
.kp-contacts-offices-title { margin: 2px 0 4px; }
ul, ol { margin: 4px 0; padding-left: 1.4em; }
p { margin: 6px 0; }
"""
    )


DEFAULT_KP_LANDSCAPE_BODY = (
    KP_LAYOUT_MARKER
    + """
<div class="kp-landscape-doc">
  <div class="kp-page">
  <div class="kp-panel">
    <header class="kp-header">
      <div>
        <div class="kp-logo">{{kp_logo}}
          <span>Дома из минибруса</span>
        </div>
      </div>
      <div class="kp-meta">
        <strong>Коммерческое предложение</strong>
        № {{kp_number}} от {{kp_date}}<br/>
        Срок действия: {{kp_validity_days}} календарных дней
        <span class="kp-badge">Предварительный расчёт</span>
      </div>
    </header>
    <p>Уважаемый(ая) <strong>{{customer_full_name}}</strong>!</p>
    <p>
      Благодарим за интерес к строительству частного дома. Направляем Вам коммерческое предложение
      по проекту <strong>«{{project_title}}»</strong> на основании спецификации
      <strong>{{specification_number}}</strong>.
    </p>
    <section class="kp-block">
      <h2>1. Параметры объекта</h2>
      <table class="kp-info">
        <tr><td>Проект</td><td>{{project_number}} — {{project_name}}</td></tr>
        <tr><td>Спецификация</td><td>{{specification_number}}</td></tr>
        <tr><td>Заказчик</td><td>{{customer_contact_line}}</td></tr>
        <tr><td>Адрес участка</td><td>{{customer_address}}</td></tr>
        <tr><td>Тип дома</td><td>{{house_type}}</td></tr>
        <tr><td>Площадь</td><td>{{house_area}}</td></tr>
        <tr><td>Примечание:</td><td>{{foundation}}</td></tr>
        <tr><td>Срок поставки комплекта</td><td>{{delivery_terms}}</td></tr>
      </table>
    </section>
  </div>
  </div>

  <div class="kp-page">
  <div class="kp-panel kp-panel-table">
    <section class="kp-block">
      <h2>2. Состав предложения и стоимость</h2>
      <table class="kp-table">
        <thead>
          <tr>
            <th style="width:5%;">№</th>
            <th>Наименование</th>
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
      <p class="kp-total">Итого по предложению: <strong>{{total_amount}}</strong></p>
      <p class="kp-note">Окончательная стоимость фиксируется в договоре после согласования спецификации.</p>
    </section>
  </div>
  </div>

  <div class="kp-page">
  <div class="kp-panel">
    <div class="kp-cols">
      <section class="kp-block">
        <h2>3. Что входит в поставку</h2>
        <ul>
          <li>Проектная документация и раскройные карты (при заказе домокомплекта).</li>
          <li>Комплект несущих материалов согласно спецификации.</li>
          <li>Крепёж, плёнки, ленты, узловые элементы по ведомости.</li>
          <li>Техническая поддержка на этапе сборки (в рамках выбранного пакета).</li>
        </ul>
      </section>
      <section class="kp-block">
        <h2>4. Условия оплаты и сроки</h2>
        <ol>
          <li>Аванс — {{prepayment}} — в течение 5 рабочих дней после подписания договора.</li>
          <li>Остаток — {{balance}} — перед отгрузкой домокомплекта со склада.</li>
          <li>Изменение комплектации после подписания договора — по дополнительному соглашению.</li>
        </ol>
      </section>
    </div>
""" + KP_CONTACTS_RESOURCES_SECTION + """
    <p>Будем рады ответить на вопросы и подготовить детализированную смету под ваш участок.</p>
    <p>С уважением,<br/><strong>ПСК &quot;Дома кубани&quot;</strong></p>
  </div>
  <footer class="kp-footer">
    Не является публичной офертой до момента подписания договора.
  </footer>
  </div>
</div>"""
)


def is_landscape_kp_html(html: str) -> bool:
    return KP_LAYOUT_MARKER in (html or "")


def is_client_table_only_kp_html(html: str) -> bool:
    return KP_CLIENT_TABLE_MARKER in (html or "")


def landscape_print_css_table_only() -> str:
    """Альбомный КП для клиента: белый фон, без подложки, только таблица."""
    return (
        """
@page {
  size: A4 landscape;
  margin: 6mm;
}
@media print {
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  font-size: 10.5pt; line-height: 1.45; color: #1a1a1a;
  background: #fff !important;
}
.kp-landscape-doc.kp-client-table-only { width: 100%; background: #fff; }
.kp-client-table-only .kp-page {
  position: relative;
  min-height: auto;
  padding: 0;
  background: #fff !important;
  background-image: none !important;
  page-break-after: auto;
  break-after: auto;
}
.kp-client-table-only .kp-panel {
  background: #fff;
  border-radius: 0;
  padding: 0;
  margin: 0;
  box-shadow: none;
}
.kp-client-table-only .kp-panel-table { page-break-inside: auto; }
"""
        + _kp_preliminary_header_css()
        + _kp_table_compact_css(ultra=True)
        + """
.kp-client-table-only .kp-prelim-title { font-size: 12pt; padding: 5px 8px; margin-bottom: 6px; }
.kp-client-table-only .kp-prelim-cols { margin-bottom: 6px; }
.kp-client-table-only .kp-prelim-banner .kp-title-banner-img { max-height: 38mm; }
.kp-client-table-only .kp-page-photos .kp-panel-photos { min-height: 175mm; }
"""
    )


def landscape_body_prefix() -> str:
    """Подложка для PDF накладывается в pdf_kp_background после Playwright."""
    return ""
