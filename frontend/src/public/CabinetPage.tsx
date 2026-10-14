import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { isAdminUser } from '../utils/userRoles'
import { portalApi, portalToken, setPortalToken } from './portalApi'
import { PublicShell } from './PublicShell'

type Listing = { id: number; title: string; status: string; kind: string }

export function CabinetPage() {
  const [admin, setAdmin] = useState(false)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<Listing[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const staff = localStorage.getItem('access_token')
    if (staff) {
      api.auth.me().then((user) => setAdmin(isAdminUser(user))).catch(() => setAdmin(false))
    }
    if (!portalToken()) {
      setReady(true)
      return
    }
    portalApi.me().then((user) => {
      setName(user.name)
      return portalApi.listings()
    }).then((list) => setRows(list || [])).catch(() => setPortalToken(null)).finally(() => setReady(true))
  }, [])

  if (!ready) return <PublicShell title="Личный кабинет"><p>Загрузка…</p></PublicShell>
  return (
    <PublicShell title="Личный кабинет">
      <section className="dom-card">
        <a className="dom-btn" href="https://puzzlespace.ru/login">Смета дома СРМ</a>
      </section>
      {admin && (
        <section className="dom-card">
          <p>Вы вошли как администратор системы.</p>
          <a className="dom-btn" href="/dashboard">Открыть дашборд</a>
        </section>
      )}
      {!portalToken() && (
        <section className="dom-card">
          <p>Для объявлений нужна регистрация по электронной почте.</p>
          <p><Link className="dom-btn" to="/portal/register">Регистрация</Link></p>
          <p><Link to="/portal/login">Вход</Link></p>
        </section>
      )}
      {portalToken() && (
        <section className="dom-card">
          <p>Здравствуйте, {name}.</p>
          <p>Новые объявления сначала попадают на модерацию и не публикуются сами.</p>
          <p>
            <Link to="/board/vacancy">Вакансия</Link>{' · '}
            <Link to="/board/resume">Резюме</Link>{' · '}
            <Link to="/board/sell">Продать участок</Link>{' · '}
            <Link to="/board/buy">Купить участок</Link>
          </p>
          <ul>
            {rows.map((row) => <li key={row.id}>{row.title} — {row.status}</li>)}
            {rows.length === 0 && <li>Пока нет объявлений.</li>}
          </ul>
          <button type="button" className="dom-btn secondary" onClick={() => { setPortalToken(null); window.location.href = '/cabinet' }}>Выйти</button>
        </section>
      )}
    </PublicShell>
  )
}

export function PortalAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/cabinet'
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const body = mode === 'login'
        ? { email: form.get('email'), password: form.get('password') }
        : {
            email: form.get('email'),
            password: form.get('password'),
            name: form.get('name'),
            phone: form.get('phone'),
            pd_consent: consent,
          }
      const resp = mode === 'login' ? await portalApi.login(body) : await portalApi.register(body)
      setPortalToken(resp.access_token)
      navigate(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }
  return (
    <PublicShell title={mode === 'login' ? 'Вход' : 'Регистрация'}>
      <form className="dom-card" onSubmit={onSubmit}>
        {error && <p className="dom-error">{error}</p>}
        {mode === 'register' && (
          <>
            <label>Имя<input name="name" required /></label>
            <label>Телефон<input name="phone" /></label>
          </>
        )}
        <label>Электронная почта<input name="email" type="email" required /></label>
        <label>Пароль<input name="password" type="password" minLength={8} required /></label>
        {mode === 'register' && (
          <label className="dom-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>Даю согласие на обработку персональных данных и принимаю <Link to="/legal/consent">согласие</Link> и <Link to="/legal/privacy">политику</Link>.</span>
          </label>
        )}
        <button className="dom-btn" type="submit">{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
      </form>
    </PublicShell>
  )
}
