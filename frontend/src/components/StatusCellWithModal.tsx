import type { CSSProperties } from 'react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { StatusOption } from './StatusDropdown'

const pencilSvg = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export function StatusCellWithModal({
  value,
  statuses,
  onChange,
  disabled,
  getBadgeStyle,
  labelAsText,
  iconOnly,
}: {
  value: number | null
  statuses: StatusOption[]
  onChange: (statusId: number | null) => void
  disabled?: boolean
  getBadgeStyle?: (statusId: number) => CSSProperties
  /** Подпись статуса без бейджа (когда цвет уже на всей строке таблицы). */
  labelAsText?: boolean
  /** Только кнопка-карандаш без подписи статуса. */
  iconOnly?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const currentLabel = value != null ? statuses.find((s) => s.id === value)?.name ?? '—' : '—'
  const defaultBadgeStyle: CSSProperties = { margin: 0, background: '#26B99A', color: '#fff' }

  const modal = modalOpen && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
      }}
      onClick={() => setModalOpen(false)}
    >
      <div
        style={{
          background: '#fff',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          minWidth: 260,
          maxWidth: 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Статус</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            type="button"
            className="btn btn-default"
            style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px' }}
            onClick={() => { onChange(null); setModalOpen(false) }}
          >
            <span style={{ color: '#73879C' }}>—</span>
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn btn-default"
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                border: 'none',
                padding: '8px 10px',
                background: value === s.id ? '#F2F5F7' : undefined,
              }}
              onClick={() => { onChange(s.id); setModalOpen(false) }}
            >
              <span
                className="badge"
                style={{ ...(getBadgeStyle ? getBadgeStyle(s.id) : defaultBadgeStyle), fontSize: 12, padding: '2px 8px' }}
              >
                {s.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!iconOnly && (
          value != null ? (
            labelAsText ? (
              <span style={{ fontSize: 15, fontWeight: 600 }}>{currentLabel}</span>
            ) : (
              <span
                className="badge"
                style={{ ...(getBadgeStyle ? getBadgeStyle(value) : defaultBadgeStyle), fontSize: 15, padding: '2px 6px' }}
              >
                {currentLabel}
              </span>
            )
          ) : (
            <span style={{ color: labelAsText ? 'inherit' : '#73879C', fontSize: 15, opacity: labelAsText ? 0.75 : undefined }}>—</span>
          )
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!disabled) setModalOpen(true) }}
          disabled={disabled}
          title={iconOnly ? `Изменить статус: ${currentLabel}` : 'Изменить статус'}
          style={{
            padding: 2,
            border: 'none',
            background: 'transparent',
            color: labelAsText ? 'inherit' : '#73879C',
            opacity: labelAsText ? 0.85 : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pencilSvg}
        </button>
      </div>
      {createPortal(modal, document.body)}
    </>
  )
}
