#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Снимок данных smetadoma05_db → загрузка в smetadoma06_db (новая схема).

Пропускает удалённые legacy-таблицы и копирует только колонки,
которые есть в текущих SQLAlchemy-моделях (app/models/crm.py).

Использование:
  # 1) Схема на целевой БД
  bash scripts/migrate-apply.sh

  # 2) Снимок + перенос
  SOURCE_DB_URI='postgresql://user:pass@localhost:5432/smetadoma05_db' \\
  python scripts/migrate_db_data.py

  # Только снимок (без записи в target):
  python scripts/migrate_db_data.py --snapshot-only

  # Загрузка из ранее сохранённого снимка:
  python scripts/migrate_db_data.py --from-snapshot snapshots/smetadoma05_db_latest
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import app.models  # noqa: F401
from app.database import Base

# Таблицы web2py / legacy — не переносим
SKIP_TABLES = frozenset({
    "next_steps",
    "orders",
    "order_items",
    "commercial_proposals",
    "commercial_proposal_items",
    "schema_migrations",
    "alembic_version",
})

DEFAULT_SOURCE = os.environ.get(
    "SOURCE_DB_URI",
    "postgresql://smetadoma04:Lenina21@localhost:5432/smetadoma05_db",
)


def _load_target_uri() -> str:
    if os.environ.get("TARGET_DB_URI"):
        return os.environ["TARGET_DB_URI"]
    from app.config import get_settings

    return get_settings().db_uri


def _model_tables() -> list[str]:
    return [
        t.name
        for t in Base.metadata.sorted_tables
        if t.name not in SKIP_TABLES
    ]


def _source_columns(engine: Engine, table: str) -> set[str]:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _target_columns(table: str) -> list[str]:
    sa_table = Base.metadata.tables[table]
    return [c.name for c in sa_table.columns]


def _common_columns(engine: Engine, table: str) -> list[str]:
    src = _source_columns(engine, table)
    if not src:
        return []
    return [c for c in _target_columns(table) if c in src]


def _json_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, memoryview):
        obj = obj.tobytes()
    if isinstance(obj, (bytes, bytearray)):
        return {"__bytes__": True, "data": obj.hex()}
    if isinstance(obj, datetime):
        return {"__datetime__": obj.isoformat()}
    if isinstance(obj, date):
        return {"__date__": obj.isoformat()}
    if isinstance(obj, time):
        return {"__time__": obj.isoformat()}
    raise TypeError(f"Не сериализуется: {type(obj)}")


def _json_object_hook(obj: dict) -> Any:
    if obj.get("__bytes__") is True:
        return bytes.fromhex(obj["data"])
    if set(obj.keys()) == {"__date__"}:
        return date.fromisoformat(obj["__date__"])
    if set(obj.keys()) == {"__datetime__"}:
        return datetime.fromisoformat(obj["__datetime__"])
    if set(obj.keys()) == {"__time__"}:
        return time.fromisoformat(obj["__time__"])
    return obj


def _row_to_dict(columns: list[str], row: tuple) -> dict[str, Any]:
    return dict(zip(columns, row))


def export_snapshot(src_engine: Engine, out_dir: Path) -> dict[str, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": str(src_engine.url).replace(str(src_engine.url.password or ""), "***"),
        "skip_tables": sorted(SKIP_TABLES),
        "tables": {},
    }

    with src_engine.connect() as conn:
        for table in _model_tables():
            cols = _common_columns(src_engine, table)
            if not cols:
                counts[table] = 0
                continue
            col_sql = ", ".join(f'"{c}"' for c in cols)
            rows = conn.execute(text(f'SELECT {col_sql} FROM "{table}"')).fetchall()
            payload = [_row_to_dict(cols, r) for r in rows]
            (out_dir / f"{table}.json").write_text(
                json.dumps(payload, ensure_ascii=False, default=_json_default),
                encoding="utf-8",
            )
            counts[table] = len(payload)
            meta["tables"][table] = {"columns": cols, "rows": len(payload)}

    (out_dir / "_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return counts


def load_snapshot(snapshot_dir: Path) -> dict[str, list[dict[str, Any]]]:
    data: dict[str, list[dict[str, Any]]] = {}
    for path in sorted(snapshot_dir.glob("*.json")):
        if path.name == "_meta.json":
            continue
        table = path.stem
        raw = json.loads(path.read_text(encoding="utf-8"), object_hook=_json_object_hook)
        data[table] = raw
    return data


def _truncate_target(dst_engine: Engine, tables: list[str]) -> None:
    existing = set(inspect(dst_engine).get_table_names())
    to_trunc = [t for t in tables if t in existing]
    if not to_trunc:
        return
    quoted = ", ".join(f'"{t}"' for t in to_trunc)
    with dst_engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))


