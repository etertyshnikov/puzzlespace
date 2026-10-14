import type { CSSProperties } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StatusOption {
  id: number
  name: string
}

export function StatusDropdown({
  value,
  statuses,
  onChange,
  disabled,
  getBadgeStyle,
}: {
  value: number | null
  statuses: StatusOption[]
  onChange: (statusId: number | null) => void
  disabled?: boolean
  getBadgeStyle?: (statusId: number) => CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 140),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      const target = e.target as Node | null
      // Не закрывать при прокрутке списка статусов (бегунок overflow внутри меню).
      if (target && menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', onOutside)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('click', onOutside)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const currentLabel = value != null ? statuses.find((s) => s.id === value)?.name ?? '—' : '—'

  const menu = open && (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        padding: '2px 0',
        background: '#fff',
        border: '1px solid #E6E9ED',
        borderRadius: 3,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1050,
        maxHeight: 220,
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false) }}
        className="btn btn-default"
        style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 0, padding: '3px 8px', fontSize: 12, lineHeight: 1.3 }}
      >
        <span style={{ color: '#73879C' }}>—</span>
      </button>
      {statuses.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(s.id); setOpen(false) }}
          className="btn btn-default"
          style={{
            width: '100%',
            textAlign: 'left',
            border: 'none',
            borderRadius: 0,
            padding: '3px 8px',
            fontSize: 12,
            lineHeight: 1.3,
            background: value === s.id ? '#F2F5F7' : undefined,
          }}
        >
          <span
            className="badge"
            style={{ ...(getBadgeStyle ? getBadgeStyle(s.id) : { margin: 0, background: '#26B99A', color: '#fff' }), fontSize: 11, padding: '1px 5px' }}
          >
            {s.name}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-block', width: '100%', minWidth: 140 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((v) => !v) }}
          disabled={disabled}
          className="form-control"
          style={{
            textAlign: 'left',
            width: '100%',
            padding: '2px 6px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 26,
          }}
        >
          {value != null ? (
            <span
              className="badge"
              style={{ ...(getBadgeStyle ? getBadgeStyle(value) : { margin: 0, background: '#26B99A', color: '#fff' }), fontSize: 11, padding: '1px 5px' }}
            >
              {currentLabel}
            </span>
          ) : (
            <span style={{ color: '#73879C', fontSize: 12 }}>—</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 8, opacity: 0.7 }}>▼</span>
        </button>
      </div>
      {createPortal(menu, document.body)}
    </>
  )
}
