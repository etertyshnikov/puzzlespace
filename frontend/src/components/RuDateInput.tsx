import { useEffect, useRef, useState } from 'react'

/** YYYY-MM-DD → дд.мм.гггг */
export function isoDateToRuDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** дд.мм.гггг → YYYY-MM-DD */
export function ruDisplayToIsoDate(display: string): string | undefined {
  const trimmed = display.trim()
  if (!trimmed) return undefined
  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return undefined
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return undefined
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return undefined
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isoDateValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  input.focus({ preventScroll: true })
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
      return
    } catch {
      /* Safari / старые браузеры */
    }
  }
  input.click()
}

type RuDateInputProps = {
  value?: string | null
  onChange: (iso: string | undefined) => void
  placeholder?: string
  className?: string
}

/** Дата: текст дд.мм.гггг + нативный календарь (input type="date"). */
export function RuDateInput({
  value,
  onChange,
  placeholder = 'дд.мм.гггг',
  className,
}: RuDateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => isoDateToRuDisplay(value))

  useEffect(() => {
    setText(isoDateToRuDisplay(value))
  }, [value])

  const applyIso = (iso: string | undefined) => {
    onChange(iso)
    setText(isoDateToRuDisplay(iso))
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'stretch', width: '100%' }}
    >
      <input
        type="text"
        className="form-control"
        style={{ flex: '1 1 auto', minWidth: 0 }}
        placeholder={placeholder}
        inputMode="decimal"
        maxLength={10}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, '')
          setText(next)
          const iso = ruDisplayToIsoDate(next)
          if (next === '' || iso) onChange(iso)
        }}
        onBlur={() => {
          const iso = ruDisplayToIsoDate(text)
          if (!text.trim()) {
            applyIso(undefined)
            return
          }
          if (iso) {
            applyIso(iso)
          } else {
            setText(isoDateToRuDisplay(value))
          }
        }}
      />
      <div
        style={{
          position: 'relative',
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'stretch',
        }}
      >
        <span
          className="btn btn-default"
          aria-hidden
          style={{
            margin: 0,
            padding: '6px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>📅</span>
        </span>
        <input
          ref={dateInputRef}
          type="date"
          value={isoDateValue(value)}
          title="Открыть календарь"
          aria-label="Открыть календарь"
          onChange={(e) => {
            const iso = e.target.value || undefined
            applyIso(iso)
          }}
          onClick={() => openNativeDatePicker(dateInputRef.current)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0,
            border: 'none',
            opacity: 0,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )
}
