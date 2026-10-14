/** Цифры телефона в формате E.164 без «+» (79991234567). */
export function phoneE164Digits(phone: string | null | undefined): string | undefined {
  if (!phone?.trim()) return undefined
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) digits = '7' + digits.slice(1)
  if (digits.length === 10) digits = '7' + digits
  if (digits.length < 11) return undefined
  return digits
}

/** tel: ссылка для звонка. */
export function phoneTelHref(phone: string | null | undefined): string | undefined {
  const digits = phoneE164Digits(phone)
  if (!digits) return undefined
  return `tel:+${digits}`
}

/** +79991234567 для поиска в мессенджерах. */
export function phoneE164Plus(phone: string | null | undefined): string | undefined {
  const digits = phoneE164Digits(phone)
  if (!digits) return undefined
  return `+${digits}`
}

/**
 * Deeplink MAX: открыть чат по номеру.
 * Формат: max://chat?phone=79991234567
 */
export function phoneMaxSearchHref(phone: string | null | undefined): string | undefined {
  const digits = phoneE164Digits(phone)
  if (!digits) return undefined
  return `max://chat?phone=${digits}`
}

/** Открыть приложение MAX (экран чатов). */
export function openMaxChat(): void {
  window.location.href = 'max://chat'
}
