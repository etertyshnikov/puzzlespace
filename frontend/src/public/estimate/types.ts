export type EstimateLine = {
  key: string
  title: string
  amount: number
  percent: number
  includes: string
}

export type EstimateView = {
  slug: string
  url: string
  has_photo: boolean
  result: {
    area_m2: number
    total: number
    lines: EstimateLine[]
    comparison: { id: string; title: string; total: number; selected: boolean }[]
    cards: { label: string; value: string }[]
  }
}

export function rub(amount: number) {
  return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽'
}

export function readError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object' || !('detail' in data)) return fallback
  const detail = (data as { detail: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && 'msg' in detail[0]) {
    return String((detail[0] as { msg: string }).msg).replace(/^Value error,\s*/, '')
  }
  return fallback
}
