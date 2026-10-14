import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { api, type Customer, type CustomerDealStatus, type Project, type ProjectCreate, type ProjectStatus, CUSTOMER_DEAL_STATUS_LABELS } from '../api/client'
import { EditLinkIcon, EditIconButton, DeleteIconButton } from '../components/SettingsActionIcons'
import { StatusDropdown } from '../components/StatusDropdown'
import { PhoneActionsDropdown } from '../components/PhoneActionsDropdown'
import { getProjectStatusBadgeStyle } from '../utils/projectStatusColors'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser } from '../utils/userRoles'

const ALL_DEAL_STATUSES: CustomerDealStatus[] = ['in_progress', 'success', 'rejected']

export function Customers() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = isAdminUser(user)
  const [searchParams] = useSearchParams()
  const [list, setList] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatorFilter, setCreatorFilter] = useState<string>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([])
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProject, setNewProject] = useState<{ name: string; project_number: string }>({ name: '', project_number: '' })
  const [savingProject, setSavingProject] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [savingProjectName, setSavingProjectName] = useState(false)
  const [projectCreatorFilter, setProjectCreatorFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<CustomerDealStatus[]>([])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.customers
      .list({
        limit: 5000,
        deal_status: statusFilter.length > 0 ? statusFilter : undefined,
      })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [statusFilter, location.key])

  useEffect(() => {
    const updatedCustomer = (location.state as { updatedCustomer?: Customer } | null)?.updatedCustomer
    if (updatedCustomer == null) return
    setList((prev) => prev.map((c) => (c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c)))
    setSelectedCustomerId(updatedCustomer.id)
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  const toggleDealStatusFilter = (s: CustomerDealStatus) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  useEffect(() => {
    const customerIdParam = searchParams.get('customer_id')
    if (customerIdParam != null) {
      const id = parseInt(customerIdParam, 10)
      if (Number.isFinite(id)) setSelectedCustomerId(id)
    }
  }, [searchParams])

  useEffect(() => {
    api.projectStatuses.list().then(setProjectStatuses).catch(() => setProjectStatuses([]))
  }, [])

  useEffect(() => {
    if (selectedCustomerId == null) {
      setProjects([])
      setProjectCreatorFilter('')
      return
    }
    setProjectsLoading(true)
    setProjectCreatorFilter('')
    api.projects.list({ customer_id: selectedCustomerId }).then(setProjects).catch(() => setProjects([])).finally(() => setProjectsLoading(false))
  }, [selectedCustomerId])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить клиента «${name}»?`)) return
    api.customers.delete(id).then(() => {
      setList((prev) => prev.filter((c) => c.id !== id))
      if (selectedCustomerId === id) setSelectedCustomerId(null)
    }).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  const removeProject = (id: number, name: string) => {
    if (!confirm(`Удалить проект «${name}»?`)) return
    api.projects.delete(id).then(() => setProjects((prev) => prev.filter((p) => p.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  const addProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedCustomerId == null || !newProject.name.trim()) return
    setSavingProject(true)
    const payload: ProjectCreate = { name: newProject.name.trim(), customer_id: selectedCustomerId, project_number: newProject.project_number.trim() || undefined }
    api.projects.create(payload).then((created) => {
      setProjects((prev) => [...prev, created])
      setNewProject({ name: '', project_number: '' })
      setShowAddProject(false)
    }).catch((e) => alert(e instanceof Error ? e.message : String(e))).finally(() => setSavingProject(false))
  }

  const changeProjectStatus = (projectId: number, statusId: number | null) => {
    setUpdatingStatusId(projectId)
    api.projects
      .update(projectId, { status_id: statusId ?? undefined })
      .then((updated) => {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status_id: updated.status_id } : p)))
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setUpdatingStatusId(null))
  }

  const startEditProjectName = (p: Project) => {
    setEditingProjectId(p.id)
    setEditingProjectName(p.name ?? '')
  }

  const saveProjectName = (projectId: number) => {
    if (editingProjectId !== projectId) return
    const name = editingProjectName.trim()
    setSavingProjectName(true)
    api.projects
      .update(projectId, { name: name || undefined })
      .then((updated) => {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name: updated.name ?? p.name } : p)))
        setEditingProjectId(null)
      })
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setSavingProjectName(false))
  }

  const creatorNames = useMemo(() => {
    const names = new Set<string>()
    list.forEach((c) => { if (c.created_by_name) names.add(c.created_by_name) })
    return Array.from(names).sort()
  }, [list])

  const filteredList = useMemo(() => {
    if (!creatorFilter) return list
    return list.filter((c) => c.created_by_name === creatorFilter)
  }, [list, creatorFilter])

  const projectCreatorNames = useMemo(() => {
    const names = new Set<string>()
    projects.forEach((p) => { if (p.created_by_name) names.add(p.created_by_name) })
    return Array.from(names).sort()
  }, [projects])

  const filteredProjects = useMemo(() => {
    if (!projectCreatorFilter) return projects
    return projects.filter((p) => p.created_by_name === projectCreatorFilter)
  }, [projects, projectCreatorFilter])

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  const selectedCustomer = selectedCustomerId != null ? list.find((c) => c.id === selectedCustomerId) : null

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <h2>Клиенты</h2>
        <Link to="/customers/new" className="btn btn-success">Добавить клиента</Link>
      </div>

      <div className="row" style={{ display: 'flex', flexWrap: 'wrap', marginLeft: 0, marginRight: 0 }}>
        <div style={{ flex: '0 0 60%', maxWidth: '60%', paddingLeft: 0, paddingRight: 8, minWidth: 0 }}>
          <div className="x_panel card-panel">
            <div className="x_title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Клиенты ({filteredList.length})</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <details style={{ position: 'relative' }}>
                  <summary className="btn btn-default" style={{ cursor: 'pointer' }}>
                    Статус{statusFilter.length > 0 ? ` (${statusFilter.length})` : ': все'}
                  </summary>
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      zIndex: 20,
                      background: '#fff',
                      border: '1px solid #E6E9ED',
                      borderRadius: 4,
                      padding: '10px 12px',
                      minWidth: 220,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ALL_DEAL_STATUSES.map((s) => (
                      <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={statusFilter.includes(s)} onChange={() => toggleDealStatusFilter(s)} />
                        {CUSTOMER_DEAL_STATUS_LABELS[s]}
                      </label>
                    ))}
                    {statusFilter.length > 0 && (
                      <button type="button" className="btn btn-default btn-sm" onClick={() => setStatusFilter([])}>
                        Сбросить фильтр
                      </button>
                    )}
                  </div>
                </details>
                {isAdmin && creatorNames.length > 1 && (
                  <select
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    className="form-control"
                    style={{ width: 'auto', minWidth: 140, display: 'inline-block' }}
                  >
                    <option value="">Все сотрудники</option>
                    {creatorNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="x_content">
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                <table className="table table-striped" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>ID</th>
                      <th style={{ width: 90 }}>№</th>
                      <th>ФИО / Имя</th>
                      <th style={{ width: 110 }}>Статус</th>
                      <th style={{ width: 170, minWidth: 170, maxWidth: 170 }}>Телефон</th>
                      <th style={{ width: 100 }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                          {list.length === 0 ? <>Нет клиентов. <Link to="/customers/new">Добавить</Link></> : 'Нет клиентов по выбранному фильтру'}
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          style={{ cursor: 'pointer', background: selectedCustomerId === c.id ? '#E8F6F3' : undefined }}
                        >
                          <td>{c.id}</td>
                          <td>{c.number ?? '—'}</td>
                          <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <Link to={`/customers/${c.id}/edit`} onClick={(e) => e.stopPropagation()}>
                              {c.full_name || c.name}
                            </Link>
                          </td>
                          <td>{CUSTOMER_DEAL_STATUS_LABELS[c.deal_status] ?? c.deal_status}</td>
                          <td
                            style={{ width: 170, minWidth: 170, maxWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PhoneActionsDropdown phone={c.phone} displayPhone={c.phone} />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <EditLinkIcon to={`/customers/${c.id}/edit`} />
                            <DeleteIconButton onClick={() => remove(c.id, c.full_name || c.name)} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: '0 0 40%', maxWidth: '40%', paddingLeft: 8, paddingRight: 0, minWidth: 0 }}>
          <div className="x_panel card-panel">
            <div className="x_title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Проекты{selectedCustomer ? ` — ${selectedCustomer.full_name || selectedCustomer.name}` : ''}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isAdmin && projectCreatorNames.length > 1 && (
                  <select
                    value={projectCreatorFilter}
                    onChange={(e) => setProjectCreatorFilter(e.target.value)}
                    className="form-control"
                    style={{ width: 'auto', minWidth: 140, display: 'inline-block' }}
                  >
                    <option value="">Все сотрудники</option>
                    {projectCreatorNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
                {selectedCustomerId != null && (
                  <button type="button" onClick={() => setShowAddProject((v) => !v)} className={showAddProject ? 'btn btn-default' : 'btn btn-success'}>
                    {showAddProject ? 'Отмена' : 'Добавить проект'}
                  </button>
                )}
              </div>
            </div>
            <div className="x_content">
              {selectedCustomerId == null ? (
                <p style={{ color: '#73879C', textAlign: 'center', padding: 24 }}>Выберите клиента в таблице слева</p>
              ) : (
                <>
                  {showAddProject && (
                    <form onSubmit={addProject} style={{ marginBottom: 15, padding: 12, background: '#F9F9F9', borderRadius: 3 }}>
                      <div className="form-group">
                        <input type="text" placeholder="Название проекта *" value={newProject.name} onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))} className="form-control" required />
                      </div>
                      <div className="form-group">
                        <input type="text" placeholder="Номер проекта" value={newProject.project_number} onChange={(e) => setNewProject((p) => ({ ...p, project_number: e.target.value }))} className="form-control" />
                      </div>
                      <button type="submit" disabled={savingProject} className="btn btn-success">{savingProject ? 'Сохранение…' : 'Сохранить'}</button>
                    </form>
                  )}
                  {projectsLoading ? (
                    <p style={{ color: '#73879C', padding: 16 }}>Загрузка проектов…</p>
                  ) : (
                    <table className="table table-striped" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 50 }}>ID</th>
                          <th>Название</th>
                          <th style={{ width: 120 }}>№ проекта</th>
                          <th style={{ width: 155, minWidth: 155, maxWidth: 155 }}>Статус</th>
                          <th style={{ width: 100 }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProjects.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                              {projects.length === 0 ? 'Нет проектов. Нажмите «Добавить проект».' : 'Нет проектов по выбранному фильтру'}
                            </td>
                          </tr>
                        ) : (
                          filteredProjects.map((p) => (
                            <tr key={p.id} onClick={() => editingProjectId !== p.id && navigate(`/projects/${p.id}/specifications`)} style={{ cursor: editingProjectId === p.id ? 'default' : 'pointer' }}>
                              <td>{p.id}</td>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={(e) => { if (editingProjectId === p.id) e.stopPropagation() }}>
                                {editingProjectId === p.id ? (
                                  <input
                                    type="text"
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    onBlur={() => saveProjectName(p.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                      if (e.key === 'Escape') {
                                        setEditingProjectId(null)
                                        setEditingProjectName('')
                                      }
                                    }}
                                    disabled={savingProjectName}
                                    className="form-control"
                                    style={{ width: '100%', minWidth: 120 }}
                                    autoFocus
                                  />
                                ) : (
                                  p.name
                                )}
                              </td>
                              <td>{p.project_number ?? '—'}</td>
                              <td style={{ width: 155, minWidth: 155, maxWidth: 155 }} onClick={(e) => e.stopPropagation()}>
                                <StatusDropdown
                                  value={p.status_id ?? null}
                                  statuses={projectStatuses}
                                  onChange={(statusId) => changeProjectStatus(p.id, statusId)}
                                  disabled={updatingStatusId === p.id}
                                  getBadgeStyle={getProjectStatusBadgeStyle}
                                />
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <EditIconButton
                                  title="Редактировать название"
                                  onClick={() => startEditProjectName(p)}
                                  disabled={editingProjectId != null}
                                />
                                <DeleteIconButton
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeProject(p.id, p.name)
                                  }}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
