import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type ContractTemplate } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsToolbarButton } from '../components/SettingsTableChrome'
import { useSettingsReadOnly, useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function ContractTemplates() {
  const colSpan = useSettingsTableColSpan(5)
  const settingsReadOnly = useSettingsReadOnly()
  const [list, setList] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const orderRef = useRef<ContractTemplate[]>([])

  const load = useCallback(() => {
    setLoading(true)
    api.contractTemplates
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

  const handleCreate = () => {
    if (!newCode.trim() || !newTitle.trim()) return
    setCreating(true)
    api.contractTemplates
      .create({ code: newCode.trim(), title: newTitle.trim() })
      .then(() => {
        setShowAdd(false)
        setNewCode('')
        setNewTitle('')
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCreating(false))
  }

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Удалить шаблон «${title}»?`)) return
    api.contractTemplates
      .delete(id)
      .then(() => {
        setList((prev) => {
          const next = prev.filter((t) => t.id !== id)
          orderRef.current = next
          return next
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const onDragOver = (e: React.DragEvent, overId: number) => {
    e.preventDefault()
    if (dragId == null || dragId === overId) return
    setList((prev) => {
      const order = [...prev]
      const from = order.findIndex((t) => t.id === dragId)
      const to = order.findIndex((t) => t.id === overId)
      if (from < 0 || to < 0) return prev
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      orderRef.current = order
      return order
    })
  }

  const saveOrder = async (ordered: ContractTemplate[]) => {
    setSavingOrder(true)
    try {
      const updated = await api.contractTemplates.reorder(ordered.map((t) => t.id))
      setList(updated)
      orderRef.current = updated
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
      <div className="page-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Договора</h2>
            <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
              Шаблоны текста договора на поставку и на установку. В тексте можно использовать стейкхолдеры (см. Помощь).
              {savingOrder ? ' · сохранение порядка…' : list.length > 1 ? ' · перетащите строки для изменения порядка' : ''}
            </p>
          </div>
          <SettingsToolbarButton className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Добавить
          </SettingsToolbarButton>
        </div>
      </div>
      {showAdd && !settingsReadOnly && (
        <div className="x_panel" style={{ marginBottom: 16 }}>
          <div className="x_content" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Код</label>
              <input
                type="text"
                className="form-control"
                placeholder="например: dogovor_supply_2"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                style={{ width: 220 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Название</label>
              <input
                type="text"
                className="form-control"
                placeholder="Договор поставки №2"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: 300 }}
              />
            </div>
            <button className="btn btn-success btn-sm" disabled={creating || !newCode.trim() || !newTitle.trim()} onClick={handleCreate}>
              {creating ? 'Создание…' : 'Создать'}
            </button>
            <button className="btn btn-default btn-sm" onClick={() => { setShowAdd(false); setNewCode(''); setNewTitle('') }}>
              Отмена
            </button>
          </div>
        </div>
      )}
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 36 }} aria-label="Порядок" />
                  <th style={{ width: 60 }}>ID</th>
                  <th>Код</th>
                  <th>Название</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет шаблонов. Нажмите «+ Добавить» чтобы создать первый.
                    </td>
                  </tr>
                ) : (
                  list.map((t) => (
                    <tr
                      key={t.id}
                      className={dragId === t.id ? 'parts-dnd-row parts-dnd-row--dragging' : 'parts-dnd-row'}
                      draggable={!settingsReadOnly && list.length > 1}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOver(e, t.id)}
                    >
                      <td className="parts-dnd-row__handle" title={list.length > 1 ? 'Перетащить' : undefined}>
                        {list.length > 1 ? '⋮⋮' : ''}
                      </td>
                      <td>{t.id}</td>
                      <td><code>{t.code}</code></td>
                      <td>{t.title}</td>
                      <SettingsActionTd>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <EditLinkIcon to={`/settings/contract-templates/${t.id}/edit`} />
                          <DeleteIconButton onClick={() => handleDelete(t.id, t.title)} />
                        </div>
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
