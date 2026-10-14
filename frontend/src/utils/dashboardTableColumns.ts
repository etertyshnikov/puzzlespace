export type DashboardColumnId =
  | 'action'
  | 'name'
  | 'customer'
  | 'customerPhone'
  | 'createdBy'
  | 'address'
  | 'statusDate'
  | 'executionDays'
  | 'remaining'
  | 'amount'
  | 'statusSelect'

export type DashboardColumnFilterKey =
  | 'action'
  | 'name'
  | 'customer'
  | 'customerPhone'
  | 'createdBy'
  | 'address'
  | 'statusDate'
  | 'executionDays'
  | 'remaining'
  | 'amount'

export interface DashboardTableColumnDef {
  id: DashboardColumnId
  label: string
  minWidth?: number
  width?: number
  filterKey?: DashboardColumnFilterKey
}

export const DASHBOARD_TABLE_COLUMNS: DashboardTableColumnDef[] = [
  { id: 'action', label: 'Действие', minWidth: 160, filterKey: 'action' },
  { id: 'name', label: 'Название', width: 180, filterKey: 'name' },
  { id: 'customer', label: 'Клиент', width: 140, filterKey: 'customer' },
  { id: 'customerPhone', label: 'Телефон', width: 120, filterKey: 'customerPhone' },
  { id: 'createdBy', label: 'Кто создал', width: 140, filterKey: 'createdBy' },
  { id: 'address', label: 'Адрес', minWidth: 200, filterKey: 'address' },
  { id: 'statusDate', label: 'Дата статуса', width: 110, filterKey: 'statusDate' },
  { id: 'executionDays', label: 'Время исполнения', width: 120, filterKey: 'executionDays' },
  { id: 'remaining', label: 'Осталось', width: 100, filterKey: 'remaining' },
  { id: 'amount', label: 'Сумма проекта', width: 100, filterKey: 'amount' },
  { id: 'statusSelect', label: 'Выбор статуса', width: 160 },
]

export const DEFAULT_DASHBOARD_COLUMN_ORDER: DashboardColumnId[] = DASHBOARD_TABLE_COLUMNS.map((c) => c.id)

export interface DashboardColumnsPreference {
  order: string[]
  hidden: string[]
}

export function defaultDashboardColumnsPreference(): DashboardColumnsPreference {
  return { order: [...DEFAULT_DASHBOARD_COLUMN_ORDER], hidden: [] }
}

const COLUMN_BY_ID = new Map(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, c]))

export function columnDefById(id: DashboardColumnId): DashboardTableColumnDef | undefined {
  return COLUMN_BY_ID.get(id)
}

/** Видимые столбцы в порядке пользователя. */
export function resolveVisibleDashboardColumns(pref: DashboardColumnsPreference): DashboardTableColumnDef[] {
  const hidden = new Set(
    (pref.hidden ?? []).filter((id): id is DashboardColumnId =>
      DEFAULT_DASHBOARD_COLUMN_ORDER.includes(id as DashboardColumnId),
    ),
  )
  const order: DashboardColumnId[] = []
  for (const raw of pref.order ?? []) {
    const id = raw as DashboardColumnId
    if (DEFAULT_DASHBOARD_COLUMN_ORDER.includes(id) && !order.includes(id)) {
      order.push(id)
    }
  }
  for (const id of DEFAULT_DASHBOARD_COLUMN_ORDER) {
    if (!order.includes(id)) {
      order.push(id)
    }
  }
  const out: DashboardTableColumnDef[] = []
  for (const id of order) {
    if (hidden.has(id)) {
      continue
    }
    const def = columnDefById(id)
    if (def) {
      out.push(def)
    }
  }
  return out.length > 0 ? out : [...DASHBOARD_TABLE_COLUMNS]
}

export function normalizeDashboardColumnsPreference(
  raw: DashboardColumnsPreference | null | undefined,
): DashboardColumnsPreference {
  const base = defaultDashboardColumnsPreference()
  if (!raw) {
    return base
  }
  const order: DashboardColumnId[] = []
  for (const id of raw.order ?? []) {
    const cid = id as DashboardColumnId
    if (DEFAULT_DASHBOARD_COLUMN_ORDER.includes(cid) && !order.includes(cid)) {
      order.push(cid)
    }
  }
  for (const id of DEFAULT_DASHBOARD_COLUMN_ORDER) {
    if (!order.includes(id)) {
      order.push(id)
    }
  }
  if (order.includes('customer') && !order.includes('customerPhone')) {
    const i = order.indexOf('customer')
    order.splice(i + 1, 0, 'customerPhone')
  }
  if (order.includes('customerPhone') && !order.includes('createdBy')) {
    const i = order.indexOf('customerPhone')
    order.splice(i + 1, 0, 'createdBy')
  }
  const hidden = (raw.hidden ?? []).filter((id): id is DashboardColumnId =>
    DEFAULT_DASHBOARD_COLUMN_ORDER.includes(id as DashboardColumnId),
  )
  return { order, hidden }
}
