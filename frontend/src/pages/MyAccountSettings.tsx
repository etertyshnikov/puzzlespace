import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'

export function MyAccountSettings() {
  const { user, refreshUser } = useAuth()
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setEmail(user?.email ?? '')
  }, [user?.email])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const emailChanged = email.trim() !== (user?.email ?? '').trim()
    const passwordChanged = Boolean(newPassword || currentPassword)

    if (!emailChanged && !passwordChanged) {
      setError('Измените email или пароль')
      return
    }

    if (passwordChanged) {
      if (!currentPassword) {
        setError('Укажите текущий пароль')
        return
      }
      if (newPassword.length < 4) {
        setError('Новый пароль минимум 4 символа')
        return
      }
      if (newPassword !== newPassword2) {
        setError('Новые пароли не совпадают')
        return
      }
    }

    setSaving(true)
    try {
      await api.auth.updateProfile({
        email: email.trim() || null,
        current_password: passwordChanged ? currentPassword : undefined,
        new_password: passwordChanged ? newPassword : undefined,
      })
      await refreshUser()
      setCurrentPassword('')
      setNewPassword('')
      setNewPassword2('')
      setSuccess('Изменения сохранены')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="x_panel">
      <div className="x_title">
        <h2>Мой аккаунт</h2>
      </div>
      <div className="x_content">
        <p style={{ marginTop: 0, marginBottom: 20, color: '#73879C', fontSize: 14 }}>
          Логин: <strong>{user?.nic}</strong>
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm mb-3">
            {success}
          </div>
        )}

        <form onSubmit={submit} style={{ maxWidth: 420 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div style={{ margin: '24px 0 12px', fontWeight: 600, fontSize: 14 }}>Сменить пароль</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Текущий пароль</label>
            <input
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Новый пароль</label>
            <input
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Повтор нового пароля</label>
            <input
              type="password"
              className="form-control"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-success" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}
