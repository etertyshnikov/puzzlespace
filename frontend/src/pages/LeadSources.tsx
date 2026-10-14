import { useEffect, useState } from 'react'
import { api, type LeadSource } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function LeadSources() {
  const colSpan = useSettingsTableColSpan(5)
  const [list, setList] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.leadSources.list().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить источник лидов «${name}»?`)) return
    api.leadSources.delete(id).then(() => setList((prev) => prev.filter((s) => s.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Источники лидов</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/lead-sources/new">Добавить источник</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <table className="table table-striped">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Название</th>
                <th style={{ width: 80 }}>Активен</th>
                <th style={{ width: 80 }}>Порядок</th>
                <SettingsActionTh />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                    Нет источников лидов.
                  </td>
                </tr>
              ) : (
                list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.name}</td>
                    <td><span className={s.is_active ? 'badge badge-success' : 'badge badge-default'}>{s.is_active ? 'Да' : 'Нет'}</span></td>
                    <td>{s.sort_order}</td>
                    <SettingsActionTd>
                      <EditLinkIcon to={`/settings/lead-sources/${s.id}/edit`} />
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
  )
}