def _insert_rows(dst_engine: Engine, table: str, columns: list[str], rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    col_sql = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    stmt = text(f'INSERT INTO "{table}" ({col_sql}) VALUES ({placeholders})')

    deferred_parents: dict[Any, Any] = {}
    if table == "auth_user" and "parent_user_id" in columns:
        for r in rows:
            uid = r.get("id")
            deferred_parents[uid] = r.get("parent_user_id")
            r["parent_user_id"] = None

    chunk = 200
    with dst_engine.begin() as conn:
        for i in range(0, len(rows), chunk):
            batch = rows[i : i + chunk]
            conn.execute(stmt, batch)
        if deferred_parents:
            for uid, parent_id in deferred_parents.items():
                if parent_id is not None:
                    conn.execute(
                        text('UPDATE auth_user SET parent_user_id = :p WHERE id = :id'),
                        {"p": parent_id, "id": uid},
                    )
    return len(rows)


def import_to_target(dst_engine: Engine, data: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    tables = _model_tables()
    _truncate_target(dst_engine, tables)
    for table in tables:
        rows = data.get(table, [])
        if not rows:
            counts[table] = 0
            continue
        columns = list(rows[0].keys())
        # только колонки модели
        allowed = set(_target_columns(table))
        columns = [c for c in columns if c in allowed]
        filtered = [{k: r[k] for k in columns if k in r} for r in rows]
        counts[table] = _insert_rows(dst_engine, table, columns, filtered)
    _fix_sequences(dst_engine, tables)
    return counts


def _fix_sequences(dst_engine: Engine, tables: list[str]) -> None:
    with dst_engine.begin() as conn:
        for table in tables:
            sa_table = Base.metadata.tables.get(table)
            if sa_table is None:
                continue
            pk_cols = list(sa_table.primary_key.columns)
            if len(pk_cols) != 1:
                continue
            pk_name = pk_cols[0].name
            conn.execute(
                text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(:tbl, :col),
                        GREATEST(COALESCE((SELECT MAX("{pk_name}") FROM "{table}"), 1), 1),
                        (SELECT EXISTS (SELECT 1 FROM "{table}"))
                    )
                    """
                ),
                {"tbl": table, "col": pk_name},
            )


def copy_direct(src_engine: Engine, dst_engine: Engine) -> dict[str, int]:
    data: dict[str, list[dict[str, Any]]] = {}
    with src_engine.connect() as conn:
        for table in _model_tables():
            cols = _common_columns(src_engine, table)
            if not cols:
                data[table] = []
                continue
            col_sql = ", ".join(f'"{c}"' for c in cols)
            rows = conn.execute(text(f'SELECT {col_sql} FROM "{table}"')).fetchall()
            data[table] = [_row_to_dict(cols, r) for r in rows]
    return import_to_target(dst_engine, data)


def main() -> int:
    parser = argparse.ArgumentParser(description="Снимок smetadoma05_db → smetadoma06_db")
    parser.add_argument(
        "--source",
        default=DEFAULT_SOURCE,
        help="DSN исходной БД (по умолчанию SOURCE_DB_URI или smetadoma05_db)",
    )
    parser.add_argument(
        "--target",
        default=None,
        help="DSN целевой БД (по умолчанию DB_URI из .env)",
    )
    parser.add_argument(
        "--snapshot-dir",
        default=None,
        help="Каталог снимка (по умолчанию snapshots/smetadoma05_db_<timestamp>)",
    )
    parser.add_argument(
        "--snapshot-only",
        action="store_true",
        help="Только экспорт снимка, без загрузки в target",
    )
    parser.add_argument(
        "--from-snapshot",
        metavar="DIR",
        help="Загрузить в target из готового снимка (без чтения source)",
    )
    args = parser.parse_args()

    target_uri = args.target or _load_target_uri()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_dir = Path(
        args.snapshot_dir or _ROOT / "snapshots" / f"smetadoma05_db_{ts}"
    )

    if args.from_snapshot:
        snap = Path(args.from_snapshot)
        if not snap.is_dir():
            print(f"Снимок не найден: {snap}", file=sys.stderr)
            return 1
        dst = create_engine(target_uri, pool_pre_ping=True)
        counts = import_to_target(dst, load_snapshot(snap))
        print(f"Загружено из {snap} → {dst.url.database}")
        for t, n in counts.items():
            if n:
                print(f"  {t}: {n}")
        return 0

    src = create_engine(args.source, pool_pre_ping=True)
    print(f"Источник: {src.url.database}")
    exp_counts = export_snapshot(src, snapshot_dir)
    print(f"Снимок: {snapshot_dir}")
    for t, n in exp_counts.items():
        if n:
            print(f"  {t}: {n}")

    latest = _ROOT / "snapshots" / "smetadoma05_db_latest"
    if latest.exists() and latest.is_symlink():
        latest.unlink()
    elif latest.exists():
        import shutil

        shutil.rmtree(latest)
    try:
        latest.symlink_to(snapshot_dir.name, target_is_directory=True)
    except OSError:
        import shutil

        shutil.copytree(snapshot_dir, latest, dirs_exist_ok=True)

    if args.snapshot_only:
        return 0

    dst = create_engine(target_uri, pool_pre_ping=True)
    print(f"Цель: {dst.url.database}")
    data = load_snapshot(snapshot_dir)
    imp_counts = import_to_target(dst, data)
    for t, n in imp_counts.items():
        if n:
            print(f"  import {t}: {n}")
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
