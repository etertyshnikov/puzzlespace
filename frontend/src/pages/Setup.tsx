import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export function Setup() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [nic, setNic] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.auth.hasUsers()
      .then((r) => {
        if (r.has_users) navigate('/login', { replace: true })
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [navigate])

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Проверка…</div>
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nic.trim()) { setError('Введите логин'); return }
    if (password.length < 4) { setError('Пароль должен быть минимум 4 символа'); return }
    if (password !== password2) { setError('Пароли не совпадают'); return }
    setSaving(true)
    try {
      const resp = await api.auth.setup({
        nic: nic.trim(),
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
      })
      localStorage.setItem('access_token', resp.access_token)
      localStorage.setItem('auth_user', JSON.stringify(resp.user))
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания пользователя')
    } finally {
      setSaving(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    padding: '40px 36px',
    width: 400,
    maxWidth: '90vw',
  }

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 4, fontSize: 14, color: '#555' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 15 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f7' }}>
      <div style={cardStyle}>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontWeight: 600, fontSize: 22 }}>СметаДома</h2>
        <p style={{ textAlign: 'center', color: '#73879C', fontSize: 14, marginBottom: 24 }}>
          Создайте первого пользователя (администратора)
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Логин *</label>
            <input style={inputStyle} value={nic} onChange={(e) => setNic(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Пароль *</label>
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Подтвердите пароль *</label>
            <input style={inputStyle} type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Имя</label>
            <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Фамилия</label>
            <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && (
            <div style={{ color: '#E74C3C', marginBottom: 12, fontSize: 14, textAlign: 'center' }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 0', fontSize: 16, borderRadius: 4 }}
          >
            {saving ? 'Создание…' : 'Создать и войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
