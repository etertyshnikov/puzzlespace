import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type RequiredItemTemplateCreate } from '../api/client'

export function RequiredItemTemplateForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [form, setForm] = useState<RequiredItemTemplateCreate>({ part_id: 0, name: '', required_qty: 1, unit: 'шт' })

  useEffect(() => {
    api.parts.list().then(setParts).catch(() => setParts([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.requiredItemTemplates
      .get(Number(id))
      .then((r) =>
        setForm({
          part_id: r.part_id,
          name: r.name,
          required_qty: r.required_qty,
          unit: r.unit,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof RequiredItemTemplateCreate, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название.')
      return
    }
    if (!form.part_id) {
      setError('Выберите часть дома.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { ...form, name: form.name.trim() }
    if (isNew) {
      api.requiredItemTemplates
        .create(payload)
        .then(() => navigate('/settings/required-item-templates'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.requiredItemTemplates
        .update(Number(id), payload)
        .then(() => navigate('/settings/required-item-templates'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая позиция части дома' : 'Редактирование позиции части дома'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Часть дома *</label>
          <select
            value={form.part_id || ''}
            onChange={(e) => update('part_id', parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Обязательное количество</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.required_qty}
            onChange={(e) => update('required_qty', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Единица измерения</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-success"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings/required-item-templates')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
