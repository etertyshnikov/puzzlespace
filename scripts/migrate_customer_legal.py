#!/usr/bin/env python3
"""Устарело: колонки customers — в app.migrations.apply. Запуск: python -m app.migrations.apply"""
from app.migrations.apply import apply_full_schema

if __name__ == "__main__":
    apply_full_schema()
    print("customers schema — OK (via apply_full_schema)")
