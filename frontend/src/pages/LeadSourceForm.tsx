import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type LeadSourceCreate } from '../api/client'

export function LeadSourceForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<LeadSourceCreate>({
    name: '',
    is_active: true,
    sort_order: 0,
  })

  useEffect(() => {
    if (isNew) return
    api.leadSources
      .get(Number(id))
      .then((s) =>
        setForm({
          name: s.name,
          is_active: s.is_active,
          sort_order: s.sort_order,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof LeadSourceCreate, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название источника лидов.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { name: form.name.trim(), is_active: form.is_active, sort_order: form.sort_order ?? 0 }
    if (isNew) {
      api.leadSources
        .create(payload)
        .then(() => navigate('/settings/lead-sources'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.leadSources
        .update(Number(id), payload)
        .then(() => navigate('/settings/lead-sources'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новый источник лидов' : 'Редактирование источника лидов'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => update('is_active', e.target.checked)}
            className="rounded border-slate-300 text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Активен</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Порядок сортировки</label>
          <input
            type="number"
            min={0}
            value={form.sort_order ?? 0}
            onChange={(e) => update('sort_order', parseInt(e.target.value, 10) || 0)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            onClick={() => navigate('/settings/lead-sources')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
