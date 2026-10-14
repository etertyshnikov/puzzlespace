import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, type CompanyCreate, type Organization } from '../api/client'

export function CompanyForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyCreate>({
    name: '',
    code: null,
    description: null,
    is_active: true,
  })
  const [organizations, setOrganizations] = useState<Organization[]>([])

  useEffect(() => {
    if (isNew) return
    const companyId = Number(id)
    Promise.all([api.companies.get(companyId), api.companies.listOrganizations(companyId)])
      .then(([c, orgs]) => {
        setForm({
          name: c.name,
          code: c.code ?? null,
          description: c.description ?? null,
          is_active: c.is_active,
        })
        setOrganizations(orgs)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof CompanyCreate, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название компании.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: CompanyCreate = {
      name: form.name.trim(),
      code: form.code?.trim() || null,
      description: form.description?.trim() || null,
      is_active: form.is_active,
    }
    if (isNew) {
      api.companies
        .create(payload)
        .then(() => navigate('/settings/companies'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.companies
        .update(Number(id), payload)
        .then(() => navigate('/settings/companies'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая компания' : 'Редактирование компании'}
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Код</label>
          <input
            type="text"
            value={form.code ?? ''}
            onChange={(e) => update('code', e.target.value || null)}
            placeholder="Краткий код, необязательно"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
          <textarea
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-800">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />
            Активна
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-success">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => navigate('/settings/companies')} className="btn btn-default">
            Отмена
          </button>
        </div>
      </form>
      {!isNew && (
        <div className="max-w-xl mt-8">
          <h3 className="text-lg font-medium text-slate-800 mb-3">Организации компании</h3>
          {organizations.length === 0 ? (
            <p style={{ color: '#73879C' }}>Нет организаций. Добавьте в разделе «Организации».</p>
          ) : (
            <ul className="space-y-2">
              {organizations.map((o) => (
                <li key={o.id}>
                  <Link to={`/settings/organizations/${o.id}/edit`} className="text-primary-600 hover:underline">
                    {o.name}
                  </Link>
                  {o.is_default ? ' · по умолчанию' : ''}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3">
            <Link to={`/settings/organizations?company_id=${id}`} className="text-sm text-primary-600 hover:underline">
              Все организации компании
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
