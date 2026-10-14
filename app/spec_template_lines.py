# -*- coding: utf-8 -*-
"""Номера строк шаблона спецификации дома (1-based), учёт в общей сумме — по галочке."""

OPTIONAL_TOTAL_TEMPLATE_LINE_NUMBERS = frozenset({19, 20, 21, 22})


def is_optional_total_template_line(template_line_no: int | None) -> bool:
    return template_line_no is not None and template_line_no in OPTIONAL_TOTAL_TEMPLATE_LINE_NUMBERS


def default_include_in_total_for_template_line(template_line_no: int) -> bool:
    """Строки 19–22 по умолчанию не входят в сумму (галочка снята)."""
    return template_line_no not in OPTIONAL_TOTAL_TEMPLATE_LINE_NUMBERS
