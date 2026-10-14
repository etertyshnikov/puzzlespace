import { useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { rub, type EstimateView } from './types'

const COLORS: Record<string, string> = {
  foundation: '#0b4c68',
  walls: '#f0a01a',
  roof: '#c45c26',
  facade: '#2f8f6b',
  engineering: '#3d7ea6',
  overhead: '#8a7355',
}

const TECH_COLORS: Record<string, string> = {
  frame: '#0b4c68',
  poly: '#3d7ea6',
  clay: '#c45c26',
  gas: '#f0a01a',
  timber: '#2f8f6b',
  log: '#8a7355',
  modular: '#8a4d8a',
}

const MAX_CHAT = 'https://max.ru/u/f9LHodD0cOJAq_i64k5um5BJJliYY50kfcyZ6CNUPy7DHmQfHAsPTmPyTmM'

export function EstimateManagerLink() {
  return (
    <div className="est-after">
      <a className="est-link max est-max-wide" href={MAX_CHAT} target="_blank" rel="noreferrer">Написать менеджеру в МАХ</a>
    </div>
  )
}

export function EstimateResult({ data }: { data: EstimateView }) {
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { result, slug, has_photo } = data
  const maxTech = Math.max(...result.comparison.map((item) => item.total), 1)

  async function share() {
    const link = window.location.origin + '/estimate/' + slug
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      window.prompt('Скопируйте ссылку', link)
    }
  }

  return (
    <div className="est">
      <h2>Расчёт на {result.area_m2} м²</h2>
      <p className="est-lead">Нажмите на статью, чтобы увидеть, что в неё входит. Сумма процентов — 100.</p>
      {has_photo && <img className="est-photo" src={`/api/estimate/quotes/${slug}/photo`} alt="Пример дома, который приложили к смете" />}

      <section>
        <h3>Конфигурация вашего дома</h3>
        <div className="est-cards">
          {result.cards.map((card) => (
            <div className="est-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="est-section-title">Детализация расчёта</h2>
        <div className="est-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.lines} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="title" width={118} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => rub(Number(value))} />
              <Bar dataKey="amount" radius={8}>
                {result.lines.map((line) => (
                  <Cell key={line.key} fill={COLORS[line.key] || '#0b4c68'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {result.lines.map((line) => (
          <button
            type="button"
            className="est-line"
            key={line.key}
            onClick={() => setOpen(open === line.key ? null : line.key)}
          >
            <b>{line.title}</b>
            <em>{line.percent}% · {rub(line.amount)}</em>
            {open === line.key && <p className="est-hint">{line.includes}</p>}
          </button>
        ))}
        <div className="est-total">
          <span>Итоговая стоимость</span>
          <strong>{rub(result.total)}</strong>
        </div>
        <p className="est-hint">Ориентир для разговора со строителем. Это не публичная оферта и не фиксированная цена.</p>
      </section>

      <section>
        <h2 className="est-section-title">Те же вводные, другие технологии</h2>
        <div className="est-techbars">
          {result.comparison.map((item) => {
            const width = Math.max(8, Math.round((item.total / maxTech) * 100))
            return (
              <div className={item.selected ? 'est-techrow on' : 'est-techrow'} key={item.id}>
                <div className="est-techrow-top">
                  <span>{item.title}{item.selected ? ' — ваш выбор' : ''}</span>
                  <strong>{rub(item.total)}</strong>
                </div>
                <div className="est-meter tall" aria-hidden="true">
                  <i style={{ width: `${width}%`, background: TECH_COLORS[item.id] || '#0b4c68' }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="est-actions">
        <button type="button" className="est-go ghost" onClick={share}>{copied ? 'Ссылка скопирована' : '🔗 Поделиться'}</button>
        <a className="est-link ghost" href={`/api/estimate/quotes/${slug}/pdf`}>📄 Скачать PDF</a>
      </div>
    </div>
  )
}
