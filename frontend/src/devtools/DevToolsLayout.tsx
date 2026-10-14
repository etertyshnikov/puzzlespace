import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser } from '../utils/userRoles'
import './devtools.css'

function navClass({ isActive }: { isActive: boolean }) {
  return `app-nav-btn${isActive ? ' is-active' : ''}`
}

export function DevToolsLayout() {
  const { user } = useAuth()
  const location = useLocation()

  if (!isAdminUser(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const isFlows = location.pathname.startsWith('/devtools/flows')
  const mainClass = isFlows ? 'app-main app-main-flows' : 'app-main app-main-rules'
  const displayName = user?.first_name || user?.nic || 'Пользователь'

  return (
    <div className="devtools-root">
      <div className="app-root">
        <nav className="app-nav">
          <NavLink to="/devtools/rules" className={navClass} end>
            Конструктор правил расчёта
          </NavLink>
          <NavLink to="/devtools/rules-sandbox" className={navClass}>
            Правила + спецификация (тест)
          </NavLink>
          <NavLink to="/devtools/flows" className={navClass}>
            Сценарии
          </NavLink>
          <div className="app-nav-spacer" />
          <NavLink to="/dashboard" className="app-nav-btn">
            ← CRM
          </NavLink>
          <span className="app-nav-user" title={user?.nic}>
            {displayName}
          </span>
        </nav>
        <main className={mainClass}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
