import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Puck, usePuck, Button } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { DEFAULT_RULES } from './ruleData.js'
import { RulesDrawer, StepsLibrary } from './RulesPuckPanels.jsx'
import { rulesConfig, stepKey } from './rulesConfig.jsx'
import {
  DEFAULT_SPEC_INPUTS,
  MOCK_SPEC_ITEMS,
  applyTestRecalc,
} from './mockSpecData.js'
import { SpecInputsPanel } from './SpecInputsPanel.jsx'
import SpecTable from './SpecTable.jsx'

const STORAGE_KEY = 'smetadomacrm-v2-calc-rules-sandbox'

const SandboxSpecContext = createContext(null)

function SandboxRootView() {
  const ctx = useContext(SandboxSpecContext)
  if (!ctx) return null
  return (
    <SpecTable
      spec={ctx.spec}
      items={ctx.items}
      activeRule={ctx.activeRule}
      steps={ctx.steps}
    />
  )
}

const sandboxConfig = {
  ...rulesConfig,
  root: {
    ...rulesConfig.root,
    label: 'Шаги',
    render: () => <SandboxRootView />,
  },
}

function loadRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_RULES
  } catch {
    return DEFAULT_RULES
  }
}

function ruleToPuckData(rule) {
  return {
    root: { props: { note: 'Тестовый режим: таблица спецификации в центре.' } },
    content: (rule?.steps ?? []).map((step) => ({
      type: stepKey(step.type),
      props: { id: step.id, formula: step.formula ?? '' },
    })),
  }
}

function puckDataToSteps(content) {
  return content.map((item) => ({
    id: item.props?.id ?? `step-${item.type}-${Math.random().toString(36).slice(2, 7)}`,
    type: item.type.replace(/_/g, '-'),
    label: rulesConfig.components[item.type]?.label ?? item.type,
    formula: item.props?.formula ?? '',
  }))
}

function FieldsPanel({ children }) {
  const selectedItem = usePuck((s) => s.selectedItem)

  if (selectedItem) {
    return (
      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {children}
      </form>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <StepsLibrary />
    </div>
  )
}

export default function RuleConstructorSandbox() {
  const [rules, setRules] = useState(loadRules)
  const [activeRuleId, setActiveRuleId] = useState(() => loadRules()[0]?.id ?? null)
  const [spec, setSpec] = useState(DEFAULT_SPEC_INPUTS)
  const [items, setItems] = useState(MOCK_SPEC_ITEMS)

  const activeRule = useMemo(
    () => rules.find((r) => r.id === activeRuleId) ?? rules[0] ?? null,
    [rules, activeRuleId],
  )

  const puckData = useMemo(() => ruleToPuckData(activeRule), [activeRule])

  const specContextValue = useMemo(
    () => ({
      spec,
      items,
      activeRule,
      steps: activeRule?.steps,
    }),
    [spec, items, activeRule],
  )

  const persist = useCallback((next) => {
    setRules(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const savePuckData = useCallback(
    (data) => {
      if (!activeRuleId) return
      const steps = puckDataToSteps(data.content ?? [])
      persist(rules.map((r) => (r.id === activeRuleId ? { ...r, steps } : r)))
    },
    [activeRuleId, persist, rules],
  )

  const runRule = () => {
    if (!activeRule) return
    const next = applyTestRecalc(MOCK_SPEC_ITEMS, spec, activeRule.name)
    setItems(next.map((r) => ({ ...r, total: r.quantity * r.price })))
    window.alert(
      `Тестовый пересчёт «${activeRule.name}»\nГабариты: ${spec.length_m}×${spec.width_m} м, ${spec.floors} эт.\nСтрок в таблице: ${next.length}`,
    )
  }

  if (!activeRule) return null

  return (
    <SandboxSpecContext.Provider value={specContextValue}>
      <Puck
        key={activeRuleId}
        config={sandboxConfig}
        data={puckData}
        iframe={{ enabled: false }}
        onChange={(data) => savePuckData(data)}
        onPublish={(data) => {
          savePuckData(data)
          runRule()
        }}
        headerTitle="SmetadomaCRM Landing"
        headerPath="/"
        overrides={{
          drawer: () => (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
              <SpecInputsPanel spec={spec} onChange={setSpec} />
              <RulesDrawer rules={rules} activeRuleId={activeRuleId} onSelect={setActiveRuleId} />
            </div>
          ),
          fields: (props) => <FieldsPanel {...props} />,
          headerActions: ({ children }) => (
            <>
              <Button type="button" onClick={runRule}>
                Запуск
              </Button>
              {children}
            </>
          ),
        }}
      />
    </SandboxSpecContext.Provider>
  )
}
