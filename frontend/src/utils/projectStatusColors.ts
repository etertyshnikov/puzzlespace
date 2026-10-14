/** Прозрачность фона статуса (0 — непрозрачно, 1 — полностью прозрачно). */
const STATUS_DISPLAY_TRANSPARENCY = 0.6

/** Явные цвета для отдельных статусов (приоритет над палитрой по id). */
const STATUS_COLOR_OVERRIDES: Record<number, { background: string; color: string }> = {
  7: { background: '#fff44f', color: '#2A3F54' },
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return hex
  const n = parseInt(expanded, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Цвета бейджей для статусов проектов (по индексу). */
const STATUS_BADGE_COLORS: string[] = [
  '#26B99A', // зелёный
  '#3498DB', // синий
  '#9B59B6', // фиолетовый
  '#E67E22', // оранжевый
  '#1ABC9C', // бирюзовый
  '#E74C3C', // красный
  '#95A5A6', // серый
  '#F39C12', // жёлто-оранжевый
]

export function getProjectStatusSolidColor(statusId: number): string {
  return (
    STATUS_COLOR_OVERRIDES[statusId]?.background
    ?? STATUS_BADGE_COLORS[(statusId - 1) % STATUS_BADGE_COLORS.length]
    ?? STATUS_BADGE_COLORS[0]
  )
}

function getStatusDisplayColors(statusId: number): { background: string; color: string } {
  const alpha = 1 - STATUS_DISPLAY_TRANSPARENCY
  return {
    background: hexToRgba(getProjectStatusSolidColor(statusId), alpha),
    color: STATUS_COLOR_OVERRIDES[statusId]?.color ?? '#2A3F54',
  }
}

export function getProjectStatusRowStyle(
  statusId: number | null | undefined,
): { background: string; color: string } | undefined {
  if (statusId == null) return undefined
  return getStatusDisplayColors(statusId)
}

export function getProjectStatusBadgeStyle(statusId: number): {
  background: string
  color: string
  border: string
  margin: number
} {
  const { background, color } = getStatusDisplayColors(statusId)
  return {
    background,
    color,
    border: 'none',
    margin: 0,
  }
}
