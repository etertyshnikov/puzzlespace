import { useEffect, useState } from 'react'
import { api, type ProjectStatus } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'
import { getProjectStatusBadgeStyle } from '../utils/projectStatusColors'
import { formatExecutionDays } from '../utils/projectStatusSla'
import { resolveStatusActionDisplay } from '../utils/dashboardActionTiles'

export function ProjectStatuses() {
  const colSpan = useSettingsTableColSpan(8)
  const [list, setList] = useState<ProjectStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projectStatuses
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить статус «${name}»?`)) return
    api.projectStatuses
      .delete(id)
      .then(() => setList((prev) => prev.filter((s) => s.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#000' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div style={{ minWidth: 0, width: '100%' }}>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Статусы проектов</h2>
          <p style={{ margin: 0, fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/project-statuses/new">Добавить статус</SettingsAddLink>
      </div>

      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table table-striped" style={{ width: '100%', minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Действие</th>
                  <th style={{ width: 130 }}>Время исполнения</th>
                  <th style={{ width: 80 }}>Порядок</th>
                  <th style={{ width: 80 }}>Активен</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24 }}>
                      Нет статусов.
                    </td>
                  </tr>
                ) : (
                  list.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>
                        <span className="badge" style={getProjectStatusBadgeStyle(s.id)}>
                          {s.name}
                        </span>
                      </td>
                      <td
                        style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={s.description ?? undefined}
                      >
                        {s.description ?? '—'}
                      </td>
                      <td
                        style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={s.action?.trim() || resolveStatusActionDisplay(s)}
                      >
                        {s.action?.trim() || resolveStatusActionDisplay(s)}
                        {!s.action?.trim() && resolveStatusActionDisplay(s) !== '—' && (
                          <span style={{ fontSize: 11, color: '#73879C', marginLeft: 4 }} title="В БД пусто; подпись по названию статуса">
                            *
                          </span>
                        )}
                      </td>
                      <td>{formatExecutionDays(s.execution_days)}</td>
                      <td>{s.sort_order}</td>
                      <td>
                        <span className={s.is_active ? 'badge badge-success' : 'badge badge-default'}>
                          {s.is_active ? 'Да' : 'Нет'}
                        </span>
                      </td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/project-statuses/${s.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(s.id, s.name)} />
                      </SettingsActionTd>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
