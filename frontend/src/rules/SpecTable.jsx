import { calcDerived } from './mockSpecData.js'

const th = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--puck-color-grey-04)',
  borderBottom: '1px solid var(--puck-color-grey-09)',
  whiteSpace: 'nowrap',
}

const td = {
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: '1px solid var(--puck-color-grey-10)',
  color: 'var(--puck-color-grey-03)',
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export default function SpecTable({ spec, items, activeRule, steps }) {
  const derived = calcDerived(spec)
  const totalSum = items.reduce((s, r) => s + (r.total ?? r.quantity * r.price), 0)

  return (
    <div
      style={{
        minHeight: '100%',
        height: '100%',
        overflow: 'auto',
        padding: 16,
        background: 'var(--puck-color-white, #fff)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--puck-color-grey-05)', marginBottom: 4 }}>
          Тестовая спецификация · A00001-P01-S01
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--puck-color-grey-02)' }}>
          Дом 10×8 м, {spec.floors} эт. — {spec.building_type === 'house' ? 'дом' : 'баня'}
        </h2>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--puck-color-grey-05)' }}>
          {derived.L}×{derived.W} м · периметр {derived.perimeter.toFixed(1)} м · площадь {derived.area.toFixed(1)} м²
          {activeRule && (
            <span style={{ marginLeft: 12, color: 'var(--puck-color-azure-04)' }}>
              Правило: {activeRule.name}
            </span>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--puck-color-grey-09)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead style={{ background: 'var(--puck-color-grey-11)' }}>
            <tr>
              <th style={th}>№</th>
              <th style={th}>Часть</th>
              <th style={th}>Наименование</th>
              <th style={th}>Ед.</th>
              <th style={{ ...th, textAlign: 'right' }}>Авто</th>
              <th style={{ ...th, textAlign: 'right' }}>Кол-во</th>
              <th style={{ ...th, textAlign: 'right' }}>Цена</th>
              <th style={{ ...th, textAlign: 'right' }}>Сумма</th>
              <th style={th}>Правило</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const sum = row.total ?? row.quantity * row.price
              return (
                <tr key={row.id} style={{ background: 'var(--puck-color-white)' }}>
                  <td style={td}>{row.row}</td>
                  <td style={td}>{row.part}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{row.name}</td>
                  <td style={td}>{row.unit}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                    {fmt(row.quantity_auto)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                    {fmt(row.quantity)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(row.price)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(sum)}</td>
                  <td style={{ ...td, fontSize: 11, color: 'var(--puck-color-grey-05)' }}>{row.qty_basis}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--puck-color-grey-11)' }}>
              <td colSpan={7} style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                Итого
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                {fmt(totalSum)} ₽
              </td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>
      </div>

      {steps?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--puck-color-grey-04)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Шаги правила
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--puck-color-grey-04)' }}>
            {steps.map((step, i) => (
              <li key={step.id} style={{ marginBottom: 6 }}>
                <strong>{step.label}</strong>
                {step.formula && (
                  <code
                    style={{
                      display: 'block',
                      marginTop: 2,
                      padding: '4px 8px',
                      background: 'var(--puck-color-grey-11)',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    {step.formula}
                  </code>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
