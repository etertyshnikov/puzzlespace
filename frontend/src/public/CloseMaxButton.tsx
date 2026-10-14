import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

type MaxBack = { show?: () => void; hide?: () => void; onClick?: (cb: () => void) => void; offClick?: (cb: () => void) => void }
type MaxApp = { ready?: () => void; close?: () => void; BackButton?: MaxBack; initData?: string; platform?: string }

function openedInMax(web: MaxApp | null): boolean {
  if (!web || typeof web.close !== 'function') return false
  if ((web.initData || '').trim()) return true
  const platform = (web.platform || '').trim()
  return Boolean(platform && platform !== 'unknown')
}

function readWebApp(): MaxApp | null {
  const web = (window as unknown as { WebApp?: MaxApp }).WebApp
  return web || null
}

export function CloseMaxButton() {
  const location = useLocation()
  const [app, setApp] = useState<MaxApp | null>(null)

  useEffect(() => {
    let stopped = false
    const onBack = () => {
      const web = readWebApp()
      if (location.pathname === '/' || window.history.length <= 1) {
        web?.close?.()
        return
      }
      window.history.back()
    }
    const bind = () => {
      const web = readWebApp()
      if (!web) return false
      const inside = openedInMax(web)
      if (!inside) return false
      try { web.ready?.() } catch { /* вне MAX */ }
      try {
        web.BackButton?.offClick?.(onBack)
        web.BackButton?.onClick?.(onBack)
        web.BackButton?.show?.()
      } catch { /* старый клиент */ }
      if (!stopped) setApp(web)
      return true
    }
    bind()
    const timer = window.setInterval(() => {
      if (bind()) window.clearInterval(timer)
    }, 400)
    const timeout = window.setTimeout(() => window.clearInterval(timer), 10000)
    return () => {
      stopped = true
      window.clearInterval(timer)
      window.clearTimeout(timeout)
      readWebApp()?.BackButton?.offClick?.(onBack)
    }
  }, [location.pathname])

  if (!app || !openedInMax(app)) return null
  return (
    <button type="button" className="dom-btn dom-close" onClick={() => app.close?.()}>
      Закрыть
    </button>
  )
}
