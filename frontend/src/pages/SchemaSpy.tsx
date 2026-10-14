import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import './schemaspy.css'

type SchemaSpyStatus = {
  ready: boolean
  generated_at: string
  url: string
  log?: string
}

export function SchemaSpy() {
  const [status, setStatus] = useState<SchemaSpyStatus>({
    ready: false,
    generated_at: '',
    url: '/schemaspy/index.html',
  })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const data = await api.schemaspy.status()
      setStatus(data)
      setError('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка статуса'
      setError(
        msg === 'Method Not Allowed'
          ? 'Method Not Allowed — перезапустите API (uvicorn) после обновления кода'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const data = await api.schemaspy.generate()
      setStatus(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка генерации'
      setError(
        msg === 'Method Not Allowed'
          ? 'Method Not Allowed — перезапустите API (uvicorn) после обновления кода'
          : msg,
      )
    } finally {
      setGenerating(false)
    }
  }

  const reportURL = status.url || '/schemaspy/index.html'
  const relationshipsURL = '/schemaspy/relationships.html'

  return (
    <div className="schemaspy-page">
      <header className="schemaspy-toolbar">
        <div>
          <h2>SchemaSpy</h2>
          <p className="schemaspy-lead">
            HTML-отчёт ER-схемы PostgreSQL (docker + schemaspy/schemaspy). Диаграмма связей:{' '}
            <a href={relationshipsURL} target="_blank" rel="noreferrer">
              relationships.html
            </a>
          </p>
        </div>
        <div className="schemaspy-actions">
          <button
            type="button"
            className="schemaspy-btn schemaspy-btn-primary"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? 'Генерация… (до 2 мин)' : status.ready ? 'Обновить отчёт' : 'Сгенерировать отчёт'}
          </button>
          {status.ready && (
            <>
              <a className="schemaspy-btn" href={reportURL} target="_blank" rel="noreferrer">
                index.html
              </a>
              <a className="schemaspy-btn" href={relationshipsURL} target="_blank" rel="noreferrer">
                relationships.html
              </a>
            </>
          )}
        </div>
      </header>

      {error && <p className="schemaspy-error">{error}</p>}
      {loading && <p className="schemaspy-muted">Загрузка статуса…</p>}
      {!loading && !status.ready && !generating && !error && (
        <p className="schemaspy-muted">
          Отчёт ещё не создан. Нажмите «Сгенерировать отчёт» или в WSL:{' '}
          <code>bash scripts/schemaspy-generate.sh</code>
        </p>
      )}
      {status.ready && status.generated_at && (
        <p className="schemaspy-muted">Обновлено: {status.generated_at}</p>
      )}

      {status.ready && (
        <iframe
          className="schemaspy-frame"
          title="SchemaSpy ER diagram"
          src={`${relationshipsURL}?t=${encodeURIComponent(status.generated_at || '')}`}
        />
      )}
    </div>
  )
}
