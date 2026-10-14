# -*- coding: utf-8 -*-
"""Альбомный бланк сметы «Дом на Юге» со ссылками в шапке и подвале."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

_FONT = "Helvetica"
_FONT_B = "Helvetica-Bold"
for regular, bold, name in (
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "Liberation"),
):
    if Path(regular).is_file() and Path(bold).is_file():
        pdfmetrics.registerFont(TTFont(name, regular))
        pdfmetrics.registerFont(TTFont(name + "-Bold", bold))
        _FONT = name
        _FONT_B = name + "-Bold"
        break

_ASSETS = Path(__file__).resolve().parent / "assets"
_LOGO = _ASSETS / "logo.jpg"
_COAST = _ASSETS / "coast.jpg"

NAVY = Color(0.043, 0.298, 0.408)
INK = Color(0.12, 0.22, 0.28)
MUTED = Color(0.30, 0.40, 0.46)
SAND = Color(0.973, 0.953, 0.914)
GOLD = Color(0.82, 0.64, 0.32)
ORANGE = Color(0.941, 0.627, 0.102)
SEA = Color(0.15, 0.55, 0.72)

SERVICE_URL = "https://puzzlespace.ru/estimate"
SITE_URL = "https://puzzlespace.ru/"
MAX_CHANNEL_URL = "https://max.ru/channel_PuzzleSpace_ru"
TELEGRAM_URL = "https://t.me/puzzlespace_ru"
YOUTUBE_URL = "https://www.youtube.com/@puzzlespace_ru"
VK_URL = "https://vk.ru/puzzlespace"
MANAGER_URL = "https://max.ru/u/f9LHodD0cOJAq_i64k5um5BJJliYY50kfcyZ6CNUPy7DHmQfHAsPTmPyTmM"

TECH_COLORS = {
    "frame": Color(0.043, 0.298, 0.408),
    "poly": Color(0.239, 0.494, 0.651),
    "clay": Color(0.769, 0.361, 0.149),
    "gas": Color(0.941, 0.627, 0.102),
    "timber": Color(0.184, 0.561, 0.420),
    "log": Color(0.541, 0.451, 0.333),
    "modular": Color(0.541, 0.302, 0.541),
}


def _rub(amount: int) -> str:
    return f"{int(amount):,}".replace(",", " ") + " ₽"


def _wrap(pdf: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    words = str(text).split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = current + " " + word
        if pdf.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _fit(pdf: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> str:
    if pdf.stringWidth(text, font, size) <= max_width:
        return text
    trimmed = text
    while trimmed and pdf.stringWidth(trimmed + "…", font, size) > max_width:
        trimmed = trimmed[:-1]
    return (trimmed or text[:1]) + "…"


def _link(pdf: canvas.Canvas, url: str, x1: float, y1: float, x2: float, y2: float) -> None:
    pdf.linkURL(url, (x1, y1, x2, y2), relative=0, thickness=0)


def _button(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    text: str,
    url: str,
    fill: Color,
    ink: Color,
    size: float = 10,
) -> None:
    pdf.setFillColor(fill)
    pdf.roundRect(x, y, width, height, 2.4 * mm, fill=1, stroke=0)
    pdf.setFillColor(ink)
    pdf.setFont(_FONT_B, size)
    pdf.drawCentredString(x + width / 2, y + (height - size) / 2 + 0.6, text)
    _link(pdf, url, x, y, x + width, y + height)


def _linked_label(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    prefix: str,
    label: str,
    url: str,
    size: float = 9,
) -> float:
    pdf.setFont(_FONT, size)
    pdf.setFillColor(INK)
    pdf.drawString(x, y, prefix)
    prefix_w = pdf.stringWidth(prefix, _FONT, size)
    pdf.setFont(_FONT_B, size)
    pdf.setFillColor(NAVY)
    pdf.drawString(x + prefix_w, y, label)
    label_w = pdf.stringWidth(label, _FONT_B, size)
    pdf.setStrokeColor(NAVY)
    pdf.setLineWidth(0.6)
    pdf.line(x + prefix_w, y - 1.1, x + prefix_w + label_w, y - 1.1)
    _link(pdf, url, x + prefix_w, y - 2, x + prefix_w + label_w, y + size)
    return prefix_w + label_w


def _chrome(pdf: canvas.Canvas, width: float, height: float, subtitle: str) -> tuple[float, float]:
    """Рамка бланка, шапка с логотипом и подвал со ссылками. Возвращает верх и низ рабочей области."""
    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(2.2)
    pdf.rect(5 * mm, 5 * mm, width - 10 * mm, height - 10 * mm, fill=0, stroke=1)
    pdf.setStrokeColor(NAVY)
    pdf.setLineWidth(0.6)
    pdf.rect(7 * mm, 7 * mm, width - 14 * mm, height - 14 * mm, fill=0, stroke=1)

    logo_size = 22 * mm
    logo_x = 11 * mm
    logo_y = height - 12 * mm - logo_size
    if _LOGO.is_file():
        pdf.drawImage(str(_LOGO), logo_x, logo_y, logo_size, logo_size, preserveAspectRatio=True, anchor="c", mask="auto")

    title_x = 36 * mm
    pdf.setFillColor(NAVY)
    pdf.setFont(_FONT_B, 20)
    pdf.drawString(title_x, height - 18 * mm, "Дом на Юге")
    pdf.setFillColor(INK)
    pdf.setFont(_FONT, 10)
    pdf.drawString(title_x, height - 24.5 * mm, _fit(pdf, subtitle, _FONT, 10, width - title_x - 96 * mm))
    pdf.setFillColor(MUTED)
    pdf.setFont(_FONT, 8)
    pdf.drawString(title_x, height - 30 * mm, "Цифры — старт разговора со строителем. Это не публичная оферта.")

    photo_w = 78 * mm
    photo_h = 22 * mm
    photo_x = width - 12 * mm - photo_w
    photo_y = height - 12 * mm - photo_h
    if _COAST.is_file():
        pdf.saveState()
        clip = pdf.beginPath()
        clip.roundRect(photo_x, photo_y, photo_w, photo_h, 2.5 * mm)
        pdf.clipPath(clip, stroke=0, fill=0)
        iw, ih = ImageReader(str(_COAST)).getSize()
        draw_w = photo_w * 1.35
        draw_h = draw_w * (ih / float(iw))
        # Дом стоит в правой нижней части кадра: прижимаем снимок вправо и чуть вверх.
        pdf.drawImage(
            str(_COAST),
            photo_x + photo_w - draw_w + 4 * mm,
            photo_y + photo_h * 0.55 - draw_h * 0.22,
            draw_w,
            draw_h,
            preserveAspectRatio=False,
            mask="auto",
        )
        pdf.restoreState()
        pdf.setStrokeColor(GOLD)
        pdf.setLineWidth(1)
        pdf.roundRect(photo_x, photo_y, photo_w, photo_h, 2.5 * mm, fill=0, stroke=1)

    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1.4)
    pdf.line(11 * mm, height - 37 * mm, width - 11 * mm, height - 37 * mm)
    pdf.setStrokeColor(SEA)
    pdf.setLineWidth(0.5)
    pdf.line(11 * mm, height - 38.4 * mm, width - 11 * mm, height - 38.4 * mm)

    content_top = height - 42 * mm
    footer_top = 52 * mm

    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.8)
    pdf.line(11 * mm, footer_top, width - 11 * mm, footer_top)

    service = "Создано при помощи сервиса «Дом на Юге»"
    pdf.setFont(_FONT_B, 8.5)
    service_w = pdf.stringWidth(service, _FONT_B, 8.5) + 8 * mm
    _button(pdf, 12 * mm, 41.5 * mm, service_w, 7.4 * mm, service, SERVICE_URL, NAVY, white, size=8.5)

    site_label = "Наш сайт — https://puzzlespace.ru/ — собери свой мир"
    pdf.setFont(_FONT, 9)
    site_w = pdf.stringWidth(site_label, _FONT, 9)
    site_x = width - 12 * mm - site_w
    if site_x < 12 * mm + service_w + 4 * mm:
        site_x = 12 * mm
    pdf.setFillColor(INK)
    pdf.drawString(site_x, 33.2 * mm, site_label)
    url_prefix = "Наш сайт — "
    url_text = "https://puzzlespace.ru/"
    url_x = site_x + pdf.stringWidth(url_prefix, _FONT, 9)
    url_w = pdf.stringWidth(url_text, _FONT, 9)
    pdf.setStrokeColor(NAVY)
    pdf.setLineWidth(0.5)
    pdf.line(url_x, 32.2 * mm, url_x + url_w, 32.2 * mm)
    _link(pdf, SITE_URL, url_x, 32 * mm, url_x + url_w, 37 * mm)

    x = 12 * mm
    y = 26.2 * mm
    x += _linked_label(pdf, x, y, "Канал в МАХ — ", "Дом на Юге", MAX_CHANNEL_URL)
    x += 7 * mm
    x += _linked_label(pdf, x, y, "Канал в Телеграм — ", "Дом на Юге", TELEGRAM_URL)
    x += 7 * mm
    x += _linked_label(pdf, x, y, "", "YouTube", YOUTUBE_URL)
    x += 7 * mm
    _linked_label(pdf, x, y, "", "ВК", VK_URL)

    button_w = 150 * mm
    _button(
        pdf,
        (width - button_w) / 2,
        11 * mm,
        button_w,
        12 * mm,
        "Написать менеджеру в МАХ",
        MANAGER_URL,
        ORANGE,
        NAVY,
        size=13,
    )
    return content_top, footer_top + 3 * mm


def render_estimate_pdf(quote: dict, public_url: str) -> bytes:
    result = quote["result"]
    buffer = BytesIO()
    page = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=page)
    pdf.setTitle("Смета — Дом на Юге")
    pdf.setAuthor("Дом на Юге")
    pdf.setSubject(public_url)
    width, height = page
    purpose = next((str(card["value"]) for card in result.get("cards") or [] if card.get("label") == "Назначение"), "")
    subtitle = "Ориентировочная смета строительства"
    if purpose:
        subtitle = f"{purpose}. Ориентировочная смета строительства"
    top, bottom = _chrome(pdf, width, height, subtitle)

    left_x = 12 * mm
    left_w = 128 * mm
    right_x = 148 * mm
    right_w = width - right_x - 12 * mm
    panel_bottom = bottom
    panel_h = top - panel_bottom

    pdf.setFillColor(SAND)
    pdf.roundRect(left_x - 1.5 * mm, panel_bottom, left_w + 3 * mm, panel_h, 2.5 * mm, fill=1, stroke=0)
    pdf.roundRect(right_x - 1.5 * mm, panel_bottom, right_w + 3 * mm, panel_h, 2.5 * mm, fill=1, stroke=0)

    y = top - 5.5 * mm
    pdf.setFillColor(NAVY)
    pdf.setFont(_FONT_B, 12)
    pdf.drawString(left_x, y, f"Расчёт на {result['area_m2']:g} м²")
    y -= 5.6 * mm
    pdf.setFont(_FONT_B, 10)
    pdf.drawString(left_x, y, "Конфигурация")
    y -= 5 * mm
    value_width = 78 * mm
    for card in result["cards"]:
        value_lines = _wrap(pdf, str(card["value"]), _FONT_B, 8, value_width)
        pdf.setFillColor(MUTED)
        pdf.setFont(_FONT, 8)
        pdf.drawString(left_x, y, _fit(pdf, str(card["label"]), _FONT, 8, 46 * mm))
        pdf.setFillColor(NAVY)
        pdf.setFont(_FONT_B, 8)
        pdf.drawRightString(left_x + left_w, y, value_lines[0])
        for extra in value_lines[1:]:
            y -= 3.6 * mm
            pdf.drawRightString(left_x + left_w, y, extra)
        y -= 4.15 * mm

    y = top - 5.5 * mm
    pdf.setFillColor(NAVY)
    pdf.setFont(_FONT_B, 10)
    pdf.drawString(right_x, y, "Детализация")
    y -= 6.4 * mm
    for line in result["lines"]:
        pdf.setFillColor(white)
        pdf.roundRect(right_x, y - 1.8 * mm, right_w, 7.2 * mm, 1.3 * mm, fill=1, stroke=0)
        pdf.setFillColor(NAVY)
        pdf.setFont(_FONT_B, 8)
        pdf.drawString(right_x + 1.5 * mm, y + 2.1 * mm, f"{line['title']}  ·  {line['percent']}%")
        pdf.drawRightString(right_x + right_w - 1.5 * mm, y + 2.1 * mm, _rub(line["amount"]))
        pdf.setFillColor(MUTED)
        pdf.setFont(_FONT, 6.5)
        pdf.drawString(right_x + 1.5 * mm, y - 0.8 * mm, _fit(pdf, line["includes"], _FONT, 6.5, right_w - 4 * mm))
        y -= 7.8 * mm

    y -= 0.4 * mm
    pdf.setFillColor(ORANGE)
    pdf.roundRect(right_x, y - 1.2 * mm, right_w, 7.2 * mm, 1.5 * mm, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.setFont(_FONT_B, 11)
    pdf.drawString(right_x + 2 * mm, y + 1.1 * mm, "Итого")
    pdf.drawRightString(right_x + right_w - 2 * mm, y + 1.1 * mm, _rub(result["total"]))
    y -= 6.6 * mm

    pdf.setFont(_FONT_B, 10)
    pdf.drawString(right_x, y, "Те же вводные, другие технологии")
    y -= 5.2 * mm
    comparison = result["comparison"]
    peak = max((item["total"] for item in comparison), default=1) or 1
    price_w = 32 * mm
    bar_track = 26 * mm
    name_w = right_w - price_w - bar_track - 3 * mm
    for item in comparison:
        color = TECH_COLORS.get(item["id"], NAVY)
        font = _FONT_B if item["selected"] else _FONT
        title = item["title"] + (" · ваш выбор" if item["selected"] else "")
        pdf.setFillColor(NAVY if item["selected"] else INK)
        pdf.setFont(font, 8)
        pdf.drawString(right_x, y, _fit(pdf, title, font, 8, name_w))
        track_x = right_x + name_w + 1.5 * mm
        bar_w = max(2.4 * mm, bar_track * (item["total"] / peak))
        pdf.setFillColor(Color(0.90, 0.93, 0.95))
        pdf.roundRect(track_x, y - 0.6 * mm, bar_track, 3.1 * mm, 1 * mm, fill=1, stroke=0)
        pdf.setFillColor(color)
        pdf.roundRect(track_x, y - 0.6 * mm, bar_w, 3.1 * mm, 1 * mm, fill=1, stroke=0)
        pdf.setFillColor(NAVY)
        pdf.setFont(_FONT_B, 8)
        pdf.drawRightString(right_x + right_w, y, _rub(item["total"]))
        y -= 5.1 * mm

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
