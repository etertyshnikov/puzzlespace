# -*- coding: utf-8 -*-
"""Подложка КП на каждую страницу PDF после рендера Playwright."""
from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.services.kp_landscape_assets import KP_BACKGROUND_FILENAME, _resolve_background_path

logger = logging.getLogger(__name__)


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


def _apply_pypdf(pdf_bytes: bytes, path: Path) -> bytes:
    reader = PdfReader(BytesIO(pdf_bytes))
    if not reader.pages:
        return pdf_bytes

    writer = PdfWriter()
    for page in reader.pages:
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        bg_reader = PdfReader(BytesIO(_background_page_pdf(w, h, path)))
        bg_page = bg_reader.pages[0]
        bg_page.merge_page(page)
        writer.add_page(bg_page)

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def _apply_pymupdf(pdf_bytes: bytes, path: Path) -> bytes:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page in doc:
            page.insert_image(
                page.rect,
                filename=str(path),
                keep_proportion=True,
                overlay=False,
            )
        return doc.tobytes()
    finally:
        doc.close()


def apply_kp_page_background(
    pdf_bytes: bytes,
    image_path: Path | None = None,
) -> bytes:
    """
    Дублирует PNG-подложку под содержимое (если в Chromium фон не напечатался).
    Основной способ — background-image в landscape_print_css на .kp-page.
    """
    path = image_path or _resolve_background_path()
    if not path or not path.is_file():
        logger.error(
            "KP background image not found at %s. PDF without background overlay.",
            path or KP_BACKGROUND_FILENAME,
        )
        return pdf_bytes

    try:
        import fitz  # PyMuPDF

        return _apply_pymupdf(pdf_bytes, path)
    except ImportError:
        logger.warning("PyMuPDF not installed; using pypdf fallback for KP background")
        return _apply_pypdf(pdf_bytes, path)
