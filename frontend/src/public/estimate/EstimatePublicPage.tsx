import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicShell } from '../PublicShell'
import { EstimateManagerLink, EstimateResult } from './EstimateResult'
import './estimate.css'
import { readError, type EstimateView } from './types'

export default function EstimatePublicPage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<EstimateView | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    fetch('/api/estimate/quotes/' + encodeURIComponent(slug))
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(readError(body, 'Смета не найдена'))
        return body as EstimateView
      })
      .then((body) => { if (!cancelled) setData(body) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
    return () => { cancelled = true }
  }, [slug])

  return (
    <PublicShell title="Смета дома" afterFooter={data ? <EstimateManagerLink /> : null}>
      {error && <p className="est-error">{error}</p>}
      {!error && !data && <p className="est-lead">Открываем расчёт…</p>}
      {data && <EstimateResult data={data} />}
    </PublicShell>
  )
}
