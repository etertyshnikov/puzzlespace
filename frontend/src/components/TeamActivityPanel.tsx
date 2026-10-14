import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ActivityDetailOut, type TeamActivityOut } from '../api/client'

function formatActivityDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return toIsoDate(dt)
}

type DetailState = {
  userId: number
  agentName: string
  eventType: string
  eventLabel: string
} | null

export function TeamActivityPanel() {
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()))
  const [data, setData] = useState<TeamActivityOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailState>(null)
  const [detailRows, setDetailRows] = useState<ActivityDetailOut[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.team
      .activity(selectedDate)
      .then(setData)
      .catch((e) => {
        setData(null)
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [selectedDate])

  useEffect(() => {
    load()
  }, [load])

  const eventColumns = useMemo(() => data?.event_types ?? [], [data])

  const openDetail = (userId: number, agentName: string, eventType: string, eventLabel: string) => {
    setDetail({ userId, agentName, eventType, eventLabel })
    setDetailLoading(true)
    setDetailRows([])
    api.team
      .activityDetails({ user_id: userId, event_type: eventType, day: selectedDate })
      .then(setDetailRows)
      .catch(() => setDetailRows([]))
      .finally(() => setDetailLoading(false))
  }

  const closeDetail = () => {
    setDetail(null)
    setDetailRows([])
  }

  const isToday = selectedDate === toIsoDate(new Date())

  return (
    <>
      <div className="x_panel dashboard-card-panel" style={{ marginBottom: 16 }}>
        <div className="x_title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>Активность команды</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, -1))}
            >
              ←
            </button>
            <span style={{ fontSize: 13, color: '#73879C', minWidth: 100, textAlign: 'center' }}>
              {formatActivityDate(selectedDate)}
              {isToday ? ' (сегодня)' : ''}
            </span>
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, 1))}
              disabled={isToday}
            >
              →
            </button>
            {!isToday && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedDate(toIsoDate(new Date()))}
              >
                Сегодня
              </button>
            )}
          </div>
        </div>
        <div className="x_content" style={{ paddingTop: 8, overflowX: 'auto' }}>
          {loading ? (
            <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Загрузка…</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#E74C3C', fontSize: 13 }}>{error}</p>
          ) : !data || data.agents_count === 0 ? (
            <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
              Нет агентов в команде или данных за выбранный день.
            </p>
          ) : (
            <table className="table table-striped" style={{ marginBottom: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Агент</th>
                  {eventColumns.map((col) => (
                    <th key={col.code} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', width: 56 }}>Итого</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <tr key={agent.user_id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{agent.name}</td>
                    {eventColumns.map((col) => {
                      const count = agent.counts[col.code] ?? 0
                      return (
                        <td key={col.code} style={{ textAlign: 'center' }}>
                          {count > 0 ? (
                            <button
                              type="button"
                              className="btn btn-link btn-xs"
                              style={{ padding: 0, fontWeight: 600 }}
                              onClick={() => openDetail(agent.user_id, agent.name, col.code, col.label)}
                            >
                              {count}
                            </button>
                          ) : (
                            <span style={{ color: '#BDC3C7' }}>0</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{agent.total}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ fontWeight: 700 }}>
                    Итого ({data.agents_count} {data.agents_count === 1 ? 'агент' : 'агентов'})
                  </td>
                  {eventColumns.map((col) => (
                    <td key={col.code} style={{ textAlign: 'center', fontWeight: 600 }}>
                      {data.team_totals[col.code] ?? 0}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>
                    {Object.values(data.team_totals).reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#73879C' }}>
            Считается с полуночи по Москве. Данные накапливаются с момента обновления.
          </p>
        </div>
      </div>

      {detail && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={closeDetail}
        >
          <div
            role="dialog"
            className="x_panel"
            style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="x_title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>
                {detail.agentName}: {detail.eventLabel}
              </h2>
              <button type="button" className="btn btn-default btn-sm" onClick={closeDetail}>
                Закрыть
              </button>
            </div>
            <div className="x_content">
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#73879C' }}>
                {formatActivityDate(selectedDate)}
              </p>
              {detailLoading ? (
                <p style={{ color: '#73879C' }}>Загрузка…</p>
              ) : detailRows.length === 0 ? (
                <p style={{ color: '#73879C' }}>Нет записей</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detailRows.map((row) => (
                    <li key={row.id} style={{ marginBottom: 8 }}>
                      {row.project_id != null ? (
                        <Link
                          to={`/projects/${row.project_id}/specifications`}
                          style={{ color: '#1ABB9C' }}
                        >
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                      <span style={{ color: '#73879C', fontSize: 12, marginLeft: 8 }}>
                        {new Date(row.occurred_at).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
