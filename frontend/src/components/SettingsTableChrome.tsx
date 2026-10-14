import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { useSettingsReadOnly } from '../context/SettingsReadOnlyContext'

export function SettingsActionTh({ width = 120 }: { width?: number }) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return <th style={{ width }}>Действия</th>
}

export function SettingsActionTd({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
}) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return <td onClick={onClick}>{children}</td>
}

export function SettingsAddLink({
  to,
  children,
  className = 'btn btn-success',
}: LinkProps & { children: ReactNode; className?: string }) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

export function SettingsToolbarButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return <button type="button" {...props} />
}
