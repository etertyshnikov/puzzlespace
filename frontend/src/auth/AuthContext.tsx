import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { api, type AuthUserOut } from '../api/client'

interface AuthState {
  token: string | null
  user: AuthUserOut | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [user, setUser] = useState<AuthUserOut | null>(() => {
    try {
      const s = localStorage.getItem('auth_user')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(!!token)
  const initialCheckDone = useRef(false)

  useEffect(() => {
    if (initialCheckDone.current) return
    initialCheckDone.current = true
    if (!token) { setLoading(false); return }
    api.auth.me()
      .then((u) => {
        setUser(u)
        localStorage.setItem('auth_user', JSON.stringify(u))
      })
      .catch(() => {
        setToken(null)
        setUser(null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('auth_user')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener('auth-expired', onExpired)
    return () => window.removeEventListener('auth-expired', onExpired)
  }, [])

  const login = useCallback(async (login: string, password: string) => {
    const resp = await api.auth.login(login, password)
    localStorage.setItem('access_token', resp.access_token)
    localStorage.setItem('auth_user', JSON.stringify(resp.user))
    setToken(resp.access_token)
    setUser(resp.user)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await api.auth.me()
    setUser(u)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
