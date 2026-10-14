import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser, isAgentUser, isTeamLeadUser } from '../utils/userRoles'
import { useTabTitleAlert } from '../hooks/useTabTitleAlert'
import { CHAT_UPDATED_EVENT } from '../utils/chatEvents'
import { NOTIFICATIONS_UPDATED_EVENT } from '../utils/notificationEvents'
import { ChromeBurgerButton } from './ChromeBurgerButton'
import { NotificationBell } from './NotificationBell'
import { useAppChrome } from '../context/AppChromeContext'
import '../assets/gentelella/gentelella-app.css'

const nav = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/customers', label: 'Клиенты' },
  { to: '/chat', label: 'Чат' },
  { to: '/settings', label: 'Настройки' },
  { to: '/help', label: 'Помощь' },
]

export function Layout() {
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const [chatUnread, setChatUnread] = useState(0)
  const [notificationUnread, setNotificationUnread] = useState(0)
  const { user, logout } = useAuth()
  const { chromeCollapsed, toggleChromeCollapsed } = useAppChrome()
  const navigate = useNavigate()

  const navItems = useMemo(() => {
    let items = nav
    // Чат: менеджер и агент
    if (user && !isTeamLeadUser(user) && !isAgentUser(user)) {
      items = items.filter((item) => item.to !== '/chat')
    }
    if (user && isAdminUser(user)) {
      items = [...items, { to: '/devtools/rules', label: 'Разработка' }]
    }
    return items
  }, [user])

  const showChatNav = Boolean(user && (isTeamLeadUser(user) || isAgentUser(user)))
  const showNotifications = Boolean(user && isTeamLeadUser(user))

  const loadChatUnread = useCallback(() => {
    if (!showChatNav) {
      setChatUnread(0)
      return
    }
    api.chat
      .unreadCount()
      .then((r) => setChatUnread(r.count))
      .catch(() => setChatUnread(0))
  }, [showChatNav])

  const loadNotificationUnread = useCallback(() => {
    if (!showNotifications) {
      setNotificationUnread(0)
      return
    }
    api.notifications
      .unreadCount()
      .then((r) => setNotificationUnread(r.count))
      .catch(() => setNotificationUnread(0))
  }, [showNotifications])

  useTabTitleAlert({
    enabled: Boolean(user),
    chatUnread,
    notificationUnread,
  })

  useEffect(() => {
    const check = () => {
      api.health().then(() => setApiConnected(true)).catch(() => setApiConnected(false))
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  const refreshBadges = useCallback(() => {
    loadChatUnread()
    loadNotificationUnread()
  }, [loadChatUnread, loadNotificationUnread])

  useEffect(() => {
    refreshBadges()
    const interval = setInterval(refreshBadges, 20000)
    const onChatUpdated = () => refreshBadges()
    const onNotificationsUpdated = () => loadNotificationUnread()
    window.addEventListener(CHAT_UPDATED_EVENT, onChatUpdated)
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onNotificationsUpdated)
    return () => {
      clearInterval(interval)
      window.removeEventListener(CHAT_UPDATED_EVENT, onChatUpdated)
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onNotificationsUpdated)
    }
  }, [refreshBadges, loadNotificationUnread])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div
      className={`gentelella-app${chromeCollapsed ? ' gentelella-app--chrome-collapsed' : ''}`}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {chromeCollapsed && (
        <ChromeBurgerButton
          expanded={false}
          onClick={toggleChromeCollapsed}
          className="btn btn-default gentelella-chrome-burger-fixed"
        />
      )}
      <nav className="gentelella-top-nav" style={{ display: 'flex', alignItems: 'center', padding: '0 20px', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '18px', marginRight: 16 }}>СметаДома</span>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'active' : ''
            }
            style={{ padding: '14px 16px', textDecoration: 'none', position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {label}
            {to === '/chat' && chatUnread > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: '#E74C3C',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
          </NavLink>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
          {user && isTeamLeadUser(user) && <NotificationBell />}
          {apiConnected === true && <span style={{ color: '#26B99A' }}>API подключен</span>}
          {apiConnected === false && <span style={{ color: '#E74C3C' }}>API не подключен</span>}
          {apiConnected === null && <span style={{ color: '#B2B8BD' }}>Проверка…</span>}
          {user && (
            <>
              <span style={{ color: '#555', marginLeft: 8 }}>{user.first_name || user.nic}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#555',
                }}
              >
                Выход
              </button>
            </>
          )}
        </div>
      </nav>
      <main className="gentelella-right-col" style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: '96rem', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
