import { useEffect, useState } from 'react'
import { api, type RequiredItemMaterial } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function RequiredItemMaterials() {
  const colSpan = useSettingsTableColSpan(4)
  const [list, setList] = useState<RequiredItemMaterial[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [nomenclature, setNomenclature] = useState<{ id: number; item_number: string; name?: string | null }[]>([])
  const [templateFilter, setTemplateFilter] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const tid = templateFilter === '' ? undefined : templateFilter
    api.requiredItemMaterials.list(tid !== undefined ? { template_id: tid } : undefined).then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [templateFilter])
  useEffect(() => { api.requiredItemTemplates.list().then((t) => setTemplates(t)).catch(() => setTemplates([])) }, [])
  useEffect(() => { api.nomenclatureItems.list({ limit: 2000 }).then((n) => setNomenclature(n)).catch(() => setNomenclature([])) }, [])

  const remove = (id: number) => {
    if (!confirm('Удалить связь?')) return
    api.requiredItemMaterials.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading && list.length === 0) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Допустимые материалы для обязательной позиции</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="form-control" style={{ width: 'auto', display: 'inline-block' }}>
            <option value="">Все шаблоны</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <SettingsAddLink to="/settings/required-item-materials/new">Добавить</SettingsAddLink>
        </div>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Шаблон обязательной позиции</th>
                  <th>Позиция номенклатуры</th>
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
                      <td>{templates.find((t) => t.id === r.required_item_template_id)?.name ?? r.required_item_template_id}</td>
                      <td>
                        {(() => {
                          const n = nomenclature.find((x) => x.id === r.nomenclature_id)
                          if (!n) return r.nomenclature_id
                          const num = n.item_number ?? ''
                          const name = n.name?.trim() ?? ''
                          return name ? `${num} ${name}` : num
                        })()}
                      </td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/required-item-materials/${r.id}/edit`} />
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
