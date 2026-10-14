import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ProjectStatusLog } from '../api/client'

function formatLogDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

export function ProjectStatusLogs() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<ProjectStatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterProjectNumber, setFilterProjectNumber] = useState('')
  const [filterProjectName, setFilterProjectName] = useState('')
  const [filterOldStatus, setFilterOldStatus] = useState('')
  const [filterNewStatus, setFilterNewStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    api.projectStatusLogs
      .list({ limit: 500 })
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filteredLogs = useMemo(() => {
    let result = logs
    const df = filterDateFrom.trim()
    const dt = filterDateTo.trim()
    if (df) {
      const from = new Date(df)
      from.setHours(0, 0, 0, 0)
      result = result.filter((log) => {
        const t = log.changed_at ? new Date(log.changed_at).getTime() : 0
        return t >= from.getTime()
      })
    }
    if (dt) {
      const to = new Date(dt)
      to.setHours(23, 59, 59, 999)
      result = result.filter((log) => {
        const t = log.changed_at ? new Date(log.changed_at).getTime() : 0
        return t <= to.getTime()
      })
    }
    const pn = filterProjectNumber.trim().toLowerCase()
    if (pn) {
      result = result.filter((log) => (log.project_number ?? '').toLowerCase().includes(pn))
    }
    const pname = filterProjectName.trim().toLowerCase()
    if (pname) {
      result = result.filter((log) => (log.project_name ?? '').toLowerCase().includes(pname))
    }
    const oldS = filterOldStatus.trim().toLowerCase()
    if (oldS) {
      result = result.filter((log) => (log.old_status_name ?? '').toLowerCase().includes(oldS))
    }
    const newS = filterNewStatus.trim().toLowerCase()
    if (newS) {
      result = result.filter((log) => (log.new_status_name ?? '').toLowerCase().includes(newS))
    }
    return result
  }, [logs, filterDateFrom, filterDateTo, filterProjectNumber, filterProjectName, filterOldStatus, filterNewStatus])

  if (error) {
    return (
      <div>
        <div className="page-title">
          <h2>Логи статусов проектов</h2>
        </div>
        <div className="x_panel">
          <div className="x_content">
            <p style={{ color: '#E74C3C' }}>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-title">
        <h2>Логи статусов проектов</h2>
      </div>
      <div className="x_panel dashboard-card-panel">
        <div className="x_title" style={{ borderBottom: 'none' }}>
          <h2 style={{ margin: 0 }}>История смены статусов</h2>
        </div>
        <div className="x_content">
          <div style={{ marginBottom: 16 }}>
            <table className="table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 160, verticalAlign: 'middle' }}>Дата и время</th>
                  <th style={{ width: 140, verticalAlign: 'middle' }}>Номер проекта</th>
                  <th style={{ verticalAlign: 'middle' }}>Проект</th>
                  <th style={{ width: 140, verticalAlign: 'middle' }}>Было</th>
                  <th style={{ width: 140, verticalAlign: 'middle' }}>Стало</th>
                </tr>
                <tr style={{ background: '#f8f9fa' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        className="form-control"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        placeholder="От"
                        style={{ width: 120, fontSize: 12 }}
                      />
                      <input
                        type="date"
                        className="form-control"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        placeholder="До"
                        style={{ width: 120, fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={filterProjectNumber}
                      onChange={(e) => setFilterProjectNumber(e.target.value)}
                      placeholder="Фильтр..."
                      style={{ fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={filterProjectName}
                      onChange={(e) => setFilterProjectName(e.target.value)}
                      placeholder="Фильтр..."
                      style={{ fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={filterOldStatus}
                      onChange={(e) => setFilterOldStatus(e.target.value)}
                      placeholder="Фильтр..."
                      style={{ fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={filterNewStatus}
                      onChange={(e) => setFilterNewStatus(e.target.value)}
                      placeholder="Фильтр..."
                      style={{ fontSize: 12 }}
                    />
                  </td>
                </tr>
              </thead>
            </table>
          </div>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {loading ? (
              <p style={{ margin: 0 }}>Загрузка…</p>
            ) : (
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>Дата и время</th>
                    <th style={{ width: 140 }}>Номер проекта</th>
                    <th>Проект</th>
                    <th style={{ width: 140 }}>Было</th>
                    <th style={{ width: 140 }}>Стало</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                        {logs.length === 0 ? 'Нет записей' : 'Нет записей по фильтрам'}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${log.project_id}/specifications`)}
                      >
                        <td>{formatLogDateTime(log.changed_at)}</td>
                        <td>{log.project_number || '—'}</td>
                        <td>{log.project_name || '—'}</td>
                        <td>{log.old_status_name ?? '—'}</td>
                        <td>{log.new_status_name ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          {!loading && logs.length > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#73879C' }}>
              Показано {filteredLogs.length} из {logs.length} записей
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
