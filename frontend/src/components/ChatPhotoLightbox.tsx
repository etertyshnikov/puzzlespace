import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'

export type ChatLightboxItem = {
  id: number
  filename: string
  url: string
}

type ChatPhotoLightboxProps = {
  items: ChatLightboxItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function ChatPhotoLightbox({ items, index, onClose, onIndexChange }: ChatPhotoLightboxProps) {
  const hasMany = items.length > 1
  const current = items[index]
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    active: boolean
    pointerId: number
    startX: number
    startY: number
    panX: number
    panY: number
  } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const resetZoom = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((value) => clampZoom(Number((value + ZOOM_STEP).toFixed(2))))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((value) => {
      const next = clampZoom(Number((value - ZOOM_STEP).toFixed(2)))
      if (next <= 1) {
        setPan({ x: 0, y: 0 })
      }
      return next
    })
  }, [])

  const goPrev = useCallback(() => {
    if (!items.length) return
    resetZoom()
    onIndexChange((index - 1 + items.length) % items.length)
  }, [index, items.length, onIndexChange, resetZoom])

  const goNext = useCallback(() => {
    if (!items.length) return
    resetZoom()
    onIndexChange((index + 1) % items.length)
  }, [index, items.length, onIndexChange, resetZoom])

  useEffect(() => {
    resetZoom()
  }, [current?.id, resetZoom])

  useEffect(() => {
    if (!current) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoom > 1) {
          resetZoom()
          return
        }
        onClose()
      }
      if (zoom <= 1 && e.key === 'ArrowLeft') goPrev()
      if (zoom <= 1 && e.key === 'ArrowRight') goNext()
      if (e.key === '+' || e.key === '=') zoomIn()
      if (e.key === '-') zoomOut()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [current, goNext, goPrev, onClose, resetZoom, zoom, zoomIn, zoomOut])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      setZoom((value) => {
        const next = clampZoom(Number((value + delta).toFixed(2)))
        if (next <= 1) {
          setPan({ x: 0, y: 0 })
        }
        return next
      })
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [current?.id])

  const onStageWheel = (e: ReactWheelEvent) => {
    e.stopPropagation()
  }

  const onImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (zoom > 1) {
      resetZoom()
      return
    }
    setZoom(2.5)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return
    e.stopPropagation()
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active || drag.pointerId !== e.pointerId) return
    setPan({
      x: drag.panX + (e.clientX - drag.startX),
      y: drag.panY + (e.clientY - drag.startY),
    })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (!current) return null

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div
      className="chat-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={() => {
        if (zoom > 1) {
          resetZoom()
          return
        }
        onClose()
      }}
    >
      <div className="chat-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <span className="chat-lightbox-counter">
          {index + 1} / {items.length}
        </span>
        <div className="chat-lightbox-zoom">
          <button type="button" className="chat-lightbox-zoom-btn" onClick={zoomOut} aria-label="Уменьшить">
            −
          </button>
          <span className="chat-lightbox-zoom-value">{zoomPercent}%</span>
          <button type="button" className="chat-lightbox-zoom-btn" onClick={zoomIn} aria-label="Увеличить">
            +
          </button>
          {zoom > 1 && (
            <button type="button" className="chat-lightbox-zoom-reset" onClick={resetZoom}>
              Сброс
            </button>
          )}
        </div>
        <a
          href={current.url}
          download={current.filename}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-lightbox-download"
        >
          Скачать
        </a>
        <button type="button" className="chat-lightbox-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      {hasMany && zoom <= 1 && (
        <button
          type="button"
          className="chat-lightbox-nav chat-lightbox-nav--prev"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          aria-label="Предыдущее фото"
        >
          ‹
        </button>
      )}

      <div
        ref={stageRef}
        className={`chat-lightbox-stage${zoom > 1 ? ' chat-lightbox-stage--zoomed' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onWheel={onStageWheel}
      >
        <div
          className="chat-lightbox-image-wrap"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          onDoubleClick={onImageDoubleClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img src={current.url} alt={current.filename} className="chat-lightbox-image" draggable={false} />
        </div>
      </div>

      {hasMany && zoom <= 1 && (
        <button
          type="button"
          className="chat-lightbox-nav chat-lightbox-nav--next"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          aria-label="Следующее фото"
        >
          ›
        </button>
      )}

      <div className="chat-lightbox-hint" onClick={(e) => e.stopPropagation()}>
        Колесо мыши или ± — масштаб · двойной клик — увеличить · перетаскивание при увеличении
      </div>
    </div>
  )
}
