import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { useSettingsReadOnly } from '../context/SettingsReadOnlyContext'

const iconClass = 'p-1.5 rounded inline-flex items-center justify-center'

export function EditLinkIcon({ to, ...props }: { to: string } & React.ComponentProps<typeof Link>) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return (
    <Link
      to={to}
      title="Изменить"
      aria-label="Изменить"
      className={`${iconClass} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </Link>
  )
}

export function EditIconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return (
    <button
      type="button"
      title="Изменить"
      aria-label="Изменить"
      className={`${iconClass} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>
  )
}

export function DeleteIconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return (
    <button
      type="button"
      title="Удалить"
      aria-label="Удалить"
      className={`${iconClass} text-slate-500 hover:text-red-600 hover:bg-red-50 ml-0.5`}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
      </svg>
    </button>
  )
}

export function DuplicateIconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const readOnly = useSettingsReadOnly()
  if (readOnly) return null
  return (
    <button
      type="button"
      title="Дублировать"
      aria-label="Дублировать"
      className={`${iconClass} text-slate-500 hover:text-slate-800 hover:bg-slate-100 ml-0.5`}
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  )
}
