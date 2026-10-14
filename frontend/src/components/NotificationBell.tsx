import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type NotificationOut } from '../api/client'
import {
  NOTIFICATIONS_UPDATED_EVENT,
  notifyNotificationsUpdated,
} from '../utils/notificationEvents'

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'только что'
    if (mins < 60) return `${mins} мин`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ч`
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationOut[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadCount = useCallback(() => {
    api.notifications
      .unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0))
  }, [])

  const loadList = useCallback(() => {
    setLoading(true)
    api.notifications
      .list({ limit: 30 })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadCount()
    const interval = setInterval(loadCount, 20000)
    const onUpdated = () => loadCount()
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadCount()
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadCount])

  useEffect(() => {
    if (!open) return
    loadList()
    loadCount()
    const interval = setInterval(() => {
      loadList()
      loadCount()
    }, 20000)
    return () => clearInterval(interval)
  }, [open, loadList, loadCount])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openItem = async (n: NotificationOut) => {
    try {
      if (!n.read_at) {
        const readAt = new Date().toISOString()
        setUnread((c) => Math.max(0, c - 1))
        setItems((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read_at: readAt } : item)),
        )
        await api.notifications.markRead(n.id)
        notifyNotificationsUpdated()
      }
    } catch {
      loadCount()
    }
    setOpen(false)
    if (n.link_path) {
      navigate(n.link_path)
    }
  }

  const markAll = async () => {
    try {
      const readAt = new Date().toISOString()
      await api.notifications.readAll()
      setUnread(0)
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || readAt })))
      notifyNotificationsUpdated()
    } catch {
      loadCount()
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Уведомления"
        aria-label="Уведомления"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 18,
          lineHeight: 1,
          color: '#555',
        }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#E74C3C',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            width: 320,
            maxWidth: 'calc(100vw - 24px)',
            background: '#fff',
            border: '1px solid #E6E9ED',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 1100,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderBottom: '1px solid #E6E9ED',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <span>Уведомления</span>
            {unread > 0 && (
              <button type="button" className="btn btn-default btn-xs" onClick={markAll}>
                Прочитать все
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: '#73879C', fontSize: 13 }}>Загрузка…</p>
            ) : items.length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: '#73879C', fontSize: 13 }}>Нет уведомлений</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: '1px solid #F0F2F5',
                    background: n.read_at ? '#fff' : '#F7FBFA',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                    {n.actor_name && <span>{n.actor_name}: </span>}
                    {n.body || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#73879C' }}>{formatWhen(n.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
