import type { Project, ProjectStatus } from '../api/client'

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Статусы «Успешно» / «Отказ» — скрываются в таблице проектов по умолчанию. */
export function isTerminalProjectStatusName(name: string | null | undefined): boolean {
  const n = norm(name)
  if (!n) return false
  if (n.includes('успеш') || n === 'успех') return true
  if (n.includes('отказ')) return true
  return false
}

export function isTerminalProjectStatus(
  project: Project,
  statusById: Map<number, ProjectStatus>,
): boolean {
  if (project.status_id == null) return false
  const st = statusById.get(project.status_id)
  return isTerminalProjectStatusName(st?.name)
}

export function isTerminalProjectStatusId(
  statusId: number,
  statusById: Map<number, ProjectStatus>,
): boolean {
  return isTerminalProjectStatusName(statusById.get(statusId)?.name)
}

function statusForProject(
  project: Project,
  statusById: Map<number, ProjectStatus>,
): { action: string; name: string } | null {
  if (project.status_id == null) return null
  const st = statusById.get(project.status_id)
  if (!st) return null
  const actionRaw = st.action
  return { action: norm(actionRaw), name: norm(st.name) }
}

/** Текст для колонки «Действие»: action из настроек или подпись как у плашек фильтра. */
export function resolveStatusActionDisplay(st: ProjectStatus | undefined | null): string {
  if (!st) return '—'
  const trimmed = st.action?.trim()
  if (trimmed) return trimmed
  const name = norm(st.name)
  if (/кп\s*отправлен/.test(name)) return 'Позвонить'
  if (/отправ/.test(name) && /кп/.test(name)) return 'Отправить КП'
  if (/состав/.test(name) && /договор/.test(name)) return 'Составить договор'
  return '—'
}

/** Плашка 1: статус «КП отправлено» или действие «позвонить». */
export function isCallAfterKpSent(project: Project, statusById: Map<number, ProjectStatus>): boolean {
  const s = statusForProject(project, statusById)
  if (!s) return false
  if (/позвон/.test(s.action)) return true
  return /кп\s*отправлен/.test(s.name)
}

/** Плашка 2: действие «отправить КП». */
export function isSendKpAction(project: Project, statusById: Map<number, ProjectStatus>): boolean {
  const s = statusForProject(project, statusById)
  if (!s) return false
  if (/отправ/.test(s.action) && /кп/.test(s.action)) return true
  return /отправ/.test(s.name) && /кп/.test(s.name) && !/кп\s*отправлен/.test(s.name)
}

/** Плашка 3: действие «Составить договор». */
export function isPrepareContractAction(project: Project, statusById: Map<number, ProjectStatus>): boolean {
  const s = statusForProject(project, statusById)
  if (!s) return false
  if (/составить/.test(s.action) && /договор/.test(s.action)) return true
  return /состав/.test(s.name) && /договор/.test(s.name)
}

/** Просрочено: поле «Осталось» (status_sla_overdue с бэкенда). */
export function isProjectOverdue(project: Project): boolean {
  return project.status_sla_overdue === true
}

export type DashboardActionTileId = 'call' | 'send_kp' | 'contract' | 'reset' | 'overdue'

export type DashboardActionTileFilter = 'call' | 'send_kp' | 'contract' | 'overdue'

export const DASHBOARD_ACTION_TILES: {
  id: DashboardActionTileId
  title: string
  subtitle: string
  interactive: boolean
}[] = [
  { id: 'call', title: 'Позвонить', subtitle: 'КП отправлено', interactive: true },
  { id: 'send_kp', title: 'Отправить КП', subtitle: 'Составление спецификации', interactive: true },
  { id: 'contract', title: 'Составить договор', subtitle: 'Прогрев - договор', interactive: true },
  { id: 'reset', title: 'Сбросить фильтр', subtitle: 'Все проекты', interactive: true },
  { id: 'overdue', title: 'Просрочено', subtitle: 'По полю «Осталось»', interactive: true },
]

export function projectMatchesDashboardFilter(
  project: Project,
  statusById: Map<number, ProjectStatus>,
  filter: DashboardActionTileFilter,
): boolean {
  if (filter === 'overdue') return isProjectOverdue(project)
  switch (filter) {
    case 'call':
      return isCallAfterKpSent(project, statusById)
    case 'send_kp':
      return isSendKpAction(project, statusById)
    case 'contract':
      return isPrepareContractAction(project, statusById)
    default:
      return false
  }
}

export function countProjectsForActionTile(
  projects: Project[],
  statusById: Map<number, ProjectStatus>,
  tileId: DashboardActionTileId,
): number {
  if (tileId === 'reset') return projects.length
  if (tileId === 'overdue') return projects.filter((p) => isProjectOverdue(p)).length
  return projects.filter((p) => projectMatchesDashboardFilter(p, statusById, tileId)).length
}
