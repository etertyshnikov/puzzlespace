# -*- coding: utf-8 -*-
"""SLA текущего статуса проекта: остаток времени и просрочка."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _deadline(status_started_at: datetime | None, execution_days: int | None) -> datetime | None:
    if status_started_at is None or execution_days is None or execution_days <= 0:
        return None
    return _as_utc(status_started_at) + timedelta(days=int(execution_days))


def remaining_seconds(
    status_started_at: datetime | None,
    execution_days: int | None,
) -> int | None:
    """Секунд до конца срока статуса; 0 если просрочено; None если срок не задан."""
    end = _deadline(status_started_at, execution_days)
    if end is None:
        return None
    delta = (end - datetime.now(timezone.utc)).total_seconds()
    return max(0, int(delta))


def is_overdue(
    status_started_at: datetime | None,
    execution_days: int | None,
) -> bool:
    """True, если срок исполнения статуса истёк."""
    end = _deadline(status_started_at, execution_days)
    if end is None:
        return False
    return datetime.now(timezone.utc) > end
