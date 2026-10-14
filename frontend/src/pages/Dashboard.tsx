import React, { useEffect, useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type ProjectStatus, type Project, type Customer, type TeamMemberOut } from '../api/client'
import { DashboardColumnsSettings } from '../components/DashboardColumnsSettings'
import { StatusCellWithModal } from '../components/StatusCellWithModal'
import {
  defaultDashboardColumnsPreference,
  normalizeDashboardColumnsPreference,
  resolveVisibleDashboardColumns,
  type DashboardColumnId,
  type DashboardColumnsPreference,
  type DashboardTableColumnDef,
} from '../utils/dashboardTableColumns'
import {
  getProjectStatusBadgeStyle,
  getProjectStatusRowStyle,
  getProjectStatusSolidColor,
} from '../utils/projectStatusColors'
import { formatExecutionDays, formatRemainingSeconds } from '../utils/projectStatusSla'
import {
  countProjectsForActionTile,
  DASHBOARD_ACTION_TILES,
  isTerminalProjectStatus,
  isTerminalProjectStatusId,
  projectMatchesDashboardFilter,
  resolveStatusActionDisplay,
  type DashboardActionTileFilter,
  type DashboardActionTileId,
} from '../utils/dashboardActionTiles'
import { useAuth } from '../auth/AuthContext'
import { TeamActivityPanel } from '../components/TeamActivityPanel'
import { isAdminUser, isDirectorUser, isTeamLeadUser } from '../utils/userRoles'

/** Сумма в бейджах статусов и в таблице: рубли / 1000, 2 знака, «К», без ₽ (например 144,32К). */
function formatDashboardSumBadgeK(amountRub: number): string {
  if (amountRub <= 0) return '—'
  const k = amountRub / 1000
  return `${k.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}К`
}

/** Сумма для дашборда: max(сумма по спецификациям, total_amount проекта). */
function projectDashboardAmount(p: Project): number {
  const fromSpecs = Number(p.specifications_total_amount) || 0
  const fromProject = Number(p.total_amount) || 0
  return Math.max(fromSpecs, fromProject)
}

const EMPTY_COLUMN_FILTERS = {
  action: '',
  name: '',
  customer: '',
  customerPhone: '',
  createdBy: '',
  address: '',
  statusDate: '',
  executionDays: '',
  remaining: '',
  amount: '',
} as const

type DashboardColumnFilters = { [K in keyof typeof EMPTY_COLUMN_FILTERS]: string }

function matchColumnText(haystack: string, needle: string): boolean {
  const q = needle.trim().toLowerCase()
  if (!q) return true
  return haystack.toLowerCase().includes(q)
}

function projectCustomer(p: Project, customers: Customer[]): Customer | undefined {
  if (p.customer_id == null) return undefined
  return customers.find((x) => x.id === p.customer_id)
}

function projectCustomerLabel(p: Project, customers: Customer[]): string {
  const c = projectCustomer(p, customers)
  return ((c?.full_name || c?.name) ?? '').trim()
}

function projectCustomerPhone(p: Project, customers: Customer[]): string {
  return (projectCustomer(p, customers)?.phone ?? '').trim()
}

function projectCustomerAddress(p: Project, customers: Customer[]): string {
  return (projectCustomer(p, customers)?.address ?? '').trim()
}

/** Дата перехода в текущий статус (projects.status_started_at). */
function teamMemberLabel(m: TeamMemberOut): string {
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
  return name || m.nic
}

function projectCreatedByLabel(p: Project): string {
  return (p.created_by_name ?? '').trim()
}

type CreatedByFilterOption = {
  value: string
  label: string
  /** Директор: ветка L1 + его L2; иначе — точное совпадение создателя. */
  mode: 'l1_branch' | 'exact'
}

/** Проект создан выбранным L1 или его подчинённым (L2). */
function projectMatchesL1CreatorFilter(
  p: Project,
  l1UserId: number,
  members: TeamMemberOut[],
): boolean {
  const creatorId = p.created_by_user_id
  if (!creatorId) return false
  if (creatorId === l1UserId) return true
  let cur = members.find((m) => m.id === creatorId)
  while (cur) {
    if (cur.id === l1UserId) return true
    if (cur.parent_user_id == null) return false
    cur = members.find((m) => m.id === cur!.parent_user_id)
  }
  return false
}

