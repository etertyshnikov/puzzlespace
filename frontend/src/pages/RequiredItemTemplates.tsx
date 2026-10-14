import { useEffect, useState } from 'react'
import { api, type RequiredItemTemplate } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function RequiredItemTemplates() {
  const colSpan = useSettingsTableColSpan(6)
  const [list, setList] = useState<RequiredItemTemplate[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.requiredItemTemplates.list().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { api.parts.list().then((p) => setParts(p)).catch(() => setParts([])) }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить позицию «${name}»?`)) return
    api.requiredItemTemplates.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Позиции частей дома</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/required-item-templates/new">Добавить</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Часть дома</th>
                  <th>Название</th>
                  <th style={{ width: 80 }}>Кол-во</th>
                  <th style={{ width: 56 }}>Ед.</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет записей.
                    </td>
                  </tr>
                ) : (
                  list.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{parts.find((p) => p.id === r.part_id)?.name ?? r.part_id}</td>
                      <td>{r.name}</td>
                      <td>{r.required_qty}</td>
                      <td>{r.unit}</td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/required-item-templates/${r.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(r.id, r.name)} />
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
