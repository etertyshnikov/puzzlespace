import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type NomenclatureItemCreate } from '../api/client'

export function NomenclatureItemForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [form, setForm] = useState<NomenclatureItemCreate>({
    item_number: '',
    name: '',
    part_id: null,
    unit: 'шт',
    unit_alt: '',
    total_cost: 0,
    price_alt: null,
    description: '',
  })

  useEffect(() => {
    api.parts.list().then(setParts).catch(() => setParts([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.nomenclatureItems
      .get(Number(id))
      .then((r) =>
        setForm({
          item_number: r.item_number,
          name: r.name ?? '',
          part_id: r.part_id ?? null,
          unit: r.unit,
          unit_alt: r.unit_alt ?? '',
          total_cost: r.total_cost,
          price_alt: r.price_alt ?? null,
          description: r.description ?? '',
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof NomenclatureItemCreate, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isNew && !form.item_number?.trim()) {
      setError('Введите номер позиции.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      item_number: form.item_number?.trim() || undefined,
      name: form.name?.trim() || undefined,
      unit_alt: form.unit_alt?.trim() || undefined,
      description: form.description?.trim() || undefined,
    }
    if (isNew) {
      api.nomenclatureItems
        .create(payload)
        .then(() => navigate('/settings/nomenclature-items'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.nomenclatureItems
        .update(Number(id), payload)
        .then(() => navigate('/settings/nomenclature-items'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая позиция номенклатуры' : 'Редактирование позиции номенклатуры'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Номер позиции {isNew ? '(оставьте пустым для авто: POZ_N000001)' : '*'}
          </label>
          <input
            type="text"
            value={form.item_number ?? ''}
            onChange={(e) => update('item_number', e.target.value)}
            placeholder={isNew ? 'POZ_N000001' : ''}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
          <input
            type="text"
            value={form.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Название позиции"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Часть дома</label>
          <select
            value={form.part_id ?? ''}
            onChange={(e) => update('part_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Единицы измерения альтернативные</label>
          <input
            type="text"
            value={form.unit_alt ?? ''}
            onChange={(e) => update('unit_alt', e.target.value)}
            placeholder="например, м², п.м."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Общая стоимость</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.total_cost}
            onChange={(e) => update('total_cost', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Альтернативная цена</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.price_alt ?? ''}
            onChange={(e) => update('price_alt', e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
          <input
            type="text"
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
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
            onClick={() => navigate('/settings/nomenclature-items')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
