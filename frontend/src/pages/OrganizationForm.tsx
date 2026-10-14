import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Company, type OrganizationCreate } from '../api/client'

const fields: { key: keyof OrganizationCreate; label: string; type?: string }[] = [
  { key: 'name', label: 'Название *' },
  { key: 'inn', label: 'ИНН' },
  { key: 'kpp', label: 'КПП' },
  { key: 'address', label: 'Юридический адрес' },
  { key: 'bank', label: 'Банк' },
  { key: 'bank_account', label: 'Расчётный счёт' },
  { key: 'bik', label: 'БИК' },
  { key: 'director_name', label: 'ФИО руководителя' },
  { key: 'director_position', label: 'Должность руководителя' },
]

const initialForm: OrganizationCreate = {
  company_id: null,
  name: '',
  inn: null,
  kpp: null,
  address: null,
  bank: null,
  bank_account: null,
  bik: null,
  director_name: null,
  director_position: null,
  is_default: false,
}

export function OrganizationForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState<OrganizationCreate>(initialForm)

  useEffect(() => {
    api.companies.list().then(setCompanies).catch(() => setCompanies([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.organizations
      .get(Number(id))
      .then((o) =>
        setForm({
          company_id: o.company_id ?? null,
          name: o.name,
          inn: o.inn ?? null,
          kpp: o.kpp ?? null,
          address: o.address ?? null,
          bank: o.bank ?? null,
          bank_account: o.bank_account ?? null,
          bik: o.bik ?? null,
          director_name: o.director_name ?? null,
          director_position: o.director_position ?? null,
          is_default: o.is_default ?? false,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof OrganizationCreate, value: string | boolean | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value === '' ? null : value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название организации.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: OrganizationCreate = {
      company_id: form.company_id ?? null,
      name: form.name.trim(),
      inn: form.inn?.trim() || null,
      kpp: form.kpp?.trim() || null,
      address: form.address?.trim() || null,
      bank: form.bank?.trim() || null,
      bank_account: form.bank_account?.trim() || null,
      bik: form.bik?.trim() || null,
      director_name: form.director_name?.trim() || null,
      director_position: form.director_position?.trim() || null,
      is_default: form.is_default ?? false,
    }
    if (isNew) {
      api.organizations
        .create(payload)
        .then(() => navigate('/settings/organizations'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.organizations
        .update(Number(id), payload)
        .then(() => navigate('/settings/organizations'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая организация' : 'Редактирование организации'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{error}</div>
        )}
        <div>
          <label htmlFor="organization-company" className="block text-sm font-medium text-slate-700 mb-1">
            Компания
          </label>
          <select
            id="organization-company"
            value={form.company_id ?? ''}
            onChange={(e) => {
              const v = e.target.value
              update('company_id', v === '' ? null : Number(v))
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Не выбрана</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <input
              type="text"
              required={key === 'name'}
              value={String(form[key] ?? '')}
              onChange={(e) => update(key, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_default"
            checked={form.is_default ?? false}
            onChange={(e) => update('is_default', e.target.checked)}
            className="rounded border-slate-300 text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="is_default" className="text-sm font-medium text-slate-700">
            Организация по умолчанию (в рамках компании)
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-success">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => navigate('/settings/organizations')} className="btn btn-default">
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
