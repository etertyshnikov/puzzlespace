import { useEffect, useState } from 'react'
import { api, type SpecificationRequiredItem } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function SpecificationRequiredItems() {
  const colSpan = useSettingsTableColSpan(7)
  const [list, setList] = useState<SpecificationRequiredItem[]>([])
  const [specs, setSpecs] = useState<{ id: number }[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [specFilter, setSpecFilter] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const sid = specFilter === '' ? undefined : specFilter
    api.specificationRequiredItems.list({ spec_id: sid, limit: 1000 }).then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [specFilter])
  useEffect(() => { api.specifications.list().then((s) => setSpecs(s)).catch(() => setSpecs([])) }, [])
  useEffect(() => { api.parts.list().then(setParts).catch(() => setParts([])) }, [])
  useEffect(() => { api.requiredItemTemplates.list().then(setTemplates).catch(() => setTemplates([])) }, [])

  const remove = (id: number) => {
    if (!confirm('Удалить обязательную позицию?')) return
    api.specificationRequiredItems.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading && list.length === 0) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Обязательные позиции в конкретной спецификации</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="form-control" style={{ width: 'auto', display: 'inline-block' }}>
            <option value="">Все спецификации</option>
            {specs.map((s) => (<option key={s.id} value={s.id}>#{s.id}</option>))}
          </select>
          <SettingsAddLink to="/settings/specification-required-items/new">Добавить</SettingsAddLink>
        </div>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th style={{ width: 100 }}>Спецификация</th>
                  <th>Часть дома</th>
                  <th>Шаблон</th>
                  <th style={{ width: 100 }}>Требуемое кол-во</th>
                  <th style={{ width: 90 }}>Добавлено</th>
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
                      <td>#{r.spec_id}</td>
                      <td>{parts.find((p) => p.id === r.part_id)?.name ?? r.part_id}</td>
                      <td>{templates.find((t) => t.id === r.template_id)?.name ?? r.template_id}</td>
                      <td>{r.required_qty}</td>
                      <td>{r.added_qty}</td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/specification-required-items/${r.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(r.id)} />
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
