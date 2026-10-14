import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type UserRoleOut } from '../api/client'

export function UserForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<UserRoleOut[]>([])
  const [form, setForm] = useState({
    nic: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    role_id: '' as string,
  })

  useEffect(() => {
    api.users.roles().then(setRoles).catch(() => setRoles([]))
  }, [])

  useEffect(() => {
    if (isNew) return
    api.users.list()
      .then((users) => {
        const u = users.find((x) => x.id === Number(id))
        if (!u) { setError('Пользователь не найден'); setLoading(false); return }
        setForm({
          nic: u.nic,
          password: '',
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          email: u.email ?? '',
          role_id: u.role_id != null ? String(u.role_id) : '',
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isNew) {
      if (!form.nic || !form.password) {
        setError('Логин и пароль обязательны')
        return
      }
      setSaving(true)
      api.users.create({
        nic: form.nic,
        password: form.password,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        role_id: form.role_id ? Number(form.role_id) : undefined,
      })
        .then(() => navigate('/settings/users'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      setSaving(true)
      api.users.update(Number(id), {
        nic: form.nic || undefined,
        password: form.password || undefined,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        role_id: form.role_id ? Number(form.role_id) : undefined,
      })
        .then(() => navigate('/settings/users'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новый пользователь' : 'Редактирование пользователя'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Логин *</label>
          <input
            value={form.nic}
            onChange={(e) => setForm({ ...form, nic: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Пароль{isNew ? ' *' : ' (оставьте пустым, чтобы не менять)'}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            {...(isNew ? { required: true } : {})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Имя</label>
          <input
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия</label>
          <input
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Роль</label>
          <select
            value={form.role_id}
            onChange={(e) => setForm({ ...form, role_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">— не выбрана —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.description || r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-success">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => navigate('/settings/users')} className="btn btn-default">
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
