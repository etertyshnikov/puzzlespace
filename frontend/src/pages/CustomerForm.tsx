import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  api,
  type CustomerCreate,
  type CustomerDealStatus,
  type CustomerGender,
  type CustomerAgeBracket,
  type LeadSource,
  CUSTOMER_DEAL_STATUS_LABELS,
  CUSTOMER_GENDER_LABELS,
  CUSTOMER_AGE_BRACKET_LABELS,
} from '../api/client'

/** Формат +7 (xxx) xxx-xx-xx. Из введённой строки берутся только цифры (макс. 10 после 7/8). Пустые цифры → префикс "+7 (" чтобы можно было редактировать. */
function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length >= 1) digits = '7' + digits.slice(1)
  if (digits.startsWith('7') && digits.length > 1) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  const prefix = '+7 ('
  if (digits.length === 0) return prefix
  if (digits.length <= 3) return `${prefix}${digits}`
  if (digits.length <= 6) return `+7 (${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 8) return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`
}

/** Нормализует сохранённый номер к виду +7 (xxx) xxx-xx-xx для отображения в форме. */
function normalizePhoneForDisplay(phone: string): string {
  if (!phone || !phone.trim()) return ''
  return formatPhone(phone.trim())
}

function parseBudgetInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!trimmed || trimmed === '.') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** Отображение суммы: 1 000 000 (пробелы между тысячами). */
function formatBudgetVisual(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value).replace(/\u00A0/g, ' ')
}

/** Форматирование при вводе: только цифры и необязательная дробная часть. */
function formatBudgetTyping(raw: string): string {
  const normalized = raw.replace(/\s/g, '').replace(',', '.')
  const dotIdx = normalized.indexOf('.')
  let intStr: string
  let decStr: string | undefined
  let trailingDot = false
  if (dotIdx >= 0) {
    intStr = normalized.slice(0, dotIdx).replace(/\D/g, '')
    decStr = normalized.slice(dotIdx + 1).replace(/\D/g, '').slice(0, 2)
    trailingDot = dotIdx === normalized.length - 1
  } else {
    intStr = normalized.replace(/\D/g, '')
  }
  if (!intStr && decStr === undefined && !trailingDot) return ''
  const grouped = intStr ? intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''
  if (trailingDot) return `${grouped}.`
  if (decStr !== undefined) return `${grouped || '0'}.${decStr}`
  return grouped
}

/** Возвращает true, если в строке ровно 10 цифр (полный номер). */
function isPhoneComplete(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits.startsWith('7') ? digits.slice(1) : digits
  return normalized.length >= 10
}

