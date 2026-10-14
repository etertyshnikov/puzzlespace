import { useCallback, useEffect, useState } from 'react'
import { api, type RegistrationLinkOut } from '../api/client'

type Props = {
  visible: boolean
}

export function RegistrationLinkPanel({ visible }: Props) {
  const [linkInfo, setLinkInfo] = useState<RegistrationLinkOut | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  const reload = useCallback(() => {
    if (!visible) return
    setLoading(true)
    setError(null)
    api.team
      .registrationLink()
      .then(setLinkInfo)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [visible])

  useEffect(() => {
    reload()
  }, [reload])

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      alert('Ссылка скопирована')
    } catch {
      prompt('Скопируйте ссылку:', url)
    }
  }

  const ensureLink = async () => {
    setSaving(true)
    setError(null)
    try {
      const info = await api.team.ensureRegistrationLink()
      setLinkInfo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const regenerate = async () => {
    if (!confirm('Создать новую ссылку? Старая перестанет работать.')) return
    setSaving(true)
    setError(null)
    try {
      const info = await api.team.regenerateRegistrationLink()
      setLinkInfo(info)
      setShowQr(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async () => {
    if (!linkInfo) return
    setSaving(true)
    setError(null)
    try {
      const info = await api.team.setRegistrationLinkEnabled(!linkInfo.enabled)
      setLinkInfo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="x_panel" style={{ marginBottom: 16 }}>
      <div className="x_title">
        <h2>Саморегистрация агентов</h2>
      </div>
      <div className="x_content">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#73879C' }}>
          Постоянная ссылка для регистрации агентов в вашу команду. Можно распечатать QR-код.
        </p>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-3">
            {error}
          </div>
        )}
        {loading && !linkInfo ? (
          <p className="text-slate-500">Загрузка…</p>
        ) : !linkInfo?.has_link || !linkInfo.registration_url ? (
          <button type="button" className="btn btn-success" disabled={saving} onClick={ensureLink}>
            {saving ? 'Создание…' : 'Создать ссылку саморегистрации'}
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <div style={{ fontSize: 13, color: '#73879C', marginBottom: 6 }}>Ссылка для регистрации</div>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 13, marginBottom: 8 }}>
                {linkInfo.registration_url}
              </code>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => copyLink(linkInfo.registration_url!)}
                >
                  Копировать
                </button>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => setShowQr((v) => !v)}
                >
                  {showQr ? 'Скрыть QR' : 'Показать QR'}
                </button>
                <button type="button" className="btn btn-warning btn-sm" disabled={saving} onClick={regenerate}>
                  Перевыпустить
                </button>
                <button type="button" className="btn btn-default btn-sm" disabled={saving} onClick={toggleEnabled}>
                  {linkInfo.enabled ? 'Отключить ссылку' : 'Включить ссылку'}
                </button>
              </div>
            </div>
            {!linkInfo.enabled && (
              <p style={{ margin: 0, fontSize: 13, color: '#E74C3C' }}>Ссылка отключена — регистрация недоступна.</p>
            )}
            <p style={{ margin: 0, fontSize: 13, color: '#73879C' }}>
              Зарегистрировалось по ссылке: <strong>{linkInfo.registrations_count}</strong>
            </p>
            {showQr && linkInfo.enabled && (
              <div
                style={{
                  display: 'inline-block',
                  padding: 16,
                  background: '#fff',
                  border: '1px solid #E6E9ED',
                  borderRadius: 8,
                }}
              >
                <img
                  src={api.team.registrationLinkQrUrl()}
                  alt="QR-код для регистрации"
                  width={180}
                  height={180}
                  style={{ display: 'block' }}
                />
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#73879C', textAlign: 'center' }}>
                  Отсканируйте для регистрации
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
