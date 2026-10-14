function esc(s) {
  return String(s)
    .replace(/"/g, '#quot;')
    .replace(/\[/g, '#91;')
    .replace(/\]/g, '#93;')
    .replace(/\(/g, '#40;')
    .replace(/\)/g, '#41;')
}

/** Текст в sequenceDiagram: без ; { } и переносов — они ломают парсер */
function seqEsc(s) {
  return esc(String(s))
    .replace(/;/g, ',')
    .replace(/\{/g, '#123;')
    .replace(/\}/g, '#125;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function seqNote(lines, text) {
  const t = seqEsc(text)
  if (!t) return
  const chunk = 100
  if (t.length <= chunk) {
    lines.push(`  Note over U,UI: ${t}`)
    return
  }
  for (let i = 0; i < t.length; i += chunk) {
    lines.push(`  Note over U,UI: ${t.slice(i, i + chunk)}`)
  }
}

function resultItems(result) {
  if (!result) return []
  return Array.isArray(result) ? result : [result]
}

function stepNodeLabel(step, index) {
  const lines = [`${index + 1}. ${step.screen}`]
  if (step.route) lines.push(step.route.replace(/\//g, '#47;'))
  if (step.side_effect) lines.push(step.side_effect)
  return esc(lines.join('\\n'))
}

function parallelBranchLabel(branch) {
  const lines = [branch.screen]
  if (branch.side_effect) lines.push(branch.side_effect)
  return esc(lines.join('\\n'))
}

function edgeLabel(step) {
  if (!step?.action) return esc('-')
  const short = step.action.length > 48 ? `${step.action.slice(0, 45)}...` : step.action
  return esc(short)
}

function prevHasParallel(steps, i) {
  return i > 0 && Boolean(steps[i - 1].parallel?.length)
}

export function flowToFlowchart(flow) {
  const lines = ['flowchart LR']
  let displayNum = 0

  flow.steps.forEach((step, i) => {
    const prev = i > 0 ? flow.steps[i - 1] : null
    const nextId = i + 1 < flow.steps.length ? `S${i + 1}` : null
    const nid = `S${i}`

    if (step.parallel?.length) {
      displayNum += 1
      const hubLabel = esc(`${displayNum}. ${step.screen}\\n${step.route || ''}`)
      lines.push(`  ${nid}["${hubLabel}"]`)
      lines.push(`  style ${nid} fill:#fff7ed,stroke:#b45309`)

      if (i > 0 && !prev?.parallel?.length) {
        lines.push(`  S${i - 1} -->|"${edgeLabel(prev)}"| ${nid}`)
      }

      step.parallel.forEach((branch, bi) => {
        const bid = `${nid}P${bi}`
        lines.push(`  ${bid}["${parallelBranchLabel(branch)}"]`)
        lines.push(`  style ${bid} fill:#fff7ed,stroke:#b45309`)
        lines.push(`  ${nid} --> ${bid}`)
        if (nextId) {
          lines.push(`  ${bid} --> ${nextId}`)
        }
      })
      return
    }

    displayNum += 1
    lines.push(`  ${nid}["${stepNodeLabel(step, displayNum - 1)}"]`)
    if (step.system) {
      lines.push(`  style ${nid} fill:#fff7ed,stroke:#b45309`)
    }

    if (i > 0 && !prevHasParallel(flow.steps, i)) {
      lines.push(`  S${i - 1} -->|"${edgeLabel(prev)}"| ${nid}`)
    }
  })

  return lines.join('\n')
}

export function flowToSequence(flow) {
  const lines = ['sequenceDiagram', `  actor U as ${seqEsc(flow.actor)}`]
  lines.push('  participant UI as React SPA')
  lines.push('  participant API as FastAPI')
  lines.push('  participant DB as PostgreSQL')

  flow.steps.forEach((step) => {
    if (step.action && !step.system) {
      lines.push(`  U->>UI: ${seqEsc(step.action)}`)
    }
    if (step.route && !step.system) {
      lines.push(`  Note over UI: ${seqEsc(`${step.screen} ${step.route}`)}`)
    }

    if (step.system && step.parallel?.length) {
      lines.push(`  UI->>API: ${seqEsc(step.route || step.action)}`)
      lines.push('  par Transaction')
      step.parallel.forEach((branch, bi) => {
        const detail = branch.result
          ? resultItems(branch.result).join(', ')
          : branch.side_effect || branch.screen
        if (bi === 0) {
          lines.push(`    API->>DB: ${seqEsc(detail)}`)
        } else {
          lines.push('  and')
          lines.push(`    API->>DB: ${seqEsc(detail)}`)
        }
      })
      lines.push('  end')
      lines.push('  API-->>UI: 201 Created')
    } else if (step.system) {
      lines.push(`  UI->>API: ${seqEsc(step.route || step.action)}`)
      resultItems(step.result).forEach((r) => {
        lines.push(`  API->>DB: ${seqEsc(r)}`)
      })
      if (!step.result && step.side_effect) {
        lines.push(`  API->>DB: ${seqEsc(step.side_effect)}`)
      }
      lines.push('  API-->>UI: 201 Created')
    }

    if (step.result && !step.system) {
      resultItems(step.result).forEach((r) => seqNote(lines, r))
    }
  })

  return lines.join('\n')
}

export function chartFingerprint(chart) {
  let h = 0
  for (let i = 0; i < chart.length; i += 1) {
    h = (Math.imul(31, h) + chart.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}
