import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { openMaxChat, phoneE164Plus, phoneTelHref } from '../utils/phoneLinks'

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  borderRadius: 0,
  padding: '6px 10px',
  fontSize: 13,
  lineHeight: 1.3,
  color: '#2A3F54',
  textDecoration: 'none',
}

export function PhoneActionsDropdown({
  phone,
  displayPhone,
}: {
  phone: string | null | undefined
  displayPhone?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const label = (displayPhone ?? phone)?.trim() || '—'
  const telHref = phoneTelHref(phone)
  const copyPhone = phoneE164Plus(phone)
  const hasActions = Boolean(telHref || copyPhone)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      const target = e.target as Node | null
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

  if (!hasActions) {
    return <span>{label}</span>
  }

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
      }}
    >
      {telHref && (
        <a
          href={telHref}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
          className="btn btn-default"
          style={menuItemStyle}
        >
          Позвонить
        </a>
      )}
      {copyPhone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            void navigator.clipboard.writeText(copyPhone).then(() => {
              openMaxChat()
            })
          }}
          className="btn btn-default"
          style={{ ...menuItemStyle, background: undefined }}
        >
          Скопировать и открыть MAX
        </button>
      )}
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          color: '#337ab7',
          textDecoration: 'underline',
          cursor: 'pointer',
          font: 'inherit',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {label}
      </button>
      {createPortal(menu, document.body)}
    </>
  )
}
