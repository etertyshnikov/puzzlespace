import { SPEC_INPUT_FIELDS, calcDerived } from './mockSpecData.js'

const fieldWrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 10,
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--puck-color-grey-04)',
}

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--puck-color-grey-09)',
  borderRadius: 4,
  fontSize: 13,
  background: 'var(--puck-color-white)',
}

export function SpecInputsPanel({ spec, onChange }) {
  const derived = calcDerived(spec)

  const setField = (name, value) => {
    onChange({ ...spec, [name]: value })
  }

  return (
    <div className="_ComponentList_1rrlt_1 _ComponentList--isExpanded_1rrlt_5">
      <button type="button" className="_ComponentList-title_1rrlt_17">
        <div>Данные спецификации</div>
        <div className="_ComponentList-titleIcon_1rrlt_53" />
      </button>
      <div className="_ComponentList-content_1rrlt_9" style={{ padding: '8px 10px' }}>
        {SPEC_INPUT_FIELDS.map((field) => (
          <div key={field.name} style={fieldWrap}>
            <label style={labelStyle}>{field.label}</label>
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={!!spec[field.name]}
                onChange={(e) => setField(field.name, e.target.checked)}
              />
            ) : field.type === 'select' ? (
              <select
                style={inputStyle}
                value={spec[field.name] ?? ''}
                onChange={(e) => setField(field.name, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'house' ? 'Дом' : 'Баня'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                style={inputStyle}
                type="number"
                step={field.step}
                min={field.min}
                value={spec[field.name] ?? ''}
                onChange={(e) => setField(field.name, parseFloat(e.target.value) || 0)}
              />
            )}
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 4,
            background: 'var(--puck-color-azure-10)',
            fontSize: 11,
            color: 'var(--puck-color-grey-04)',
            lineHeight: 1.5,
          }}
        >
          <div>Периметр: <strong>{derived.perimeter.toFixed(1)} м</strong></div>
          <div>Площадь: <strong>{derived.area.toFixed(1)} м²</strong></div>
          <div>Множ. этажей: <strong>{derived.lot}</strong></div>
        </div>
      </div>
    </div>
  )
}
