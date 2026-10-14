import { useEffect, useState } from 'react'
import { api, type Branch } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function Branches() {
  const colSpan = useSettingsTableColSpan(7)
  const [list, setList] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.branches.list().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить филиал «${name}»?`)) return
    api.branches.delete(id).then(() => setList((prev) => prev.filter((b) => b.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Филиалы</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/branches/new">Добавить филиал</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Название</th>
                  <th>Адрес</th>
                  <th>Телефон</th>
                  <th>Email</th>
                  <th style={{ width: 80 }}>Активен</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет филиалов.
                    </td>
                  </tr>
                ) : (
                  list.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{b.name}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.address ?? '—'}</td>
                      <td>{b.phone ?? '—'}</td>
                      <td>{b.email ?? '—'}</td>
                      <td><span className={b.is_active ? 'badge badge-success' : 'badge badge-default'}>{b.is_active ? 'Да' : 'Нет'}</span></td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/branches/${b.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(b.id, b.name)} />
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
