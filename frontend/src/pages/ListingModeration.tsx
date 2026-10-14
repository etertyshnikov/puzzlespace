import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../public/portalApi'

type Listing = {
  id: number
  kind: string
  title: string
  status: string
  author: string
  body: Record<string, string>
  publish_log: string
}
type Channel = { kind: string; network: string; target: string; enabled: boolean }

const KINDS = [
  ['vacancy', 'Вакансии'],
  ['resume', 'Резюме'],
  ['sell', 'Продать участок'],
  ['buy', 'Купить участок'],
] as const
const NETWORKS = [
  ['max', 'Max'],
  ['telegram', 'Telegram'],
  ['dzen', 'Дзен'],
] as const

export function ListingModeration() {
  const [rows, setRows] = useState<Listing[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Record<number, string[]>>({})

  const load = () => {
    Promise.all([portalApi.moderation(), portalApi.channels()])
      .then(([list, chans]) => {
        setRows(list)
        setChannels(chans)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
  }
  useEffect(load, [])

  const toggle = (id: number, network: string) => {
    setPicked((prev) => {
      const cur = prev[id] || ['max', 'telegram', 'dzen']
      const next = cur.includes(network) ? cur.filter((item) => item !== network) : [...cur, network]
      return { ...prev, [id]: next }
    })
  }

  const saveChannels = async () => {
    setError('')
    try {
      setChannels(await portalApi.saveChannels(channels))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const decide = async (id: number, action: 'approve' | 'reject') => {
    setError('')
    try {
      await portalApi.decide(id, { action, networks: picked[id] || ['max', 'telegram', 'dzen'] })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <p><Link to="/dashboard">← Дашборд</Link></p>
      <h1>Объявления на модерации</h1>
      {error && <p style={{ color: '#9d3418' }}>{error}</p>}
      <section style={{ marginBottom: 24 }}>
        <h2>Каналы по типам</h2>
        <p>Вакансии, резюме, продажа и покупка участка уходят в разные группы Max. Одинаковый id группы сохранить нельзя. Telegram и Дзен тоже задаются отдельно для каждого типа. Токены ботов лежат в .env сервера, в эту форму их вводить не нужно.</p>
        {KINDS.map(([kind, label]) => (
          <div key={kind} style={{ marginBottom: 12 }}>
            <strong>{label}</strong>
            {NETWORKS.map(([network, netLabel]) => {
              const row = channels.find((item) => item.kind === kind && item.network === network)
              if (!row) return null
              return (
                <label key={network} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <span style={{ width: 90 }}>{netLabel}</span>
                  <input
                    style={{ flex: 1 }}
                    value={row.target}
                    placeholder={network === 'dzen' ? 'https://...' : 'id чата'}
                    onChange={(e) => setChannels((prev) => prev.map((item) => item.kind === kind && item.network === network ? { ...item, target: e.target.value } : item))}
                  />
                </label>
              )
            })}
          </div>
        ))}
        <button type="button" onClick={saveChannels}>Сохранить каналы</button>
      </section>
      {rows.map((row) => (
        <article key={row.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <h3>{row.title}</h3>
          <p>{row.author} · {row.kind} · {row.status}</p>
          <ul>{Object.entries(row.body).map(([key, value]) => <li key={key}><b>{key}:</b> {value}</li>)}</ul>
          {row.publish_log && <pre style={{ whiteSpace: 'pre-wrap' }}>{row.publish_log}</pre>}
          {row.status === 'pending' && row.kind !== 'order' && (
            <p>
              {NETWORKS.map(([network, label]) => (
                <label key={network} style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={(picked[row.id] || ['max', 'telegram', 'dzen']).includes(network)}
                    onChange={() => toggle(row.id, network)}
                  /> {label}
                </label>
              ))}
            </p>
          )}
          {row.status === 'pending' && (
            <p>
              <button type="button" onClick={() => decide(row.id, 'approve')}>Разрешить публикацию</button>{' '}
              <button type="button" onClick={() => decide(row.id, 'reject')}>Отклонить</button>
            </p>
          )}
        </article>
      ))}
      {rows.length === 0 && <p>Новых объявлений нет.</p>}
    </div>
  )
}
