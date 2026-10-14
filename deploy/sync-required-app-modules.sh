#!/usr/bin/env bash
# Проверка модулей, без которых smetadoma05 не стартует
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REQUIRED=(
  app/ensure_project_contract_data_schema.py
  app/migrations/apply.py
  app/migrations/ddl_postgresql.py
  app/services/project_status_sla.py
  app/services/project_status_display.py
  app/services/html_to_pdf.py
  app/schemas/contract_document_pdf.py
  app/services/contract_document_pdf.py
  app/services/project_contract_documents.py
  app/services/contract_placeholders.py
)

missing=0
for f in "${REQUIRED[@]}"; do
  if [ -f "$f" ]; then
    echo "OK  $f"
  else
    echo "MISSING  $f"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  echo "Некоторые файлы отсутствуют. Скопируйте из git или пересохраните из Cursor." >&2
  exit 1
fi

PYTHON="${ROOT}/venv/bin/python"
"$PYTHON" -c "from app.main import app; print('import app.main: OK')"
