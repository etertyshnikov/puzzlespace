import { useEffect, useState } from 'react'
import { api, type PrintSettings, type PrintSettingsUpdate } from '../api/client'
import { useSettingsReadOnly } from '../context/SettingsReadOnlyContext'

export function PrintSettingsPage() {
  const settingsReadOnly = useSettingsReadOnly()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PrintSettingsUpdate & { id?: number }>({
    margin_top_mm: 20,
    margin_bottom_mm: 25,
    margin_left_mm: 15,
    margin_right_mm: 15,
    font_size_pt: 12,
    font_family: 'Arial, sans-serif',
  })

  useEffect(() => {
    api.printSettings
      .get()
      .then((s: PrintSettings) =>
        setForm({
          id: s.id,
          margin_top_mm: s.margin_top_mm,
          margin_bottom_mm: s.margin_bottom_mm,
          margin_left_mm: s.margin_left_mm,
          margin_right_mm: s.margin_right_mm,
          font_size_pt: s.font_size_pt,
          font_family: s.font_family,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (settingsReadOnly) return
    setSaving(true)
    setError(null)
    api.printSettings
      .update({
        margin_top_mm: form.margin_top_mm,
        margin_bottom_mm: form.margin_bottom_mm,
        margin_left_mm: form.margin_left_mm,
        margin_right_mm: form.margin_right_mm,
        font_size_pt: form.font_size_pt,
        font_family: form.font_family ?? 'Arial, sans-serif',
      })
      .then(() => {})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>

  return (
    <div>
      <div className="page-title">
        <h2>Настройки печати</h2>
        <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
          Поля страницы и шрифт для предпросмотра и печати договора (отображаются в iframe и при печати).
        </p>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <form onSubmit={submit} style={{ maxWidth: 400 }}>
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div className="form-group">
              <label className="control-label">Отступ сверху (мм)</label>
              <input
                type="number"
                min={0}
                value={form.margin_top_mm ?? 20}
                onChange={(e) => setForm((f) => ({ ...f, margin_top_mm: parseInt(e.target.value, 10) || 0 }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Отступ снизу (мм)</label>
              <input
                type="number"
                min={0}
                value={form.margin_bottom_mm ?? 25}
                onChange={(e) => setForm((f) => ({ ...f, margin_bottom_mm: parseInt(e.target.value, 10) || 0 }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Отступ слева (мм)</label>
              <input
                type="number"
                min={0}
                value={form.margin_left_mm ?? 15}
                onChange={(e) => setForm((f) => ({ ...f, margin_left_mm: parseInt(e.target.value, 10) || 0 }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Отступ справа (мм)</label>
              <input
                type="number"
                min={0}
                value={form.margin_right_mm ?? 15}
                onChange={(e) => setForm((f) => ({ ...f, margin_right_mm: parseInt(e.target.value, 10) || 0 }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Размер шрифта (pt)</label>
              <input
                type="number"
                min={8}
                max={24}
                value={form.font_size_pt ?? 12}
                onChange={(e) => setForm((f) => ({ ...f, font_size_pt: parseInt(e.target.value, 10) || 12 }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Шрифт</label>
              <input
                type="text"
                value={form.font_family ?? 'Arial, sans-serif'}
                onChange={(e) => setForm((f) => ({ ...f, font_family: e.target.value }))}
                disabled={settingsReadOnly}
                className="form-control"
                style={{ maxWidth: 280 }}
              />
            </div>
            {!settingsReadOnly && (
              <div className="form-group">
                <button type="submit" disabled={saving} className="btn btn-success">
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
