import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  DASHBOARD_TABLE_COLUMNS,
  defaultDashboardColumnsPreference,
  normalizeDashboardColumnsPreference,
  type DashboardColumnId,
  type DashboardColumnsPreference,
} from '../utils/dashboardTableColumns'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: (pref: DashboardColumnsPreference) => void
}

function labelFor(id: DashboardColumnId): string {
  return DASHBOARD_TABLE_COLUMNS.find((c) => c.id === id)?.label ?? id
}

export function DashboardColumnsSettings({ open, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<DashboardColumnsPreference>(defaultDashboardColumnsPreference())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<DashboardColumnId | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    setLoading(true)
    setError(null)
    api.auth
      .getDashboardColumns()
      .then((pref) => setDraft(normalizeDashboardColumnsPreference(pref)))
      .catch((e) => {
        setDraft(defaultDashboardColumnsPreference())
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) {
    return null
  }

  const hiddenSet = new Set(draft.hidden as DashboardColumnId[])

  const move = (id: DashboardColumnId, dir: -1 | 1) => {
    setDraft((prev) => {
      const order = [...(prev.order as DashboardColumnId[])]
      const i = order.indexOf(id)
      if (i < 0) {
        return prev
      }
      const j = i + dir
      if (j < 0 || j >= order.length) {
        return prev
      }
      const next = [...order]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...prev, order: next }
    })
  }

  const toggleVisible = (id: DashboardColumnId) => {
    setDraft((prev) => {
      const hidden = new Set(prev.hidden as DashboardColumnId[])
      if (hidden.has(id)) {
        hidden.delete(id)
      } else {
        const visibleCount = (prev.order as DashboardColumnId[]).filter((x) => !hidden.has(x)).length
        if (visibleCount <= 1 && !hidden.has(id)) {
          return prev
        }
        hidden.add(id)
      }
      return { ...prev, hidden: [...hidden] }
    })
  }

  const onDragStart = (id: DashboardColumnId) => setDragId(id)

  const onDragOver = (e: React.DragEvent, overId: DashboardColumnId) => {
    e.preventDefault()
    if (!dragId || dragId === overId) {
      return
    }
    setDraft((prev) => {
      const order = [...(prev.order as DashboardColumnId[])]
      const from = order.indexOf(dragId)
      const to = order.indexOf(overId)
      if (from < 0 || to < 0) {
        return prev
      }
      order.splice(from, 1)
      order.splice(to, 0, dragId)
      return { ...prev, order }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.auth.saveDashboardColumns(draft)
      const normalized = normalizeDashboardColumnsPreference(saved)
      onSaved(normalized)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setDraft(defaultDashboardColumnsPreference())
  }

  return (
    <div
      className="dashboard-columns-modal-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dashboard-columns-modal" role="dialog" aria-labelledby="dashboard-columns-title">
        <div className="dashboard-columns-modal__header">
          <h3 id="dashboard-columns-title" style={{ margin: 0 }}>
            Столбцы таблицы проектов
          </h3>
          <button type="button" className="btn btn-default btn-sm" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#73879C' }}>
          Включите нужные столбцы и перетащите строки для изменения порядка. Настройка сохраняется для вашего
          пользователя.
        </p>
        {error ? <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <p>Загрузка…</p>
        ) : (
          <ul className="dashboard-columns-list">
            {(draft.order as DashboardColumnId[]).map((id, index) => {
              const visible = !hiddenSet.has(id)
              return (
                <li
                  key={id}
                  className={`dashboard-columns-list__item${visible ? '' : ' dashboard-columns-list__item--hidden'}`}
                  draggable
                  onDragStart={() => onDragStart(id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => onDragOver(e, id)}
                >
                  <span className="dashboard-columns-list__drag" title="Перетащить">
                    ⋮⋮
                  </span>
                  <label className="dashboard-columns-list__label">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleVisible(id)}
                    />
                    {labelFor(id)}
                  </label>
                  <span className="dashboard-columns-list__actions">
                    <button
                      type="button"
                      className="btn btn-default btn-xs"
                      disabled={index === 0}
                      onClick={() => move(id, -1)}
                      title="Выше"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-default btn-xs"
                      disabled={index === draft.order.length - 1}
                      onClick={() => move(id, 1)}
                      title="Ниже"
                    >
                      ↓
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="dashboard-columns-modal__footer">
          <button type="button" className="btn btn-default" onClick={handleReset} disabled={saving || loading}>
            По умолчанию
          </button>
          <button type="button" className="btn btn-default" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-success" onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
