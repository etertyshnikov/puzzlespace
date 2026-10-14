#!/usr/bin/env bash
# Общие пути venv. Использование: source scripts/_venv.sh
set -euo pipefail
_VENV_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -x "$_VENV_ROOT/venv/bin/python" ]]; then
  PY="$_VENV_ROOT/venv/bin/python"
  ALEMBIC="$_VENV_ROOT/venv/bin/alembic"
elif [[ -x "$_VENV_ROOT/.venv/bin/python" ]]; then
  PY="$_VENV_ROOT/.venv/bin/python"
  ALEMBIC="$_VENV_ROOT/.venv/bin/alembic"
else
  echo "venv не найден: $_VENV_ROOT/venv или .venv" >&2
  return 1 2>/dev/null || exit 1
fi

if [[ ! -x "$ALEMBIC" ]]; then
  echo "alembic не установлен. Выполните: $PY -m pip install alembic" >&2
  return 1 2>/dev/null || exit 1
fi

cd "$_VENV_ROOT"
