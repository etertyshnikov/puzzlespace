import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api, type InviteOut, type TeamMemberOut, type TeamLimits } from '../api/client'
import { RegistrationLinkPanel } from '../components/RegistrationLinkPanel'
import { isAdminManagerUser, isDirectorUser, isTeamLeadUser } from '../utils/userRoles'

function levelLabel(level: number, roleName?: string | null): string {
  if (level === 0) return 'Директор'
  if (roleName === 'admin_manager') return 'Админ/менеджер'
  if (level === 1) return 'Менеджер'
  if (level === 2) return 'Агент'
  return `Уровень ${level}`
}

function memberName(m: Pick<TeamMemberOut, 'first_name' | 'last_name' | 'nic'>): string {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.nic
}

function buildChildrenMap(
  members: TeamMemberOut[],
  isManager: boolean,
  managerId: number | undefined,
): Map<number, TeamMemberOut[]> {
  const memberIds = new Set(members.map((m) => m.id))
  const map = new Map<number, TeamMemberOut[]>()
  for (const m of members) {
    let parentId: number | null = null
    if (m.parent_user_id != null && memberIds.has(m.parent_user_id)) {
      parentId = m.parent_user_id
    } else if (isManager && managerId != null) {
      parentId = managerId
    }
    if (parentId == null) continue
    const list = map.get(parentId) ?? []
    list.push(m)
    map.set(parentId, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => memberName(a).localeCompare(memberName(b), 'ru'))
  }
  return map
}

function buildRootMembers(members: TeamMemberOut[], childrenByParent: Map<number, TeamMemberOut[]>): TeamMemberOut[] {
  const childIds = new Set<number>()
  for (const list of childrenByParent.values()) {
    for (const m of list) childIds.add(m.id)
  }
  return members
    .filter((m) => !childIds.has(m.id))
    .sort((a, b) => {
      const levelDiff = a.hierarchy_level - b.hierarchy_level
      if (levelDiff !== 0) return levelDiff
      return memberName(a).localeCompare(memberName(b), 'ru')
    })
}

type TeamTreeRowsProps = {
  member: TeamMemberOut
  depth: number
  childrenByParent: Map<number, TeamMemberOut[]>
  expandedIds: Set<number>
  onToggle: (id: number) => void
}

