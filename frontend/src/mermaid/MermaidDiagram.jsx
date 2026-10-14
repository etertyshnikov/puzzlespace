import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { chartFingerprint } from '../flows/flowToMermaid.js'
import { renderMermaidChart } from './renderMermaid.js'
import './mermaid.css'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

function applySvgScale(container, scale) {
  const svg = container?.querySelector('svg')
  if (!svg) return

  if (!svg.dataset.baseWidth) {
    svg.style.maxWidth = 'none'
    svg.style.width = ''
    const measured = svg.getBoundingClientRect().width
    if (measured > 0) svg.dataset.baseWidth = String(measured)
  }

  const base = parseFloat(svg.dataset.baseWidth)
  if (!base) return

  svg.style.width = `${base * scale}px`
  svg.style.height = 'auto'
}

function ZoomToolbar({ scale, onZoomIn, onZoomOut, onReset, onExpand, expandLabel = 'Развернуть' }) {
  return (
    <div className="mmd-zoom-toolbar" role="toolbar" aria-label="Масштаб диаграммы">
      <button type="button" className="mmd-zoom-btn" onClick={onZoomOut} disabled={scale <= ZOOM_MIN} title="Уменьшить" aria-label="Уменьшить">
        −
      </button>
      <span className="mmd-zoom-label">{Math.round(scale * 100)}%</span>
      <button type="button" className="mmd-zoom-btn" onClick={onZoomIn} disabled={scale >= ZOOM_MAX} title="Увеличить" aria-label="Увеличить">
        +
      </button>
      <button type="button" className="mmd-zoom-btn" onClick={onReset} title="Сбросить масштаб" aria-label="Сбросить масштаб">
        100%
      </button>
      {onExpand && (
        <button type="button" className="mmd-zoom-btn" onClick={onExpand} title={expandLabel} aria-label={expandLabel}>
          ⛶
        </button>
      )}
    </div>
  )
}

function DiagramViewport({ svg, scale, root, expanded = false }) {
  const hostRef = useRef(null)

  useEffect(() => {
    if (!svg || !hostRef.current) return
    applySvgScale(hostRef.current, scale)
  }, [svg, scale])

  useEffect(() => {
    if (!hostRef.current) return
    const svgEl = hostRef.current.querySelector('svg')
    if (svgEl) delete svgEl.dataset.baseWidth
  }, [svg])

  return (
    <div className={`mmd-viewport${expanded ? ' is-expanded' : ''}`}>
      <div
        ref={hostRef}
        className={`${root}-svg mmd-svg-host`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export default function MermaidDiagram({ chart, title, kind, classPrefix = 'flows', zoomable = false }) {
  const baseId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState(null)
  const [scale, setScale] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const fp = chartFingerprint(chart)

  useEffect(() => {
    let cancelled = false
    setSvg('')
    setErr(null)
    setScale(1)
    setExpanded(false)
    const id = `mmd-${baseId.replace(/[^a-zA-Z0-9_-]/g, '')}-${kind}-${fp}`

    renderMermaidChart(id, chart)
      .then((rendered) => {
        if (!cancelled) setSvg(rendered)
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || String(e))
      })

    return () => {
      cancelled = true
    }
  }, [chart, baseId, kind, fp])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const zoomIn = useCallback(() => setScale((s) => Math.min(ZOOM_MAX, +(s + ZOOM_STEP).toFixed(2))), [])
  const zoomOut = useCallback(() => setScale((s) => Math.max(ZOOM_MIN, +(s - ZOOM_STEP).toFixed(2))), [])
  const resetZoom = useCallback(() => setScale(1), [])

  const root = `${classPrefix}-mermaid`
  const titleCls = `${classPrefix}-mermaid-title`

  if (err) {
    return (
      <div className={`${root} ${root}-error`}>
        <p className={titleCls}>{title}</p>
        <pre>{err}</pre>
      </div>
    )
  }

  const toolbar = zoomable && svg && (
    <ZoomToolbar
      scale={scale}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onReset={resetZoom}
      onExpand={() => setExpanded(true)}
    />
  )

  return (
    <>
      <div className={root}>
        <div className="mmd-head">
          <p className={titleCls}>{title}</p>
          {toolbar}
        </div>
        {svg ? (
          <DiagramViewport svg={svg} scale={scale} root={root} />
        ) : (
          <p className={`${classPrefix}-muted`}>Рисуем…</p>
        )}
      </div>

      {expanded && svg && (
        <div className="mmd-modal-backdrop" onClick={() => setExpanded(false)} role="presentation">
          <div className="mmd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
            <header className="mmd-modal-head">
              <h3 className="mmd-modal-title">{title}</h3>
              <ZoomToolbar scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
              <button type="button" className="mmd-modal-close" onClick={() => setExpanded(false)} aria-label="Закрыть">
                ×
              </button>
            </header>
            <div className="mmd-modal-body">
              <DiagramViewport svg={svg} scale={scale} root={root} expanded />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
