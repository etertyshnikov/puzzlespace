#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Печатает PG_* из DB_URI (.env или окружение) для scripts/schemaspy-generate.sh."""
import os
import shlex
from pathlib import Path
from urllib.parse import urlparse


def load_db_uri() -> str:
    uri = os.environ.get("DB_URI", "").strip()
    if uri:
        return uri
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.is_file():
        return ""
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("DB_URI="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> None:
    uri = load_db_uri()
    if not uri:
        raise SystemExit("DB_URI не задан (переменная окружения или .env)")
    u = urlparse(uri)
    print(f"PG_HOST={shlex.quote(u.hostname or '127.0.0.1')}")
    print(f"PG_PORT={shlex.quote(str(u.port or 5432))}")
    print(f"PG_DATABASE={shlex.quote((u.path or '/postgres').lstrip('/'))}")
    print(f"PG_USER={shlex.quote(u.username or 'postgres')}")
    print(f"PG_PASSWORD={shlex.quote(u.password or '')}")


if __name__ == "__main__":
    main()
