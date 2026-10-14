import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type NomenclatureItem, type RequiredItemMaterialCreate } from '../api/client'

function nomenclatureOptionLabel(n: NomenclatureItem): string {
  const title = n.name?.trim()
  if (title) return title
  return n.item_number
}

export function RequiredItemMaterialForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [nomenclature, setNomenclature] = useState<NomenclatureItem[]>([])
  const [form, setForm] = useState<RequiredItemMaterialCreate>({
    required_item_template_id: 0,
    nomenclature_id: 0,
  })

  useEffect(() => {
    api.requiredItemTemplates.list().then(setTemplates).catch(() => setTemplates([]))
    api.nomenclatureItems.list({ limit: 2000 }).then(setNomenclature).catch(() => setNomenclature([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.requiredItemMaterials
      .get(Number(id))
      .then((r) =>
        setForm({
          required_item_template_id: r.required_item_template_id,
          nomenclature_id: r.nomenclature_id,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.required_item_template_id || !form.nomenclature_id) {
      setError('Выберите шаблон и позицию номенклатуры.')
      return
    }
    setSaving(true)
    setError(null)
    if (isNew) {
      api.requiredItemMaterials
        .create(form)
        .then(() => navigate('/settings/required-item-materials'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.requiredItemMaterials
        .update(Number(id), form)
        .then(() => navigate('/settings/required-item-materials'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Добавить допустимый материал' : 'Редактирование допустимого материала'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Шаблон обязательной позиции *</label>
          <select
            value={form.required_item_template_id || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, required_item_template_id: parseInt(e.target.value, 10) || 0 }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Позиция номенклатуры *</label>
          <select
            value={form.nomenclature_id || ''}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, nomenclature_id: parseInt(e.target.value, 10) || 0 }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {nomenclature.map((n) => (
              <option key={n.id} value={n.id}>{nomenclatureOptionLabel(n)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-success"
          >
            {saving ? 'Сохранение…' : isNew ? 'Сохранить' : 'Сохранить изменения'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings/required-item-materials')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
