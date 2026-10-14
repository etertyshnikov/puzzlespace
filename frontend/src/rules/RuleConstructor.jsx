import { useCallback, useMemo, useState } from 'react'
import { Puck, usePuck, Button } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { DEFAULT_RULES } from './ruleData.js'
import { RulesDrawer, StepsLibrary } from './RulesPuckPanels.jsx'
import { rulesConfig, stepKey } from './rulesConfig.jsx'

const STORAGE_KEY = 'smetadomacrm-v2-calc-rules'

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
    root: { props: { note: 'Перетащите шаг из панели «Шаги».' } },
    content: (rule?.steps ?? []).map((step) => ({
      type: stepKey(step.type),
      props: {
        id: step.id,
        formula: step.formula ?? '',
      },
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

function FieldsPanel({ children, isLoading }) {
  const selectedItem = usePuck((s) => s.selectedItem)

  if (selectedItem) {
    return (
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
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

export default function RuleConstructor() {
  const [rules, setRules] = useState(loadRules)
  const [activeRuleId, setActiveRuleId] = useState(() => loadRules()[0]?.id ?? null)

  const activeRule = useMemo(
    () => rules.find((r) => r.id === activeRuleId) ?? rules[0] ?? null,
    [rules, activeRuleId],
  )

  const puckData = useMemo(() => ruleToPuckData(activeRule), [activeRule])

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

  const selectRule = (ruleId) => {
    setActiveRuleId(ruleId)
  }

  const runRule = () => {
    if (!activeRule) return
    window.alert(
      `Тестовый запуск «${activeRule.name}» (${activeRule.steps?.length ?? 0} шагов).\nAPI — в следующей фазе.`,
    )
  }

  if (!activeRule) return null

  return (
    <Puck
      key={activeRuleId}
      config={rulesConfig}
      data={puckData}
      onChange={(data) => savePuckData(data)}
      onPublish={(data) => {
        savePuckData(data)
        window.alert(`Правило «${activeRule.name}» сохранено.`)
      }}
      headerTitle="SmetadomaCRM Landing"
      headerPath="/"
      overrides={{
        drawer: () => (
          <RulesDrawer rules={rules} activeRuleId={activeRuleId} onSelect={selectRule} />
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
  )
}
