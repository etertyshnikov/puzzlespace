import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type AuthUserOut, type CaptchaChallenge, type InvitePreview, type RegisterLinkPreview } from '../api/client'
import './register-form.css'

type RegisterMode = 'invite' | 'ref'

export function RegisterInvite() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') || ''
  const refToken = searchParams.get('ref') || ''
  const mode: RegisterMode | null = refToken ? 'ref' : inviteToken ? 'invite' : null
  const navigate = useNavigate()

  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [linkPreview, setLinkPreview] = useState<RegisterLinkPreview | null>(null)
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nic, setNic] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [registeredUser, setRegisteredUser] = useState<AuthUserOut | null>(null)

  const isAgentInvite = mode === 'invite' && invitePreview?.target_hierarchy_level === 2
  const showNicField = mode === 'invite' && !isAgentInvite
  const nicReadOnly = mode === 'invite' && !!invitePreview?.nic

  const loadCaptcha = useCallback(() => {
    return api.registerLinks.captcha().then(setCaptcha).catch(() => setCaptcha(null))
  }, [])

  useEffect(() => {
    if (!mode) {
      setError('Нет кода приглашения или ссылки регистрации')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    if (mode === 'invite') {
      api.invites
        .preview(inviteToken)
        .then((p) => {
          setInvitePreview(p)
          if (p.nic) setNic(p.nic)
          if (p.first_name) setFirstName(p.first_name)
          if (p.last_name) setLastName(p.last_name)
          if (p.email) setEmail(p.email)
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false))
      return
    }

    Promise.all([api.registerLinks.preview(refToken), loadCaptcha()])
      .then(([p]) => setLinkPreview(p))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [mode, inviteToken, refToken, loadCaptcha])

  const finishRegistration = (user: AuthUserOut, accessToken: string) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('auth_user', JSON.stringify(user))
    setRegisteredUser(user)
  }

  const goToDashboard = () => {
    navigate('/dashboard', { replace: true })
    window.location.reload()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (showNicField && !nic.trim()) {
      setError('Введите логин')
      return
    }

    if (password.length < 4) {
      setError('Пароль минимум 4 символа')
      return
    }

    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }

    if (mode === 'ref') {
      if (!captcha) {
        setError('Не удалось загрузить капчу')
        return
      }
      const answer = Number(captchaAnswer.trim())
      if (!Number.isFinite(answer)) {
        setError('Введите ответ на пример')
        return
      }
    }

    setSaving(true)
    try {
      const resp =
        mode === 'ref'
          ? await api.auth.registerByLink({
              ref: refToken,
              password,
              first_name: firstName.trim() || undefined,
              last_name: lastName.trim() || undefined,
              email: email.trim() || undefined,
              challenge_id: captcha!.challenge_id,
              captcha_answer: Number(captchaAnswer.trim()),
            })
          : await api.auth.registerInvite({
              token: inviteToken,
              nic: showNicField ? nic.trim() : undefined,
              password,
              first_name: firstName.trim() || undefined,
              last_name: lastName.trim() || undefined,
              email: email.trim() || undefined,
            })

      finishRegistration(resp.user, resp.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      if (mode === 'ref') {
        await loadCaptcha()
        setCaptchaAnswer('')
      }
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = mode === 'ref' ? 'Регистрация в команду' : 'Регистрация по приглашению'

  if (loading) {
    return <div className="register-page__loading">Загрузка…</div>
  }

  const hasPreview = mode === 'invite' ? !!invitePreview : !!linkPreview

  if (!hasPreview && error) {
    return (
      <div className="register-page">
        <div className="register-page__panel x_panel">
          <div className="x_content">
            <p className="register-form__error" style={{ marginBottom: 16 }}>{error}</p>
            <a href="/login" className="btn btn-default register-form__submit">На страницу входа</a>
          </div>
        </div>
      </div>
    )
  }

  if (registeredUser) {
    return (
      <div className="register-page register-page--top">
        <div className="register-page__panel x_panel">
          <div className="x_title">
            <h2>Регистрация завершена</h2>
          </div>
          <div className="x_content">
            <p className="register-page__meta" style={{ marginBottom: 16 }}>
              Ваш логин: <strong>{registeredUser.nic}</strong>
            </p>
            <p className="register-page__meta" style={{ marginBottom: 20 }}>
              Для входа используйте логин{registeredUser.email ? ' или email' : ''} и пароль.
            </p>
            <button type="button" className="btn btn-success register-form__submit" onClick={goToDashboard}>
              Перейти в систему
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="register-page register-page--top">
      <div className="register-page__panel x_panel">
        <div className="x_title">
          <h2>{pageTitle}</h2>
        </div>
        <div className="x_content">
          {mode === 'invite' && invitePreview && (
            <p className="register-page__meta">
              Роль: <strong>{invitePreview.level_label}</strong>
              {invitePreview.inviter_name && <> · Пригласил: {invitePreview.inviter_name}</>}
              {invitePreview.parent_name && invitePreview.target_hierarchy_level === 2 && (
                <> · Наставник: {invitePreview.parent_name}</>
              )}
            </p>
          )}
          {mode === 'ref' && linkPreview && (
            <p className="register-page__meta">
              Роль: <strong>{linkPreview.level_label}</strong>
              {' · '}Менеджер: <strong>{linkPreview.manager_name}</strong>
            </p>
          )}
          {mode === 'ref' && (
            <p className="register-page__meta" style={{ marginTop: 8 }}>
              Логин будет создан автоматически после регистрации.
            </p>
          )}
          {isAgentInvite && !invitePreview?.nic && (
            <p className="register-page__meta" style={{ marginTop: 8 }}>
              Логин агента будет создан автоматически.
            </p>
          )}

          {error && <div className="register-form__error" style={{ marginBottom: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="register-form">
            {showNicField && (
              <div className="register-form__field">
                <label>Логин</label>
                <input
                  className="register-form__input"
                  value={nic}
                  onChange={(e) => setNic(e.target.value)}
                  readOnly={nicReadOnly}
                  autoComplete="username"
                  enterKeyHint="next"
                />
              </div>
            )}

            <div className="register-form__row-2">
              <div className="register-form__field">
                <label>Имя</label>
                <input
                  className="register-form__input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="register-form__field">
                <label>Фамилия</label>
                <input
                  className="register-form__input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="register-form__field">
              <label>Email</label>
              <input
                type="email"
                className="register-form__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="register-form__field">
              <label>Пароль</label>
              <input
                type="password"
                className="register-form__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="register-form__field">
              <label>Повтор пароля</label>
              <input
                type="password"
                className="register-form__input"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {mode === 'ref' && captcha && (
              <div className="register-form__field register-form__captcha">
                <label>Сколько будет {captcha.question}?</label>
                <div className="register-form__captcha-row">
                  <input
                    className="register-form__input"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => {
                      loadCaptcha()
                      setCaptchaAnswer('')
                    }}
                  >
                    Другой пример
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-success register-form__submit" disabled={saving}>
              {saving ? 'Регистрация…' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
