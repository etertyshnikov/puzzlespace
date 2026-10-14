import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSettingsReadOnly } from '../context/SettingsReadOnlyContext'
import { isAgentOnlyUser } from '../utils/userRoles'

function settingsListPath(pathname: string): string {
  const match = pathname.match(/^\/settings\/([^/]+)/)
  return match ? `/settings/${match[1]}` : '/settings'
}

export function SettingsOutlet() {
  const { user } = useAuth()
  const readOnly = useSettingsReadOnly()
  const location = useLocation()
  const navigate = useNavigate()
  const agentOnly = isAgentOnlyUser(user)

  const isAccount = location.pathname.startsWith('/settings/account')
  const isTeam = location.pathname.startsWith('/settings/team')
  const isUsers = location.pathname.startsWith('/settings/users')
  const isWriteRoute = /\/settings\/.+(\/new|\/\d+\/edit)$/.test(location.pathname)

  useEffect(() => {
    if (agentOnly && !isAccount) {
      navigate('/settings/account', { replace: true })
      return
    }
    if (readOnly && isUsers) {
      navigate('/settings/team', { replace: true })
      return
    }
    if (readOnly && isWriteRoute && !isTeam) {
      navigate(settingsListPath(location.pathname), { replace: true })
    }
  }, [agentOnly, isAccount, readOnly, isWriteRoute, isTeam, isUsers, location.pathname, navigate])

  if (agentOnly && !isAccount) {
    return null
  }

  if (readOnly && (isUsers || (isWriteRoute && !isTeam))) {
    return null
  }

  return <Outlet />
}
