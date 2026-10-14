/** Формат срока исполнения статуса (дней) для таблиц и настроек. */
export function formatExecutionDays(days: number | null | undefined): string {
  if (days == null || days <= 0) return '—'
  const n = Math.floor(days)
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} дн.`
  if (mod10 === 1) return `${n} день`
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`
  return `${n} дн.`
}

/** Остаток времени по SLA текущего статуса проекта. */
export function formatRemainingSeconds(
  remainingSeconds: number | null | undefined,
  executionDays: number | null | undefined,
  overdue?: boolean | null,
): string {
  if (executionDays == null || executionDays <= 0) return '—'
  if (overdue) return 'Просрочено'
  if (remainingSeconds == null) return '—'
  if (remainingSeconds <= 0) return 'Просрочено'

  const sec = Math.floor(remainingSeconds)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)

  if (days > 0) {
    return hours > 0 ? `${days} д ${hours} ч` : `${days} д`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`
  }
  if (minutes > 0) return `${minutes} мин`
  return '< 1 мин'
}
