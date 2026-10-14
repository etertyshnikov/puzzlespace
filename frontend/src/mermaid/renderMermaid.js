let initPromise = null
let renderQueue = Promise.resolve()

async function getMermaid() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      // htmlLabels + React = getAttribute(null); SVG-метки стабильнее
      flowchart: { htmlLabels: false, curve: 'basis' },
    })
    return mermaid
  })()
  return initPromise
}

export function isErrorSvg(svg) {
  return /Syntax error in text|aria-roledescription="error"/i.test(svg)
}

function sanitizeRenderId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function renderOnce(safeId, chart) {
  const mermaid = await getMermaid()
  await mermaid.parse(chart)

  const host = document.createElement('div')
  host.id = `host-${safeId}`
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden'
  document.body.appendChild(host)

  try {
    const { svg } = await mermaid.render(safeId, chart, host)
    if (isErrorSvg(svg)) {
      throw new Error('Mermaid: ошибка синтаксиса диаграммы')
    }
    return svg
  } finally {
    host.remove()
    document.getElementById(`d${safeId}`)?.remove()
    document.getElementById(safeId)?.remove()
  }
}

/** Последовательный render — Mermaid 11 ломается при параллельных вызовах */
export function renderMermaidChart(id, chart) {
  const safeId = sanitizeRenderId(id)
  const job = renderQueue.then(() => renderOnce(safeId, chart))
  renderQueue = job.catch(() => {})
  return job
}