function formatCreatedOn(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

export function CustomerForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneExists, setPhoneExists] = useState(false)
  const [phoneChecking, setPhoneChecking] = useState(false)
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [form, setForm] = useState<CustomerCreate>({
    name: '',
    middle_name: null,
    last_name: null,
    phone: '',
    email: null,
    address: '',
    deal_status: 'in_progress',
    gender: null,
    age_bracket: null,
    lead_source_id: null,
    link: null,
    notes: null,
    comments: null,
    budget: null,
  })
  const [budgetInput, setBudgetInput] = useState('')
  const [createdOn, setCreatedOn] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    api.customers
      .get(Number(id))
      .then((c) => {
        setForm({
          name: c.name,
          middle_name: c.middle_name ?? null,
          last_name: c.last_name ?? null,
          phone: normalizePhoneForDisplay(c.phone),
          email: c.email ?? null,
          address: c.address,
          deal_status: (['in_progress', 'success', 'rejected'] as const).includes(c.deal_status) ? c.deal_status : 'in_progress',
          gender: (['male', 'female'] as const).includes(c.gender as CustomerGender) ? (c.gender as CustomerGender) : null,
          age_bracket: (['18_24', '25_30', '31_40', '41_50', '51_plus'] as const).includes(c.age_bracket as CustomerAgeBracket)
            ? (c.age_bracket as CustomerAgeBracket)
            : null,
          lead_source_id: c.lead_source_id ?? null,
          link: c.link ?? null,
          notes: c.notes ?? null,
          comments: c.comments ?? null,
          budget: c.budget ?? null,
        })
        setBudgetInput(
          c.budget != null && Number.isFinite(Number(c.budget)) ? formatBudgetVisual(Number(c.budget)) : ''
        )
        setCreatedOn(c.created_on ?? null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  useEffect(() => {
    api.leadSources
      .list()
      .then((list) =>
        setLeadSources([...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
      )
      .catch(() => setLeadSources([]))
  }, [])

  useEffect(() => {
    if (!isNew || !isPhoneComplete(form.phone)) {
      setPhoneExists(false)
      setPhoneChecking(false)
      return
    }
    setPhoneChecking(true)
    const t = setTimeout(() => {
      api.customers
        .checkPhone(form.phone)
        .then((r) => setPhoneExists(r.exists))
        .catch(() => setPhoneExists(false))
        .finally(() => setPhoneChecking(false))
    }, 400)
    return () => clearTimeout(t)
  }, [isNew, form.phone])

  const update = (
    field: keyof CustomerCreate,
    value: string | number | null | CustomerDealStatus | CustomerGender | CustomerAgeBracket
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      email: form.email?.trim() || null,
      middle_name: form.middle_name?.trim() || null,
      last_name: form.last_name?.trim() || null,
      link: form.link?.trim() || null,
      notes: form.notes?.trim() || null,
      comments: form.comments?.trim() || null,
      gender: form.gender ?? null,
      age_bracket: form.age_bracket ?? null,
      lead_source_id: form.lead_source_id ?? null,
      budget: parseBudgetInput(budgetInput),
    }
    if (isNew) {
      api.customers
        .create(payload)
        .then(() => navigate('/customers'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.customers
        .update(Number(id), payload)
        .then((updated) => navigate('/customers', { state: { updatedCustomer: updated } }))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новый клиент' : 'Редактирование клиента'}
      </h1>
      {!isNew && (
        <p className="text-sm text-slate-500 mb-6" style={{ marginTop: -16 }}>
          Создан: {formatCreatedOn(createdOn)}
        </p>
      )}

      <form onSubmit={submit} className="max-w-5xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
          <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия</label>
            <input
              type="text"
              value={form.last_name ?? ''}
              onChange={(e) => update('last_name', e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Отчество</label>
            <input
              type="text"
              value={form.middle_name ?? ''}
              onChange={(e) => update('middle_name', e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', formatPhone(e.target.value))}
            placeholder="+7 (___) ___-__-__"
            maxLength={18}
            className={`w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              phoneExists ? 'border-red-400 bg-red-50' : 'border-slate-300'
            }`}
          />
          {phoneChecking && (
            <p className="mt-1 text-sm text-slate-500">Проверка номера…</p>
          )}
          {!phoneChecking && isNew && phoneExists && (
            <p className="mt-1 text-sm text-red-600">Такой номер телефона уже зарегистрирован.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Адрес установки домокомплекта</label>
          <textarea
            rows={2}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ссылка</label>
          <input
            type="text"
            value={form.link ?? ''}
            onChange={(e) => update('link', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Примечания</label>
          <textarea
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => update('notes', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Комментарии</label>
          <textarea
            rows={2}
            value={form.comments ?? ''}
            onChange={(e) => update('comments', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
          </div>

          <div className="space-y-4 lg:border-l lg:border-slate-200 lg:pl-10 min-w-0">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Статус сделки</label>
          <select
            value={form.deal_status}
            onChange={(e) => update('deal_status', e.target.value as CustomerDealStatus)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {(['in_progress', 'success', 'rejected'] as const).map((key) => (
              <option key={key} value={key}>
                {CUSTOMER_DEAL_STATUS_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Бюджет, ₽</label>
          <input
            type="text"
            inputMode="decimal"
            value={budgetInput}
            onChange={(e) => setBudgetInput(formatBudgetTyping(e.target.value))}
            onBlur={() => {
              const n = parseBudgetInput(budgetInput)
              setBudgetInput(n != null ? formatBudgetVisual(n) : '')
            }}
            placeholder="Не указан"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
            <label htmlFor="customer-lead-source" className="text-sm font-medium text-slate-700">
              Источник лида
            </label>
            <Link
              to="/settings/lead-sources"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              Таблица источников
            </Link>
          </div>
          <select
            id="customer-lead-source"
            value={form.lead_source_id ?? ''}
            onChange={(e) => {
              const v = e.target.value
              update('lead_source_id', v === '' ? null : Number(v))
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Не выбран</option>
            {leadSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.is_active ? ' (неактивен)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">Пол</span>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-800">
              <input
                type="radio"
                name="customer-gender"
                checked={form.gender === null}
                onChange={() => update('gender', null)}
              />
              Не указано
            </label>
            {(['male', 'female'] as const).map((g) => (
              <label key={g} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                <input
                  type="radio"
                  name="customer-gender"
                  checked={form.gender === g}
                  onChange={() => update('gender', g)}
                />
                {CUSTOMER_GENDER_LABELS[g]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">Возраст</span>
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-800">
              <input
                type="radio"
                name="customer-age"
                checked={form.age_bracket === null}
                onChange={() => update('age_bracket', null)}
              />
              Не указано
            </label>
            {(['18_24', '25_30', '31_40', '41_50', '51_plus'] as const).map((a) => (
              <label key={a} className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                <input
                  type="radio"
                  name="customer-age"
                  checked={form.age_bracket === a}
                  onChange={() => update('age_bracket', a)}
                />
                {CUSTOMER_AGE_BRACKET_LABELS[a]}
              </label>
            ))}
          </div>
        </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || (isNew && phoneExists)}
            className="btn btn-success"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
