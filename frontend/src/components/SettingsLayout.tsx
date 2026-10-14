import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SettingsReadOnlyProvider } from '../context/SettingsReadOnlyContext'
import { isAdminManagerUser, isAdminUser, isAgentOnlyUser, isManagerUser } from '../utils/userRoles'
import { SettingsOutlet } from './SettingsOutlet'

const settingsNav = [
  { to: '/settings/specification-statuses', label: 'Статусы спецификаций' },
  { to: '/settings/project-statuses', label: 'Статусы проектов' },
  { to: '/settings/status-logs', label: 'Логи статусов проектов' },
  { to: '/settings/branches', label: 'Филиалы' },
  { to: '/settings/lead-sources', label: 'Источники лидов' },
  { to: '/settings/companies', label: 'Компании' },
  { to: '/settings/organizations', label: 'Организации' },
  { to: '/settings/contract-templates', label: 'Договора' },
  { to: '/settings/kp-templates', label: 'Шаблоны КП' },
  { to: '/settings/print-settings', label: 'Настройки печати' },
  { to: '/settings/parts', label: 'Части дома' },
  { to: '/settings/nomenclature-items', label: 'Позиции номенклатуры' },
  { to: '/settings/required-item-templates', label: 'Позиции частей дома' },
  { to: '/settings/house-specification-templates', label: 'Шаблон спецификации дома' },
  { to: '/settings/qty-basis-rules', label: 'Правила' },
  { to: '/settings/required-item-materials', label: 'Допустимые материалы для обязательной позиции' },
  { to: '/settings/specification-required-items', label: 'Обязательные позиции в спецификации' },
  { to: '/settings/users', label: 'Пользователи' },
]

function buildSettingsNavItems(user: ReturnType<typeof useAuth>['user']) {
  if (isAgentOnlyUser(user)) {
    return [{ to: '/settings/account', label: 'Мой аккаунт' }]
  }

  const manager = isManagerUser(user)
  const adminManager = isAdminManagerUser(user)
  const showTeam =
    manager ||
    adminManager ||
    user?.can_invite ||
    user?.hierarchy_level === 0 ||
    user?.role_name === 'admin' ||
    isAdminUser(user)

  const devTools = isAdminUser(user)
    ? [{ to: '/settings/schemaspy', label: 'SchemaSpy' }]
    : []

  if (adminManager) {
    return [
      ...settingsNav.slice(0, -1),
      { to: '/settings/team', label: 'Моя команда' },
      settingsNav[settingsNav.length - 1],
      ...devTools,
    ]
  }

  if (manager) {
    return [
      ...settingsNav.filter((item) => item.to !== '/settings/users'),
      { to: '/settings/team', label: 'Моя команда' },
    ]
  }

  if (showTeam) {
    return [
      ...settingsNav.slice(0, -1),
      { to: '/settings/team', label: 'Моя команда' },
      settingsNav[settingsNav.length - 1],
      ...devTools,
    ]
  }

  return [...settingsNav, ...devTools]
}

export function SettingsLayout() {
  const { user } = useAuth()
  const settingsReadOnly = isManagerUser(user)
  const navItems = useMemo(() => buildSettingsNavItems(user), [user])

  return (
    <SettingsReadOnlyProvider readOnly={settingsReadOnly}>
    <div className="row" style={{ marginBottom: 0 }}>
      <div className="col-md-3" style={{ paddingRight: 20 }}>
        <div className="x_panel settings-nav-panel">
          <div className="x_title settings-nav-title">
            <h2>Настройки</h2>
            {settingsReadOnly && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#73879C', fontWeight: 400 }}>
                Режим просмотра. Изменения и приглашение агентов — в разделе «Моя команда».
              </p>
            )}
          </div>
          <div className="x_content">
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `list-item nav-card ${isActive ? 'active' : ''}`}
                >
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <div className="col-md-9" style={{ minWidth: 0, overflow: 'hidden' }}>
        <SettingsOutlet />
      </div>
    </div>
    </SettingsReadOnlyProvider>
  )
}
