import type { AuthUserOut } from '../api/client'

/** Директор / admin (уровень 0). */
export function isDirectorUser(user: AuthUserOut | null | undefined): boolean {
  return user?.role_name === 'admin' || user?.hierarchy_level === 0
}

/** Админ/менеджер: полные права администратора + своя команда агентов. */
export function isAdminManagerUser(user: AuthUserOut | null | undefined): boolean {
  return user?.role_name === 'admin_manager'
}

/** Полный административный доступ (настройки, пользователи). */
export function isAdminUser(user: AuthUserOut | null | undefined): boolean {
  return isDirectorUser(user) || isAdminManagerUser(user)
}

/** Агент: уровень 2 / роль agent; не директор, не admin и не менеджер. */
export function isAgentUser(user: AuthUserOut | null | undefined): boolean {
  if (!user || isAdminUser(user)) return false
  if (user.role_name === 'manager' || user.hierarchy_level === 1) return false
  return user.hierarchy_level === 2 || user.role_name === 'agent'
}

/** Менеджер 1-го уровня (не admin/директор, не админ-менеджер). */
export function isManagerUser(user: AuthUserOut | null | undefined): boolean {
  if (!user || isAdminUser(user) || isAgentUser(user)) return false
  return user.hierarchy_level === 1 || user.role_name === 'manager'
}

/** Может приглашать агентов в свою команду (менеджер или админ-менеджер). */
export function isTeamLeadUser(user: AuthUserOut | null | undefined): boolean {
  return isManagerUser(user) || isAdminManagerUser(user)
}

/** Агент без прав менеджера — только свой аккаунт в настройках. */
export function isAgentOnlyUser(user: AuthUserOut | null | undefined): boolean {
  return isAgentUser(user) && !isManagerUser(user)
}
