#!/usr/bin/env bash
# Добавляет поля action/execution_days и SLA в frontend/src/api/client.ts (для дашборда).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/frontend/src/api/client.ts"

python3 - "$F" << 'PY'
import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

replacements = [
    (
        """export interface ProjectStatus {
  id: number
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}""",
        """export interface ProjectStatus {
  id: number
  name: string
  description?: string | null
  action?: string | null
  execution_days?: number | null
  sort_order: number
  is_active: boolean
}""",
    ),
    (
        """export interface ProjectStatusCreate {
  name: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}""",
        """export interface ProjectStatusCreate {
  name: string
  description?: string | null
  action?: string | null
  execution_days?: number | null
  sort_order?: number
  is_active?: boolean
}""",
    ),
    (
        """  specifications_total_amount?: number | null
}

export interface ProjectCreate {""",
        """  specifications_total_amount?: number | null
  status_execution_days?: number | null
  status_remaining_seconds?: number | null
  status_sla_overdue?: boolean | null
}

export interface ProjectCreate {""",
    ),
]

if "status_sla_overdue" in s and "action?: string | null" in s.split("export interface ProjectStatus")[1].split("export interface ProjectStatusCreate")[0]:
    print("client.ts: типы дашборда уже есть, пропуск.")
    sys.exit(0)

n = 0
for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
        n += 1
    else:
        print("WARN: блок не найден (возможно уже частично обновлён):", old.split(chr(10))[0])

if n == 0:
    print("ERROR: ни один блок не заменён. Проверьте client.ts вручную.")
    sys.exit(1)

p.write_text(s, encoding="utf-8")
print(f"OK: обновлено блоков: {n} -> {p}")
PY