function TeamTreeRows({ member, depth, childrenByParent, expandedIds, onToggle }: TeamTreeRowsProps) {
  const children = childrenByParent.get(member.id) ?? []
  const hasChildren = children.length > 0
  const expanded = expandedIds.has(member.id)

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 18 }}>
            {hasChildren ? (
              <button
                type="button"
                className="btn btn-default btn-xs"
                style={{ minWidth: 24, padding: '0 4px', lineHeight: 1.4 }}
                onClick={() => onToggle(member.id)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Свернуть' : 'Развернуть'}
              >
                {expanded ? '▼' : '▶'}
              </button>
            ) : (
              <span style={{ display: 'inline-block', width: 24 }} />
            )}
            <span>{member.nic}</span>
          </div>
        </td>
        <td>{memberName(member)}</td>
        <td>{levelLabel(member.hierarchy_level, member.role_name)}</td>
        <td>{hasChildren ? children.length : member.direct_children_count}</td>
      </tr>
      {hasChildren &&
        expanded &&
        children.map((child) => (
          <TeamTreeRows
            key={child.id}
            member={child}
            depth={depth + 1}
            childrenByParent={childrenByParent}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

export function Team() {
  const { user } = useAuth()
  const [members, setMembers] = useState<TeamMemberOut[]>([])
  const [invites, setInvites] = useState<InviteOut[]>([])
  const [limits, setLimits] = useState<TeamLimits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)

  const [targetLevel, setTargetLevel] = useState<1 | 2>(2)
  const [parentUserId, setParentUserId] = useState<number | ''>('')
  const [nic, setNic] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  const isDirector = isDirectorUser(user)
  const isAdminManager = isAdminManagerUser(user)
  const isManager = isTeamLeadUser(user) && !isDirector

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([api.team.members(), api.invites.list(), api.team.limits()])
      .then(([m, inv, lim]) => {
        setMembers(m)
        setInvites(inv)
        setLimits(lim)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!isDirector) {
      setTargetLevel(2)
      return
    }
    if (targetLevel === 1) setParentUserId('')
  }, [isDirector, targetLevel])

  const l1Managers = members.filter((m) => m.hierarchy_level === 1)

  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const childrenByParent = useMemo(
    () => buildChildrenMap(members, isManager, user?.id),
    [members, isManager, user?.id],
  )

  const rootMembers = useMemo(
    () => (isManager ? [] : buildRootMembers(members, childrenByParent)),
    [members, childrenByParent, isManager],
  )

  const managerAgents = useMemo(
    () => (isManager && user ? (childrenByParent.get(user.id) ?? []) : []),
    [isManager, user, childrenByParent],
  )

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setLastLink(null)
    try {
      const inv = await api.invites.create({
        target_hierarchy_level: isDirector ? targetLevel : 2,
        parent_user_id:
          isDirector && targetLevel === 2 && parentUserId !== ''
            ? Number(parentUserId)
            : undefined,
        nic: nic.trim() || undefined,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
      })
      setLastLink(inv.invite_url)
      setNic('')
      setFirstName('')
      setLastName('')
      setEmail('')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      alert('Ссылка скопирована')
    } catch {
      prompt('Скопируйте ссылку:', url)
    }
  }

  const cancelInvite = async (id: number) => {
    if (!confirm('Отменить приглашение?')) return
    try {
      await api.invites.cancel(id)
      reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  if (!user?.can_invite && !isDirector && !isTeamLeadUser(user)) {
    return (
      <div className="text-slate-600">
        Нет доступа к управлению командой.
      </div>
    )
  }

  if (loading && members.length === 0) {
    return <div className="text-slate-500">Загрузка…</div>
  }

  return (
    <div>
      <div className="page-title">
        <h2>Моя команда</h2>
        <p style={{ margin: '8px 0 0', color: '#73879C', fontSize: 13 }}>
          Уровень: {levelLabel(user?.hierarchy_level ?? 2, user?.role_name)}
          {limits != null && (
            <> · Прямых подчинённых: {limits.direct_children_count}</>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-4">
          {error}
        </div>
      )}

      <RegistrationLinkPanel visible={isManager} />

      <div className="x_panel" style={{ marginBottom: 16 }}>
        <div className="x_title">
          <h2>{isManager ? 'Пригласить агента' : 'Пригласить в команду'}</h2>
        </div>
        <div className="x_content">
          {isManager && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#73879C' }}>
              {isAdminManager
                ? 'Админ/менеджер может приглашать только агентов в свою команду.'
                : 'Менеджер может приглашать только агентов в свою команду.'}
            </p>
          )}
          <form onSubmit={handleInvite} className="max-w-xl space-y-3">
            {isDirector && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Уровень</label>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(Number(e.target.value) as 1 | 2)}
                >
                  <option value={1}>Менеджер</option>
                  <option value={2}>Агент</option>
                </select>
              </div>
            )}
            {isDirector && targetLevel === 2 && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Менеджер (наставник)</label>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={parentUserId}
                  onChange={(e) => setParentUserId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">— выберите —</option>
                  {l1Managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.nic}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Имя</label>
                <input className="w-full rounded border border-slate-300 px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Фамилия</label>
                <input className="w-full rounded border border-slate-300 px-3 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Логин (можно задать заранее)</label>
              <input className="w-full rounded border border-slate-300 px-3 py-2" value={nic} onChange={(e) => setNic(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input type="email" className="w-full rounded border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? 'Создание…' : isManager ? 'Создать приглашение агенту' : 'Создать ссылку-приглашение'}
            </button>
          </form>
          {lastLink && (
            <div className="mt-4 p-3 bg-slate-50 rounded border text-sm">
              <div className="font-medium mb-1">Ссылка для регистрации:</div>
              <code className="break-all">{lastLink}</code>
              <button type="button" className="btn btn-default btn-sm mt-2" onClick={() => copyLink(lastLink)}>
                Копировать
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="x_panel" style={{ marginBottom: 16 }}>
        <div className="x_title">
          <h2>Активные приглашения</h2>
        </div>
        <div className="x_content" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table table-striped" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Уровень</th>
                <th>Наставник</th>
                <th>Логин / имя</th>
                <th>Ссылка</th>
                <th>Срок</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.filter((i) => !i.accepted_at).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-500">Нет активных приглашений</td>
                </tr>
              ) : (
                invites
                  .filter((i) => !i.accepted_at)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{levelLabel(i.target_hierarchy_level)}</td>
                      <td>{i.parent_name ?? '—'}</td>
                      <td>{i.nic || [i.first_name, i.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td>
                        <button type="button" className="btn btn-default btn-xs" onClick={() => copyLink(i.invite_url)}>
                          Копировать
                        </button>
                      </td>
                      <td>{new Date(i.expires_at).toLocaleDateString('ru-RU')}</td>
                      <td>
                        <button type="button" className="btn btn-danger btn-xs" onClick={() => cancelInvite(i.id)}>
                          Отмена
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="x_panel">
        <div className="x_title">
          <h2>Состав команды</h2>
        </div>
        <div className="x_content" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table table-striped" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Логин</th>
                <th>Имя</th>
                <th>Уровень</th>
                <th>Подчинённых</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-slate-500">Пока никого в ветке</td>
                </tr>
              ) : isManager && user ? (
                <>
                  <tr>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-default btn-xs"
                          style={{ minWidth: 24, padding: '0 4px', lineHeight: 1.4 }}
                          onClick={() => toggleExpanded(user.id)}
                          aria-expanded={expandedIds.has(user.id)}
                          disabled={managerAgents.length === 0}
                        >
                          {managerAgents.length === 0 ? '·' : expandedIds.has(user.id) ? '▼' : '▶'}
                        </button>
                        <span>{user.nic}</span>
                      </div>
                    </td>
                    <td>{memberName(user)}</td>
                    <td>{isAdminManager ? 'Админ/менеджер' : 'Менеджер'}</td>
                    <td>{managerAgents.length}</td>
                  </tr>
                  {expandedIds.has(user.id) &&
                    managerAgents.map((m) => (
                      <TeamTreeRows
                        key={m.id}
                        member={m}
                        depth={1}
                        childrenByParent={childrenByParent}
                        expandedIds={expandedIds}
                        onToggle={toggleExpanded}
                      />
                    ))}
                </>
              ) : (
                rootMembers.map((m) => (
                  <TeamTreeRows
                    key={m.id}
                    member={m}
                    depth={0}
                    childrenByParent={childrenByParent}
                    expandedIds={expandedIds}
                    onToggle={toggleExpanded}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
