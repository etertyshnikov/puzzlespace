const KEY = 'portal_token'

export function portalToken(): string | null {
  return localStorage.getItem(KEY)
}

export function setPortalToken(token: string | null) {
  if (token) localStorage.setItem(KEY, token)
  else localStorage.removeItem(KEY)
}

async function call(path: string, options: RequestInit = {}, auth: 'portal' | 'staff' | 'none' = 'portal') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) }
  const token = auth === 'portal' ? portalToken() : auth === 'staff' ? localStorage.getItem('access_token') : null
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Не удалось выполнить запрос'
    throw new Error(detail)
  }
  return data
}

export const portalApi = {
  register: (body: object) => call('/api/portal/register', { method: 'POST', body: JSON.stringify(body) }, 'none'),
  login: (body: object) => call('/api/portal/login', { method: 'POST', body: JSON.stringify(body) }, 'none'),
  me: () => call('/api/portal/me'),
  listings: () => call('/api/portal/listings'),
  create: (body: object) => call('/api/portal/listings', { method: 'POST', body: JSON.stringify(body) }),
  moderation: () => call('/api/portal/moderation', {}, 'staff'),
  decide: (id: number, body: object) => call(`/api/portal/moderation/${id}`, { method: 'POST', body: JSON.stringify(body) }, 'staff'),
  channels: () => call('/api/portal/channels', {}, 'staff'),
  saveChannels: (body: object) => call('/api/portal/channels', { method: 'PUT', body: JSON.stringify(body) }, 'staff'),
}
