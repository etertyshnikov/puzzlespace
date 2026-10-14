import { QTY_BASIS_GENERAL_NOTES, QTY_BASIS_NOTATION, QTY_BASIS_RULES } from '../data/qtyBasisRules'

function useFloorsLabel(v: (typeof QTY_BASIS_RULES)[0]['useFloors']): string {
  if (v === 'optional') return 'По настройке шаблона'
  if (v === 'never') return 'Нет'
  return '—'
}

export function QtyBasisRulesPage() {
  return (
    <div>
      <div className="page-title">
        <h2>Правила расчёта количества</h2>
        <p style={{ margin: '8px 0 0', color: '#73879C', fontSize: 13, maxWidth: 720 }}>
          Справочник правил для позиций шаблона дома. Используются при заполнении спецификации по габаритам
          дома (длина, ширина, этажность, комнаты, терраса, балкон, двойной брус).
        </p>
      </div>

      <div className="x_panel" style={{ marginBottom: 16 }}>
        <div className="x_title">
          <h2>Обозначения</h2>
        </div>
        <div className="x_content" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table table-striped" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 72 }}>Символ</th>
                <th>Значение</th>
              </tr>
            </thead>
            <tbody>
              {QTY_BASIS_NOTATION.map((row) => (
                <tr key={row.symbol}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, verticalAlign: 'top' }}>{row.symbol}</td>
                  <td style={{ verticalAlign: 'top', color: '#2A3F54', lineHeight: 1.45 }}>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="x_panel" style={{ marginBottom: 16 }}>
        <div className="x_title">
          <h2>Общие сведения</h2>
        </div>
        <div className="x_content">
          <ul style={{ margin: 0, paddingLeft: 20, color: '#2A3F54', lineHeight: 1.55 }}>
            {QTY_BASIS_GENERAL_NOTES.map((note) => (
              <li key={note} style={{ marginBottom: 6 }}>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="x_panel">
        <div className="x_title">
          <h2>Правила ({QTY_BASIS_RULES.length})</h2>
        </div>
        <div className="x_content" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table table-striped" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Название</th>
                <th style={{ minWidth: 220 }}>Формула</th>
                <th>Описание</th>
                <th style={{ width: 120 }}>Этажность</th>
                <th style={{ width: 100 }}>Ручной ввод</th>
                <th style={{ minWidth: 160 }}>Поля спецификации</th>
              </tr>
            </thead>
            <tbody>
              {QTY_BASIS_RULES.map((rule) => (
                <tr key={rule.id}>
                  <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{rule.title}</td>
                  <td style={{ verticalAlign: 'top', fontFamily: 'monospace', fontSize: 12, color: '#2A3F54' }}>
                    {rule.formula}
                  </td>
                  <td style={{ verticalAlign: 'top', color: '#2A3F54', lineHeight: 1.45 }}>{rule.description}</td>
                  <td style={{ verticalAlign: 'top', color: '#73879C', fontSize: 13 }}>{useFloorsLabel(rule.useFloors)}</td>
                  <td style={{ verticalAlign: 'top', color: '#73879C', fontSize: 13 }}>{rule.manualQty ? 'Да' : 'Нет'}</td>
                  <td style={{ verticalAlign: 'top', fontSize: 13, color: '#73879C' }}>
                    {rule.specFields.length > 0 ? rule.specFields.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
