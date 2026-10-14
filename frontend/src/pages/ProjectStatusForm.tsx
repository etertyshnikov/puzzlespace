import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type ProjectStatusCreate } from '../api/client'

export function ProjectStatusForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectStatusCreate>({
    name: '',
    description: null,
    action: null,
    execution_days: null,
    sort_order: 0,
    is_active: true,
  })

  useEffect(() => {
    if (isNew) return
    api.projectStatuses
      .get(Number(id))
      .then((s) =>
        setForm({
          name: s.name,
          description: s.description ?? null,
          action: s.action ?? null,
          execution_days: s.execution_days ?? null,
          sort_order: s.sort_order,
          is_active: s.is_active,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof ProjectStatusCreate, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      action: form.action?.trim() || null,
      execution_days: (() => {
        if (form.execution_days == null) return null
        const n = Number(form.execution_days)
        if (!Number.isFinite(n) || n < 0) return null
        return Math.floor(n)
      })(),
      sort_order: form.sort_order ?? 0,
      is_active: form.is_active ?? true,
    }
    const afterSave = (saved: { action?: string | null; execution_days?: number | null }) => {
      const actionLost = Boolean(payload.action?.trim()) && !saved.action?.trim()
      const daysLost = payload.execution_days != null && saved.execution_days == null
      if (actionLost || daysLost) {
        setError(
          'Действие / Время исполнения не записались в БД. Выполните: python -m app.migrations.apply && sudo systemctl restart smetadoma05',
        )
        return
      }
      navigate('/settings/project-statuses')
    }
    if (isNew) {
      api.projectStatuses
        .create(payload)
        .then(afterSave)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.projectStatuses
        .update(Number(id), payload)
        .then(afterSave)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>

  return (
    <div>
      <div className="page-title"><h2>{isNew ? 'Новый статус проекта' : 'Редактирование статуса'}</h2></div>
      <div className="x_panel">
        <div className="x_content">
          <form onSubmit={submit}>
            {error && (
              <div style={{ marginBottom: 15, padding: '8px 12px', background: '#fde8e8', border: '1px solid #E74C3C', color: '#E74C3C', borderRadius: 3 }}>{error}</div>
            )}
            <div className="form-group">
              <label className="control-label">Название *</label>
              <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className="form-control" />
            </div>
            <div className="form-group">
              <label className="control-label">Описание</label>
              <textarea rows={2} value={form.description ?? ''} onChange={(e) => update('description', e.target.value || null)} className="form-control" />
            </div>
            <div className="form-group">
              <label className="control-label">Действие</label>
              <input
                type="text"
                value={form.action ?? ''}
                onChange={(e) => update('action', e.target.value || null)}
                className="form-control"
                placeholder="Например: Позвонить, отправить КП"
              />
            </div>
            <div className="form-group">
              <label className="control-label">Время исполнения (дней)</label>
              <input
                type="number"
                min={0}
                value={form.execution_days ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (v === '') {
                    update('execution_days', null)
                    return
                  }
                  const n = parseInt(v, 10)
                  update('execution_days', Number.isNaN(n) ? null : n)
                }}
                className="form-control"
                style={{ width: 120 }}
                placeholder="Например: 2"
              />
            </div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="control-label">Порядок сортировки</label>
                <input type="number" min={0} value={form.sort_order ?? 0} onChange={(e) => update('sort_order', parseInt(e.target.value, 10) || 0)} className="form-control" style={{ width: 100 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="is_active" checked={form.is_active ?? true} onChange={(e) => update('is_active', e.target.checked)} />
                <label htmlFor="is_active" className="control-label" style={{ marginBottom: 0 }}>Активен</label>
              </div>
            </div>
            <div style={{ marginTop: 15 }}>
              <button type="submit" disabled={saving} className="btn btn-success">{saving ? 'Сохранение…' : 'Сохранить'}</button>
              <button type="button" onClick={() => navigate('/settings/project-statuses')} className="btn btn-default">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