function projectMatchesCreatedByFilter(
  p: Project,
  filterValue: string,
  option: CreatedByFilterOption | undefined,
  members: TeamMemberOut[],
): boolean {
  const creatorId = p.created_by_user_id
  if (!creatorId) return false
  const id = Number(filterValue)
  if (!Number.isFinite(id) || id <= 0) return false
  if (option?.mode === 'l1_branch') {
    return projectMatchesL1CreatorFilter(p, id, members)
  }
  return creatorId === id
}

function formatProjectStatusDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminUser(user)
  const isDirector = isDirectorUser(user)
  const showTeamActivity = isDirector || isTeamLeadUser(user)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'team-activity'>('dashboard')
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null)
  const [statusesLoading, setStatusesLoading] = useState(true)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<DashboardColumnFilters>({ ...EMPTY_COLUMN_FILTERS })
  const [actionTileFilter, setActionTileFilter] = useState<DashboardActionTileFilter | null>(null)
  const [showTerminalStatuses, setShowTerminalStatuses] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [columnsPref, setColumnsPref] = useState<DashboardColumnsPreference>(
    defaultDashboardColumnsPreference(),
  )
  const [columnsSettingsOpen, setColumnsSettingsOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMemberOut[]>([])

  useEffect(() => {
    api.team
      .members()
      .then(setTeamMembers)
      .catch(() => setTeamMembers([]))
  }, [])

  const createdByFilterOptions = useMemo((): CreatedByFilterOption[] => {
    if (isDirector) {
      const l1s = teamMembers
        .filter((m) => m.hierarchy_level === 1)
        .sort((a, b) => teamMemberLabel(a).localeCompare(teamMemberLabel(b), 'ru'))
      if (l1s.length > 0) {
        return l1s.map((m) => ({
          value: String(m.id),
          label: teamMemberLabel(m),
          mode: 'l1_branch' as const,
        }))
      }
    }
    if (user?.hierarchy_level === 1 && user.id) {
      const branch = teamMembers
        .filter((m) => m.id === user.id || m.parent_user_id === user.id)
        .sort((a, b) => teamMemberLabel(a).localeCompare(teamMemberLabel(b), 'ru'))
      if (branch.length > 0) {
        return branch.map((m) => ({
          value: String(m.id),
          label: teamMemberLabel(m),
          mode: 'exact' as const,
        }))
      }
    }
    const byId = new Map<number, string>()
    for (const p of projects) {
      if (p.created_by_user_id != null && p.created_by_name) {
        byId.set(p.created_by_user_id, p.created_by_name.trim())
      }
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
      .map(([id, label]) => ({
        value: String(id),
        label,
        mode: 'exact' as const,
      }))
  }, [isDirector, teamMembers, user?.hierarchy_level, user?.id, projects])

  useEffect(() => {
    api.auth
      .getDashboardColumns()
      .then((pref) => setColumnsPref(normalizeDashboardColumnsPreference(pref)))
      .catch(() => setColumnsPref(defaultDashboardColumnsPreference()))
  }, [])

  const visibleColumns = useMemo(
    () => resolveVisibleDashboardColumns(columnsPref),
    [columnsPref],
  )

  useEffect(() => {
    api.projectStatuses
      .list()
      .then(setStatuses)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setStatusesLoading(false))
  }, [])

  useEffect(() => {
    setProjectsLoading(true)
    setProjectsError(null)
    api.projects
      .list({ limit: 500 })
      .then((rows) => {
        setProjects(rows)
        setProjectsError(null)
      })
      .catch((e) => {
        setProjects([])
        setProjectsError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setProjectsLoading(false))
  }, [])

  useEffect(() => {
    api.customers
      .list({ limit: 2000 })
      .then(setCustomers)
      .catch(() => setCustomers([]))
  }, [])

  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => {
      const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
      if (orderDiff !== 0) return orderDiff
      return a.id - b.id
    })
  }, [statuses])

  const statusById = useMemo(() => {
    const m = new Map<number, ProjectStatus>()
    sortedStatuses.forEach((s) => m.set(s.id, s))
    return m
  }, [sortedStatuses])

  const projectActionLabel = (p: Project) => {
    const fromApi = p.status_action?.trim()
    if (fromApi) return fromApi
    if (p.status_id == null) return '—'
    return resolveStatusActionDisplay(statusById.get(p.status_id))
  }

  const hasColumnFilters = useMemo(
    () => Object.values(columnFilters).some((v) => v.trim() !== ''),
    [columnFilters],
  )

  const updateColumnFilter = (key: keyof DashboardColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
  }

  const displayedProjects = useMemo(() => {
    let filtered = projects
    if (actionTileFilter != null) {
      filtered = filtered.filter((p) => projectMatchesDashboardFilter(p, statusById, actionTileFilter))
    } else if (selectedStatusId != null) {
      filtered = filtered.filter((p) => p.status_id === selectedStatusId)
    }

    const viewingTerminalStatus =
      selectedStatusId != null && isTerminalProjectStatusId(selectedStatusId, statusById)
    if (!showTerminalStatuses && !viewingTerminalStatus) {
      filtered = filtered.filter((p) => !isTerminalProjectStatus(p, statusById))
    }

    const cf = columnFilters

    return filtered.filter((p) => {
      if (!matchColumnText(projectActionLabel(p), cf.action)) return false
      if (!matchColumnText(p.name ?? '', cf.name)) return false
      if (!matchColumnText(projectCustomerLabel(p, customers), cf.customer)) return false
      if (!matchColumnText(projectCustomerPhone(p, customers), cf.customerPhone)) return false

      if (cf.createdBy) {
        const opt = createdByFilterOptions.find((o) => o.value === cf.createdBy)
        if (!projectMatchesCreatedByFilter(p, cf.createdBy, opt, teamMembers)) return false
      }

      if (!matchColumnText(projectCustomerAddress(p, customers), cf.address)) return false
      if (!matchColumnText(formatProjectStatusDate(p.status_started_at), cf.statusDate)) return false
      if (!matchColumnText(formatExecutionDays(p.status_execution_days), cf.executionDays)) return false

      const remStr = formatRemainingSeconds(
        p.status_remaining_seconds,
        p.status_execution_days,
        p.status_sla_overdue,
      )
      if (!matchColumnText(remStr, cf.remaining)) return false

      const amountStr = formatDashboardSumBadgeK(projectDashboardAmount(p))
      if (!matchColumnText(amountStr, cf.amount)) return false

      return true
    })
  }, [
    projects,
    selectedStatusId,
    actionTileFilter,
    showTerminalStatuses,
    columnFilters,
    statusById,
    customers,
    createdByFilterOptions,
    teamMembers,
  ])

  const resetDashboardFilters = () => {
    setActionTileFilter(null)
    setSelectedStatusId(null)
    setColumnFilters({ ...EMPTY_COLUMN_FILTERS })
  }

  const handleActionTileClick = (tileId: DashboardActionTileId) => {
    if (tileId === 'reset') {
      resetDashboardFilters()
      return
    }
    setSelectedStatusId(null)
    setActionTileFilter((prev) => (prev === tileId ? null : tileId))
  }

  const hasDashboardFilter = actionTileFilter != null || selectedStatusId != null || hasColumnFilters

  const selectStatusFilter = (statusId: number | null) => {
    setActionTileFilter(null)
    setSelectedStatusId(statusId)
  }

  /** «Все» — без проектов в терминальных статусах (Успешно / Отказ). */
  const projectsForAllStatusCard = useMemo(
    () => projects.filter((p) => !isTerminalProjectStatus(p, statusById)),
    [projects, statusById],
  )
  const totalCount = projectsForAllStatusCard.length
  const totalSum = projectsForAllStatusCard.reduce((a, p) => a + projectDashboardAmount(p), 0)
  const getCountByStatus = (statusId: number) =>
    projects.filter((p) => p.status_id === statusId).length
  const getSumByStatus = (statusId: number) =>
    projects.filter((p) => p.status_id === statusId).reduce((a, p) => a + projectDashboardAmount(p), 0)

  const actionTileCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tile of DASHBOARD_ACTION_TILES) {
      counts[tile.id] = countProjectsForActionTile(projects, statusById, tile.id)
    }
    return counts
  }, [projects, statusById])

  const changeProjectStatus = (projectId: number, statusId: number | null) => {
    setUpdatingStatusId(projectId)
    api.projects
      .update(projectId, { status_id: statusId ?? undefined })
      .then((updated) => {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updated } : p)))
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingStatusId(null))
  }

  const columnThStyle = (col: DashboardTableColumnDef): CSSProperties | undefined => {
    if (col.minWidth != null) {
      return { minWidth: col.minWidth }
    }
    if (col.width != null) {
      return { width: col.width }
    }
    return undefined
  }

  const renderProjectCell = (p: Project, columnId: DashboardColumnId) => {
      switch (columnId) {
        case 'action':
          return (
            <td
              style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectActionLabel(p)}
            >
              {projectActionLabel(p)}
            </td>
          )
        case 'name':
          return <td>{p.name || '—'}</td>
        case 'customer':
          return (
            <td onClick={(e) => e.stopPropagation()}>
              {p.customer_id != null ? (
                <Link
                  to={`/customers/${p.customer_id}/edit`}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {projectCustomerLabel(p, customers) || '—'}
                </Link>
              ) : (
                '—'
              )}
            </td>
          )
        case 'createdBy':
          return (
            <td
              style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectCreatedByLabel(p) || undefined}
            >
              {projectCreatedByLabel(p) || '—'}
            </td>
          )
        case 'customerPhone': {
          const phone = projectCustomerPhone(p, customers)
          const tel = phone.replace(/\D/g, '')
          const href = tel ? (tel.startsWith('7') ? `tel:+${tel}` : `tel:${tel}`) : undefined
          return (
            <td
              onClick={(e) => e.stopPropagation()}
              style={{ whiteSpace: 'nowrap' }}
              title={phone || undefined}
            >
              {phone && href ? (
                <a href={href} style={{ color: 'inherit', textDecoration: 'underline' }}>
                  {phone}
                </a>
              ) : (
                '—'
              )}
            </td>
          )
        }
        case 'address':
          return (
            <td
              style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectCustomerAddress(p, customers) || undefined}
            >
              {projectCustomerAddress(p, customers) || '—'}
            </td>
          )
        case 'statusDate':
          return (
            <td
              style={{ whiteSpace: 'nowrap' }}
              title={
                p.status_started_at ? new Date(p.status_started_at).toLocaleString('ru-RU') : undefined
              }
            >
              {formatProjectStatusDate(p.status_started_at)}
            </td>
          )
        case 'executionDays':
          return (
            <td style={{ whiteSpace: 'nowrap' }}>{formatExecutionDays(p.status_execution_days)}</td>
          )
        case 'remaining':
          return (
            <td
              style={
                p.status_sla_overdue ? { color: '#E74C3C', fontWeight: 600 } : undefined
              }
            >
              {formatRemainingSeconds(
                p.status_remaining_seconds,
                p.status_execution_days,
                p.status_sla_overdue,
              )}
            </td>
          )
        case 'amount':
          return <td>{formatDashboardSumBadgeK(projectDashboardAmount(p))}</td>
        case 'statusSelect':
          return (
            <td onClick={(e) => e.stopPropagation()}>
              <StatusCellWithModal
                value={p.status_id ?? null}
                statuses={sortedStatuses}
                onChange={(statusId) => changeProjectStatus(p.id, statusId)}
                disabled={updatingStatusId === p.id}
                getBadgeStyle={getProjectStatusBadgeStyle}
                iconOnly
              />
            </td>
          )
        default:
          return <td>—</td>
      }
  }

  if (error) {
    return (
      <div>
        <div className="x_panel">
          <div className="x_content">
            <p style={{ color: '#E74C3C' }}>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page-layout">
      {isAdminUser(user) && (
        <p style={{ marginTop: 0 }}>
          <Link to="/moderation" className="btn btn-primary">Объявления на модерации</Link>
        </p>
      )}
      {showTeamActivity && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'dashboard' ? 'btn-default' : 'btn-primary'}`}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            onClick={() => setActiveTab('dashboard')}
          >
            Дашборд
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'team-activity' ? 'btn-default' : 'btn-primary'}`}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
            onClick={() => setActiveTab('team-activity')}
          >
            Активность команды
          </button>
        </div>
      )}

      {activeTab === 'team-activity' && showTeamActivity ? (
        <TeamActivityPanel />
      ) : (
        <>
      {projectsError && (
        <div className="x_panel" style={{ borderColor: '#E74C3C' }}>
          <div className="x_content">
            <p style={{ color: '#E74C3C', margin: 0 }}>
              Не удалось загрузить проекты: {projectsError}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#73879C' }}>
              Проверьте в терминале:{' '}
              <code>curl -H &quot;Authorization: Bearer …&quot; http://127.0.0.1:8008/api/projects?limit=5</code>
              {' '}и выполните{' '}
              <code>python -m app.migrations.apply</code>
            </p>
          </div>
        </div>
      )}
      {!projectsLoading && !projectsError && projects.length === 0 && (
        <div className="x_panel">
          <div className="x_content">
            <p style={{ margin: 0, color: '#73879C' }}>
              {isAdmin
                ? 'В базе нет проектов или они не попали в выборку.'
                : user?.hierarchy_level === 1 || user?.role_name === 'manager'
                  ? 'Нет проектов по вашей команде. Менеджер видит проекты своих агентов и свои.'
                  : 'Нет проектов. Агент видит только свои проекты.'}
            </p>
          </div>
        </div>
      )}
      <div className="x_panel dashboard-card-panel dashboard-action-summary">
        <div className="x_content" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
            }}
          >
          <div className="dashboard-action-tiles" style={{ flex: '1 1 auto' }}>
            {DASHBOARD_ACTION_TILES.map((tile) => {
              const isReset = tile.id === 'reset'
              const isActive = isReset
                ? !hasDashboardFilter
                : actionTileFilter === tile.id
              return (
                <div
                  key={tile.id}
                  role="button"
                  tabIndex={0}
                  className={`dashboard-action-tile dashboard-action-tile--${tile.id}${isActive ? ' dashboard-action-tile--active' : ''}`}
                  title={isReset ? 'Показать все проекты' : isActive ? 'Сбросить фильтр' : `Показать проекты: ${tile.title}`}
                  onClick={() => handleActionTileClick(tile.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleActionTileClick(tile.id)
                    }
                  }}
                >
                  <div className="dashboard-action-tile__value">
                    {projectsLoading || statusesLoading ? '…' : actionTileCounts[tile.id]}
                  </div>
                  <div className="dashboard-action-tile__title">{tile.title}</div>
                  <div className="dashboard-action-tile__subtitle">{tile.subtitle}</div>
                </div>
              )
            })}
          </div>
          <Link
            to="/customers/new"
            className="btn btn-success"
            style={{ flexShrink: 0, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            Добавить клиента
          </Link>
          </div>
        </div>
      </div>

      <div className="row dashboard-page-row">
        <div className="dashboard-statuses-col">
          <div className="x_panel dashboard-card-panel">
            <div className="x_title" style={{ borderBottom: 'none' }}>
              <h2 style={{ margin: 0 }}>Статусы проектов</h2>
            </div>
            <div className="x_content">
              {statusesLoading ? (
                <p style={{ margin: 0 }}>Загрузка…</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectStatusFilter(null)}
                    onKeyDown={(e) => e.key === 'Enter' && selectStatusFilter(null)}
                    className={`list-item dashboard-status-card ${selectedStatusId === null && actionTileFilter === null ? 'active' : ''}`}
                    data-status-name="Все"
                    title="Показать все проекты, кроме «Успешно» и «Отказ»"
                    style={{
                      borderLeftColor: selectedStatusId === null ? '#1ABB9C' : undefined,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Все</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#5A738E', color: '#fff' }}>{totalCount}</span>
                      <span className="badge" style={{ background: '#5A738E', color: '#fff' }}>
                        {formatDashboardSumBadgeK(totalSum)}
                      </span>
                    </span>
                  </div>
                  {sortedStatuses.map((s) => {
                    const count = getCountByStatus(s.id)
                    const sum = getSumByStatus(s.id)
                    const badgeStyle = getProjectStatusBadgeStyle(s.id)
                    const borderColor = getProjectStatusSolidColor(s.id)
                    const isSelected = selectedStatusId === s.id
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectStatusFilter(s.id)}
                        onKeyDown={(e) => e.key === 'Enter' && selectStatusFilter(s.id)}
                        className={`list-item dashboard-status-card ${isSelected && actionTileFilter === null ? 'active' : ''}`}
                        data-status-name={s.name}
                        title={`Показать проекты со статусом «${s.name}»`}
                        style={{
                          borderLeftColor: borderColor,
                          background: isSelected ? badgeStyle.background : undefined,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className="badge" style={badgeStyle}>{count}</span>
                          <span className="badge" style={badgeStyle}>
                            {formatDashboardSumBadgeK(sum)}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-projects-col">
          <div className="x_panel dashboard-card-panel">
            <div className="x_title" style={{ borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Проекты</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => setColumnsSettingsOpen(true)}
                >
                  Столбцы…
                </button>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => setShowTerminalStatuses((v) => !v)}
                >
                  {showTerminalStatuses
                    ? 'Скрыть успешные и отказ'
                    : 'Показать успешные и отказ'}
                </button>
                {hasColumnFilters && (
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={() => setColumnFilters({ ...EMPTY_COLUMN_FILTERS })}
                  >
                    Сбросить фильтры таблицы
                  </button>
                )}
              </div>
            </div>
            <div className="x_content">
              <div className="dashboard-projects-table-wrap">
                {projectsLoading ? (
                  <p style={{ margin: 0 }}>Загрузка…</p>
                ) : (
                  <table className="table table-striped dashboard-projects-table">
                    <thead>
                      <tr>
                        {visibleColumns.map((col) => (
                          <th key={col.id} style={columnThStyle(col)}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="dashboard-table-filters">
                        {visibleColumns.map((col) => (
                          <th key={`filter-${col.id}`}>
                            {col.filterKey === 'createdBy' ? (
                              <select
                                className="form-control"
                                value={columnFilters.createdBy}
                                onChange={(e) => updateColumnFilter('createdBy', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">
                                  {isDirector ? 'Все менеджеры' : 'Все сотрудники'}
                                </option>
                                {createdByFilterOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : col.filterKey ? (
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Поиск…"
                                value={columnFilters[col.filterKey]}
                                onChange={(e) => updateColumnFilter(col.filterKey!, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProjects.length === 0 ? (
                        <tr>
                          <td colSpan={visibleColumns.length || 1} style={{ textAlign: 'center', padding: 24 }}>
                            {hasDashboardFilter
                              ? 'Нет проектов по выбранному фильтру'
                              : !showTerminalStatuses
                                ? 'Нет проектов (успешные и отказ скрыты — нажмите «Показать успешные и отказ»)'
                                : 'Нет проектов'}
                          </td>
                        </tr>
                      ) : (
                        displayedProjects.map((p) => {
                          const rowStyle = getProjectStatusRowStyle(p.status_id)
                          return (
                          <tr
                            key={p.id}
                            className="dashboard-project-row"
                            style={{
                              cursor: 'pointer',
                              ...(rowStyle ?? {}),
                            }}
                            onClick={() => navigate(`/projects/${p.id}/specifications`)}
                          >
                            {visibleColumns.map((col) => (
                              <React.Fragment key={`${p.id}-${col.id}`}>
                                {renderProjectCell(p, col.id)}
                              </React.Fragment>
                            ))}
                          </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DashboardColumnsSettings
        open={columnsSettingsOpen}
        onClose={() => setColumnsSettingsOpen(false)}
        onSaved={(pref) => setColumnsPref(pref)}
      />
        </>
      )}
    </div>
  )
}
