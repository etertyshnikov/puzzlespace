import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type SpecificationRequiredItemCreate } from '../api/client'

export function SpecificationRequiredItemForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specs, setSpecs] = useState<{ id: number }[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [form, setForm] = useState<SpecificationRequiredItemCreate>({
    spec_id: 0,
    part_id: 0,
    template_id: 0,
    required_qty: 0,
    added_qty: 0,
  })

  useEffect(() => {
    api.specifications.list().then(setSpecs).catch(() => setSpecs([]))
    api.parts.list().then(setParts).catch(() => setParts([]))
    api.requiredItemTemplates.list().then(setTemplates).catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.specificationRequiredItems
      .get(Number(id))
      .then((r) =>
        setForm({
          spec_id: r.spec_id,
          part_id: r.part_id,
          template_id: r.template_id,
          required_qty: r.required_qty,
          added_qty: r.added_qty,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof SpecificationRequiredItemCreate, value: number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.spec_id || !form.part_id || !form.template_id) {
      setError('Заполните спецификацию, часть дома и шаблон.')
      return
    }
    setSaving(true)
    setError(null)
    if (isNew) {
      api.specificationRequiredItems
        .create(form)
        .then(() => navigate('/settings/specification-required-items'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.specificationRequiredItems
        .update(Number(id), form)
        .then(() => navigate('/settings/specification-required-items'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая обязательная позиция в спецификации' : 'Редактирование обязательной позиции'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Спецификация *</label>
          <select
            value={form.spec_id || ''}
            onChange={(e) => update('spec_id', parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {specs.map((s) => (
              <option key={s.id} value={s.id}>#{s.id}</option>
            ))}
          </select>
        </div>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Шаблон обязательной позиции *</label>
          <select
            value={form.template_id || ''}
            onChange={(e) => update('template_id', parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Требуемое количество</label>
          <input
            type="number"
            min={0}
            value={form.required_qty}
            onChange={(e) => update('required_qty', parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Добавлено</label>
          <input
            type="number"
            min={0}
            value={form.added_qty}
            onChange={(e) => update('added_qty', parseInt(e.target.value, 10) || 0)}
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
            onClick={() => navigate('/settings/specification-required-items')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
