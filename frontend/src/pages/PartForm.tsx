import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PartCreate } from '../api/client'

export function PartForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PartCreate>({ name: '' })

  useEffect(() => {
    if (isNew) return
    api.parts
      .get(Number(id))
      .then((p) => setForm({ name: p.name }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { name: form.name.trim() }
    if (isNew) {
      api.parts.create(payload).then(() => navigate('/settings/parts')).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setSaving(false))
    } else {
      api.parts.update(Number(id), payload).then(() => navigate('/settings/parts')).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setSaving(false))
    }
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>

  return (
    <div>
      <div className="page-title">
        <h2>{isNew ? 'Новая часть дома' : 'Редактирование части дома'}</h2>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <form onSubmit={submit}>
            {error && (
              <div style={{ marginBottom: 15, padding: '8px 12px', background: '#fde8e8', border: '1px solid #E74C3C', color: '#E74C3C', borderRadius: 3 }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="control-label">Название *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                className="form-control"
              />
            </div>
            <div style={{ marginTop: 15 }}>
              <button type="submit" disabled={saving} className="btn btn-success">
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" onClick={() => navigate('/settings/parts')} className="btn btn-default">
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
