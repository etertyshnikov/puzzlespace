import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.auth.hasUsers().then((r) => {
      if (!r.has_users) navigate('/setup', { replace: true })
    }).catch(() => {})
  }, [navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginId.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f7f7',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        padding: '40px 36px',
        width: 360,
        maxWidth: '90vw',
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24, fontWeight: 600, fontSize: 22 }}>
          СметаДома
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14, color: '#555' }}>Логин или email</label>
            <input
              type="text"
              className="form-control"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="ivanov или name@mail.ru"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 15 }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14, color: '#555' }}>Пароль</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 15 }}
            />
          </div>
          {error && (
            <div style={{ color: '#E74C3C', marginBottom: 12, fontSize: 14, textAlign: 'center' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 0', fontSize: 16, borderRadius: 4 }}
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
