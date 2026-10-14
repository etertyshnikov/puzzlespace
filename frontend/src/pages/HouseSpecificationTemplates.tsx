import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type HouseSpecificationTemplate } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function HouseSpecificationTemplates() {
  const colSpan = useSettingsTableColSpan(3)
  const navigate = useNavigate()
  const [list, setList] = useState<HouseSpecificationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.houseSpecificationTemplates.list().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить шаблон «${name}»?`)) return
    api.houseSpecificationTemplates.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Шаблоны спецификации домов</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/house-specification-templates/new">Добавить</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <table className="table table-striped">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Название</th>
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
                  <tr
                    key={r.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/settings/house-templates?template_id=${r.id}`)}
                  >
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <SettingsActionTd onClick={(e) => e.stopPropagation()}>
                      <EditLinkIcon to={`/settings/house-specification-templates/${r.id}/edit`} />
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
  )
}
