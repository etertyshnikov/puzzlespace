import { useEffect, useState } from 'react'
import { api, type NomenclatureItem } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function NomenclatureItems() {
  const colSpan = useSettingsTableColSpan(9)
  const [list, setList] = useState<NomenclatureItem[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.nomenclatureItems.list({ limit: 2000 }).then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { api.parts.list().then(setParts).catch(() => setParts([])) }, [])

  const remove = (id: number, label: string) => {
    if (!confirm(`Удалить позицию «${label}»?`)) return
    api.nomenclatureItems.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div style={{ minWidth: 0 }}>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Позиции номенклатуры</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/nomenclature-items/new">Добавить</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th style={{ width: 90 }}>Номер</th>
                  <th style={{ width: 220 }}>Название</th>
                  <th>Часть дома</th>
                  <th style={{ width: 56 }}>Ед.</th>
                  <th style={{ width: 70 }}>Ед. альт.</th>
                  <th style={{ width: 90 }}>Стоимость</th>
                  <th style={{ width: 90 }}>Альт. цена</th>
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
                      <td>{r.item_number}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name ?? ''}>{r.name ?? '—'}</td>
                      <td>{parts.find((p) => p.id === r.part_id)?.name ?? '—'}</td>
                      <td>{r.unit}</td>
                      <td>{r.unit_alt ?? '—'}</td>
                      <td>{r.total_cost}</td>
                      <td>{r.price_alt != null ? r.price_alt : '—'}</td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/nomenclature-items/${r.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(r.id, r.name || r.item_number)} />
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
