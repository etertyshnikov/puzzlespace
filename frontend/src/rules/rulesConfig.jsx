import { STEP_CATEGORIES } from './ruleData.js'

function stepKey(stepId) {
  return stepId.replace(/-/g, '_')
}

function buildComponents() {
  const components = {}
  for (const cat of STEP_CATEGORIES) {
    for (const step of cat.steps) {
      const key = stepKey(step.id)
      if (components[key]) continue
      components[key] = {
        label: step.label,
        fields: {
          formula: { type: 'textarea', label: 'Формула' },
        },
        defaultProps: {
          formula: '',
        },
        render: ({ formula }) => (
          <div
            style={{
              padding: '10px 14px',
              margin: '6px 0',
              background: 'var(--puck-color-grey-11)',
              border: '1px solid var(--puck-color-grey-09)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: formula ? 6 : 0 }}>{step.label}</div>
            {formula ? (
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: '12px',
                  color: 'var(--puck-color-grey-04)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {formula}
              </pre>
            ) : (
              <span style={{ color: 'var(--puck-color-grey-06)', fontStyle: 'italic' }}>
                Укажите формулу справа
              </span>
            )}
          </div>
        ),
      }
    }
  }
  return components
}

const components = buildComponents()

export const rulesConfig = {
  root: {
    label: 'Шаги',
    fields: {
      note: {
        type: 'text',
        label: 'Подсказка',
      },
    },
    defaultProps: {
      note: 'Перетащите шаг из панели «Шаги» или выберите шаг на холсте.',
    },
    render: ({ children }) => (
      <div style={{ padding: '16px', minHeight: '240px' }}>{children}</div>
    ),
  },
  categories: Object.fromEntries(
    STEP_CATEGORIES.map((cat) => [
      cat.id,
      {
        title: cat.label,
        components: cat.steps.map((s) => stepKey(s.id)).filter((k, i, arr) => arr.indexOf(k) === i),
      },
    ]),
  ),
  components,
}

export { stepKey }
