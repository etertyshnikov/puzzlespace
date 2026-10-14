import { useEffect, useState } from 'react'
import { api, type SpecificationStatus } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function SpecificationStatuses() {
  const colSpan = useSettingsTableColSpan(6)
  const [list, setList] = useState<SpecificationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.specificationStatuses
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить статус «${name}»?`)) return
    api.specificationStatuses
      .delete(id)
      .then(() => setList((prev) => prev.filter((s) => s.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Статусы спецификаций</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/specification-statuses/new">Добавить статус</SettingsAddLink>
      </div>

      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Название</th>
                  <th>Описание</th>
                  <th style={{ width: 80 }}>Порядок</th>
                  <th style={{ width: 80 }}>Активен</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет статусов.
                    </td>
                  </tr>
                ) : (
                  list.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>
                        <span className="badge badge-success">{s.name}</span>
                      </td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description ?? '—'}</td>
                      <td>{s.sort_order}</td>
                      <td>
                        <span className={s.is_active ? 'badge badge-success' : 'badge badge-default'}>
                          {s.is_active ? 'Да' : 'Нет'}
                        </span>
                      </td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/specification-statuses/${s.id}/edit`} />
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
