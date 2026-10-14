import { useEffect, useMemo, useState } from 'react'
import { FLOW_GROUPS } from './index.js'
import { flowToFlowchart, flowToSequence } from './flowToMermaid.js'
import MermaidDiagram from '../mermaid/MermaidDiagram.jsx'
import './flows.css'

function FieldRow({ field }) {
  const opts =
    field.options &&
    (Array.isArray(field.options)
      ? field.options
          .map((o) => (typeof o === 'object' ? o.label || o.value : o))
          .join(', ')
      : field.options)

  return (
    <tr>
      <td>
        <code>{field.name}</code>
      </td>
      <td>{field.label}</td>
      <td>{field.type}</td>
      <td>{field.required ? 'да' : '—'}</td>
      <td>
        {field.default != null && <span>по умолч.: {String(field.default)} </span>}
        {field.format && <span>{field.format} </span>}
        {opts && <span>{opts}</span>}
        {field.source && <span>{field.source}</span>}
        {field.validation && <span>{field.validation}</span>}
        {field.note && <span>{field.note}</span>}
      </td>
      <td>{field.db || '—'}</td>
    </tr>
  )
}

function StepCard({ step, index }) {
  return (
    <article className="flows-step">
      <header className="flows-step-head">
        <span className="flows-step-num">{index + 1}</span>
        <div>
          <h3>
            {step.screen}
            {step.system && <span className="flows-step-system"> бэкенд</span>}
          </h3>
          {step.route && (
            <code className="flows-route">{step.route}</code>
          )}
          {step.side_effect && (
            <p className="flows-side-effect">{step.side_effect}</p>
          )}
        </div>
      </header>
      {step.action && <p className="flows-step-action">{step.action}</p>}
      {step.parallel_note && (
        <p className="flows-parallel-note">{step.parallel_note}</p>
      )}
      {step.parallel?.length > 0 && (
        <div className="flows-parallel">
          {step.parallel.map((branch) => (
            <div key={branch.id} className="flows-parallel-branch">
              <strong>{branch.screen}</strong>
              {branch.side_effect && <p>{branch.side_effect}</p>}
              {branch.result?.length > 0 && (
                <ul>
                  {branch.result.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {step.ui_notes?.length > 0 && (
        <ul className="flows-notes">
          {step.ui_notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {step.fields?.length > 0 && (
        <div className="flows-table-wrap">
          <table className="flows-table">
            <thead>
              <tr>
                <th>Поле</th>
                <th>Подпись</th>
                <th>Тип</th>
                <th>Обяз.</th>
                <th>Детали</th>
                <th>БД</th>
              </tr>
            </thead>
            <tbody>
              {step.fields.map((f) => (
                <FieldRow key={f.name} field={f} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {step.buttons?.length > 0 && (
        <p className="flows-buttons">
          Кнопки:{' '}
          {step.buttons.map((b) => b.label).join(', ')}
        </p>
      )}
      {step.result && (
        <div className="flows-result">
          <strong>Результат:</strong>
          <ul>
            {(Array.isArray(step.result) ? step.result : [step.result]).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function FlowDetail({ flow }) {
  const flowchart = useMemo(() => flowToFlowchart(flow), [flow])
  const sequence = useMemo(() => flowToSequence(flow), [flow])

  return (
    <div className="flows-detail">
      <header className="flows-detail-head">
        <h2>{flow.title}</h2>
        <p className="flows-meta">
          <span>Источник: {flow.source}</span>
          <span>Роль: {flow.actor}</span>
          <span>
            ID: <code>{flow.id}</code>
          </span>
          {flow.implementation === 'planned' && (
            <span className="flows-badge flows-badge-planned">Запланировано (нет в as-is)</span>
          )}
        </p>
        {flow.implementation_note && (
          <p className="flows-impl-note">{flow.implementation_note}</p>
        )}
        {flow.business_rules?.length > 0 && (
          <div className="flows-pre">
            <strong>Бизнес-правила:</strong>
            <ul>
              {flow.business_rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {flow.preconditions?.length > 0 && (
          <div className="flows-pre">
            <strong>Условия:</strong>
            <ul>
              {flow.preconditions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className="flows-diagrams">
        <MermaidDiagram chart={flowchart} title="Экраны (flowchart)" kind="flowchart" classPrefix="flows" zoomable />
        <MermaidDiagram chart={sequence} title="Последовательность (sequence)" kind="sequence" classPrefix="flows" />
      </div>

      <section className="flows-steps-section">
        <h3>Шаги и поля</h3>
        {flow.steps.map((step, i) => (
          <StepCard key={step.id} step={step} index={i} />
        ))}
      </section>

      {(flow.api?.length > 0 || flow.entities?.length > 0 || flow.api_planned) && (
        <footer className="flows-footer-meta">
          {flow.api_planned && (
            <div>
              <strong>API (план):</strong>{' '}
              <code className="flows-api-tag">
                {flow.api_planned.method} {flow.api_planned.path}
              </code>
              {flow.api_planned.body && (
                <pre className="flows-api-body">{JSON.stringify(flow.api_planned.body, null, 2)}</pre>
              )}
            </div>
          )}
          {flow.api?.length > 0 && (
            <div>
              <strong>API:</strong>{' '}
              {flow.api.map((a) => (
                <code key={a} className="flows-api-tag">
                  {a}
                </code>
              ))}
            </div>
          )}
          {flow.entities?.length > 0 && (
            <div>
              <strong>Таблицы:</strong>{' '}
              {flow.entities.map((e) => (
                <code key={e} className="flows-entity-tag">
                  {e}
                </code>
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  )
}

export default function FlowViewer({ selectedFlowId = null, onSelectedFlowIdChange = undefined }) {
  const firstFlowId = FLOW_GROUPS[0]?.flows[0]?.id ?? ''
  const [internalId, setInternalId] = useState(firstFlowId)
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.fromEntries(FLOW_GROUPS.map((g) => [g.id, true]))
  )
  const selectedId = selectedFlowId ?? internalId

  const setSelectedId = (id) => {
    setInternalId(id)
    onSelectedFlowIdChange?.(id)
  }

  useEffect(() => {
    if (selectedFlowId) setInternalId(selectedFlowId)
  }, [selectedFlowId])

  const selectedFlow = useMemo(() => {
    for (const g of FLOW_GROUPS) {
      const f = g.flows.find((x) => x.id === selectedId)
      if (f) return f
    }
    return null
  }, [selectedId])

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <div className="flows-viewer">
      <aside className="flows-sidebar">
        <div className="flows-sidebar-head">
          <h1>Сценарии</h1>
          <p className="flows-muted">
            User stories smetadoma05 → диаграммы и поля для Go-версии
          </p>
        </div>
        <nav className="flows-tree" aria-label="Сценарии по разделам">
          {FLOW_GROUPS.map((group) => {
            const open = expandedGroups[group.id] ?? true
            const hasActive = group.flows.some((f) => f.id === selectedId)
            return (
              <div key={group.id} className={`flows-tree-group${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className={`flows-tree-toggle${hasActive ? ' has-active' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                >
                  <span className={`flows-tree-chevron${open ? ' is-open' : ''}`} aria-hidden>
                    ▶
                  </span>
                  <span className="flows-tree-label">{group.label}</span>
                  <span className="flows-tree-count">{group.flows.length}</span>
                </button>
                {open && (
                  <ul className="flows-tree-children">
                    {group.flows.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className={`flows-tree-leaf${selectedId === f.id ? ' is-active' : ''}`}
                          onClick={() => setSelectedId(f.id)}
                        >
                          {f.title}
                          {f.implementation === 'planned' && (
                            <span className="flows-tree-planned" title="Запланировано">
                              ●
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>
        <div className="flows-help">
          <p>
            Файлы:{' '}
            <code>web/src/flows/customers/*.json</code>
          </p>
          <p>
            CRM as-is:{' '}
            <a
              href="http://localhost:8005/customers"
              target="_blank"
              rel="noreferrer"
            >
              localhost:8005/customers
            </a>
          </p>
        </div>
      </aside>
      <div className="flows-main">
        {selectedFlow ? (
          <FlowDetail flow={selectedFlow} />
        ) : (
          <p>Выберите сценарий слева</p>
        )}
      </div>
    </div>
  )
}
