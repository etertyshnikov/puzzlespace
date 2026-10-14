import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser } from '../utils/userRoles'
import { SchemaSpy } from './SchemaSpy'

export function SchemaSpyAdminGate() {
  const { user } = useAuth()
  if (!isAdminUser(user)) {
    return <Navigate to="/settings/specification-statuses" replace />
  }
  return <SchemaSpy />
}
