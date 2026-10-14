#!/usr/bin/env bash
# Сид шаблона «КП Дома кубани Стандарт» (через venv проекта)
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON=""
for candidate in "$ROOT/venv/bin/python" "$ROOT/.venv/bin/python"; do
  if [ -x "$candidate" ]; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "smetadoma05: venv не найден. Создайте:" >&2
  echo "  cd $ROOT && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

"$PYTHON" -m app.migrate_kp_html_templates
"$PYTHON" -m app.seed_kp_dom_kubani_standart
echo "Готово: шаблон «КП Дома кубани Стандарт» в kp_html_templates."
