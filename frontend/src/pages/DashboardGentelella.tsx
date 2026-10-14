import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Project } from '../api/client'
import '../assets/gentelella/gentelella-dashboard.css'

export function DashboardGentelella() {
  const [stats, setStats] = useState<{ customers: number; branches: number; leadSources: number; dbOk: boolean } | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.customers.list({ limit: 5000 }),
      api.branches.list(),
      api.leadSources.list(),
      api.healthDb(),
    ])
      .then(([customers, branches, leadSources, health]) => {
        if (cancelled) return
        setStats({
          customers: customers.length,
          branches: branches.length,
          leadSources: leadSources.length,
          dbOk: health.db === 'connected',
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setProjectsLoading(true)
    api.projects
      .list({ limit: 500 })
      .then((data) => {
        if (!cancelled) setProjects(data)
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="gentelella-dashboard">
        <div className="x_panel">
          <div className="x_title">
            <h2>Дашборд</h2>
          </div>
          <div className="x_content">
            <p style={{ color: '#E74C3C' }}>
              Не удалось загрузить данные. Убедитесь, что API запущен на <code>localhost:8008</code>.
            </p>
            <pre style={{ marginTop: 8, fontSize: 12 }}>{error}</pre>
          </div>
        </div>
      </div>
    )
  }

  const tiles = [
    { title: 'Клиенты', value: stats?.customers ?? '—', to: '/customers' },
    { title: 'Филиалы', value: stats?.branches ?? '—', to: '/settings/branches' },
    { title: 'Источники лидов', value: stats?.leadSources ?? '—', to: '/settings/lead-sources' },
  ]

  return (
    <div className="gentelella-dashboard">
      <div className="row tile_count">
        {tiles.map(({ title, value, to }) => (
          <div key={to} className="col-md-4 col-sm-4 col-xs-6 tile_stats_count">
            <Link to={to}>
              <span className="count_top">{title}</span>
              <div className="count">{value}</div>
            </Link>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="col-md-12 col-sm-12 col-xs-12">
          <div className="x_panel">
            <div className="x_title">
              <h2>Проекты</h2>
            </div>
            <div className="x_content">
              {projectsLoading ? (
                <p>Загрузка…</p>
              ) : (
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Название</th>
                      <th>Номер</th>
                      <th>Дата текущего статуса</th>
                      <th>Бюджет</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#000' }}>
                          Нет проектов
                        </td>
                      </tr>
                    ) : (
                      projects.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.name || '—'}</td>
                          <td>{p.project_number || '—'}</td>
                          <td>{p.status_started_at ? new Date(p.status_started_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                          <td>
                            {p.budget != null
                              ? `${Number(p.budget).toLocaleString('ru-RU')} ₽`
                              : '—'}
                          </td>
                          <td>
                            <Link to={`/projects/${p.id}/specifications`}>Спецификации</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-12 col-sm-12 col-xs-12">
          <div className="x_panel">
            <div className="x_title">
              <h2>Статус</h2>
            </div>
            <div className="x_content">
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                <li>API: {stats ? 'подключён' : 'загрузка…'}</li>
                <li>БД: {stats?.dbOk ? 'подключена' : stats === null ? '…' : 'ошибка'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
