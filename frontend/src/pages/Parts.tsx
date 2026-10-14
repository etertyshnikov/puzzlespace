import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Part } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsReadOnly, useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function Parts() {
  const colSpan = useSettingsTableColSpan(4)
  const settingsReadOnly = useSettingsReadOnly()
  const [list, setList] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const orderRef = useRef<Part[]>([])

  const load = useCallback(() => {
    setLoading(true)
    api.parts
      .list()
      .then((data) => {
        setList(data)
        orderRef.current = data
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить «${name}»?`)) return
    api.parts
      .delete(id)
      .then(() => setList((prev) => prev.filter((p) => p.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  const onDragOver = (e: React.DragEvent, overId: number) => {
    e.preventDefault()
    if (dragId == null || dragId === overId) return
    setList((prev) => {
      const order = [...prev]
      const from = order.findIndex((p) => p.id === dragId)
      const to = order.findIndex((p) => p.id === overId)
      if (from < 0 || to < 0) return prev
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      orderRef.current = order
      return order
    })
  }

  const saveOrder = async (ordered: Part[]) => {
    setSavingOrder(true)
    try {
      const updated = await api.parts.reorder(ordered.map((p) => p.id))
      setList(updated)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
      load()
    } finally {
      setSavingOrder(false)
    }
  }

  const onDragEnd = () => {
    const currentDrag = dragId
    setDragId(null)
    if (currentDrag == null) return
    void saveOrder(orderRef.current)
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div
        className="page-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
      >
        <div>
          <h2>Части дома</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
            Всего: {list.length}
            {savingOrder ? ' · сохранение порядка…' : list.length > 1 ? ' · перетащите строки для изменения порядка' : ''}
          </p>
        </div>
        <SettingsAddLink to="/settings/parts/new">Добавить</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <table className="table table-striped">
            <thead>
              <tr>
                <th style={{ width: 36 }} aria-label="Порядок" />
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
                list.map((p) => (
                  <tr
                    key={p.id}
                    className={dragId === p.id ? 'parts-dnd-row parts-dnd-row--dragging' : 'parts-dnd-row'}
                    draggable={!settingsReadOnly}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => onDragOver(e, p.id)}
                  >
                    <td className="parts-dnd-row__handle" title="Перетащить">
                      ⋮⋮
                    </td>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <SettingsActionTd>
                      <EditLinkIcon to={`/settings/parts/${p.id}/edit`} />
                      <DeleteIconButton onClick={() => remove(p.id, p.name)} />
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
