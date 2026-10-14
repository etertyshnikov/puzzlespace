import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ALL_CONTRACT_PLACEHOLDER_GROUPS } from './Help'
import { HtmlCodeEditor, type HtmlCodeEditorHandle } from '../components/HtmlCodeEditor'

/** Редактор HTML */
const CODE_EDITOR_HEIGHT = '250px'
/** Блок предпросмотра */
const PREVIEW_HEIGHT = 420
/**
 * Высота средней колонки (редактор 250 + предпросмотр 420 + поля формы и кнопки ~280).
 * Используется для прокрутки правой колонки с плейсхолдерами.
 */
const MIDDLE_COLUMN_HEIGHT = 950

type PlaceholderRow = {
  group: string
  description: string
  key: string
}

const PLACEHOLDER_TABLE_ROWS: PlaceholderRow[] = ALL_CONTRACT_PLACEHOLDER_GROUPS.flatMap(({ title, items }) =>
  items.map(({ key, description }) => ({ group: title, description, key }))
)

function buildContractPreviewHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  if (/<!DOCTYPE|<html[\s>]/i.test(trimmed)) return trimmed
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/><style>
    body { margin: 16px 20px; font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
    p { margin: 0.5em 0; }
  </style></head><body>${trimmed}</body></html>`
}

export function ContractTemplateEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<{ id: number; code: string; title: string; body: string } | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeholderFilter, setPlaceholderFilter] = useState('')
  const editorRef = useRef<HtmlCodeEditorHandle | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!id) return
    api.contractTemplates
      .get(Number(id))
      .then((t) => {
        setTemplate({ ...t, body: t.body ?? '' })
        setCode(t.code)
        setTitle(t.title)
        setBody(t.body ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id])

  const insertPlaceholder = (key: string) => {
    if (code.trim() === 'footer') {
      const ta = textareaRef.current
      if (ta) {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const next = body.slice(0, start) + key + body.slice(end)
        setBody(next)
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + key.length, start + key.length) }, 0)
      } else {
        setBody((prev) => prev + key)
      }
      return
    }
    const handle = editorRef.current
    if (handle) {
      handle.insertTextAtCursor(key)
    } else {
      setBody((prev) => prev + key)
    }
  }

  const readBodyForSave = () => {
    if (code.trim() === 'footer') {
      return textareaRef.current?.value ?? body
    }
    return editorRef.current?.getValue() ?? body
  }

  const previewHtml = useMemo(() => buildContractPreviewHtml(body), [body])

  const filteredPlaceholderRows = useMemo(() => {
    const q = placeholderFilter.trim().toLowerCase()
    if (!q) return PLACEHOLDER_TABLE_ROWS
    return PLACEHOLDER_TABLE_ROWS.filter(
      (row) =>
        row.group.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q)
    )
  }, [placeholderFilter])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return
    setSaving(true)
    setError(null)
    const codeTrim = code.trim()
    if (!codeTrim) {
      setError('Укажите код шаблона')
      setSaving(false)
      return
    }
    const bodyToSave = readBodyForSave()
    api.contractTemplates
      .update(template.id, {
        code: codeTrim,
        title: title.trim() || template.title,
        body: bodyToSave,
      })
      .then(() => navigate('/settings/contract-templates'))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error && !template) return <div style={{ color: '#E74C3C' }}>{error}</div>
  if (!template) return null

  return (
    <div>
      <div className="page-title" style={{ marginBottom: 16 }}>
        <h2>Редактирование шаблона: {template.title}</h2>
        <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
          Стейкхолдеры см. в разделе Помощь. Код используется при печати документов в проекте.
        </p>
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="x_panel">
            <div className="x_content">
              <form onSubmit={submit}>
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-3">
                    {error}
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Код шаблона</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                    placeholder="supply, mount, supply_appendix…"
                    maxLength={50}
                    required
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#73879C' }}>
                    Латиница/цифры/подчёркивание, до 50 символов. Стандартные коды: supply, mount, footer, supply_appendix и др.
                  </p>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Название шаблона</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {code.trim() === 'footer' ? 'HTML футера (подписи)' : 'Текст договора (HTML)'}
                  </label>
                  {code.trim() === 'footer' ? (
                    <>
                      <textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={
                          '<table id="contract-table"><tr><td>___________________ Потребитель</td><td></td><td>___________________ Поставщик</td></tr></table>'
                        }
                        style={{
                          width: '100%',
                          minHeight: 160,
                          padding: 12,
                          fontFamily: 'monospace',
                          fontSize: 13,
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          resize: 'vertical',
                        }}
                        spellCheck={false}
                      />
                      <p style={{ fontSize: 12, color: '#73879C', marginTop: 6, marginBottom: 0 }}>
                        В PDF подставляется в нижнее поле каждой страницы, кроме последней (на ней — подписи из
                        раздела 8 договора).
                      </p>
                    </>
                  ) : (
                    <HtmlCodeEditor
                      ref={editorRef}
                      value={body}
                      onChange={(html) => setBody(html)}
                      height={CODE_EDITOR_HEIGHT}
                    />
                  )}
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Предпросмотр</label>
                  {previewHtml ? (
                    <iframe
                      title="Предпросмотр шаблона"
                      srcDoc={previewHtml}
                      style={{
                        width: '100%',
                        height: PREVIEW_HEIGHT,
                        border: '1px solid #E6E9ED',
                        borderRadius: 4,
                        background: '#fff',
                      }}
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <p
                      style={{
                        height: PREVIEW_HEIGHT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#73879C',
                        border: '1px dashed #ccc',
                        borderRadius: 4,
                        margin: 0,
                        fontSize: 13,
                      }}
                    >
                      Введите HTML шаблона
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn btn-success">
                    {saving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button type="button" onClick={() => navigate('/settings/contract-templates')} className="btn btn-default">
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="x_panel" style={{ maxHeight: MIDDLE_COLUMN_HEIGHT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="x_title" style={{ flexShrink: 0 }}>
              <h3>Плейсхолдеры</h3>
            </div>
            <div
              className="x_content"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '8px 12px 12px',
              }}
            >
              <table className="table table-bordered table-condensed" style={{ marginBottom: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: '48%', verticalAlign: 'middle' }}>Группа / Описание</th>
                    <th style={{ width: '52%', verticalAlign: 'middle' }}>Плейсхолдер</th>
                  </tr>
                  <tr>
                    <th colSpan={2} style={{ padding: '6px 8px', background: '#f9fafb' }}>
                      <input
                        type="text"
                        className="form-control input-sm"
                        value={placeholderFilter}
                        onChange={(e) => setPlaceholderFilter(e.target.value)}
                        placeholder="Фильтр по группе, описанию и плейсхолдеру…"
                        style={{ fontSize: 12 }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlaceholderRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ color: '#73879C', textAlign: 'center', padding: 16 }}>
                        Ничего не найдено
                      </td>
                    </tr>
                  ) : (
                    filteredPlaceholderRows.map((row) => (
                      <tr key={row.key}>
                        <td style={{ verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: '#2A3F54', marginBottom: 2 }}>{row.group}</div>
                          <div style={{ color: '#73879C', lineHeight: 1.35 }}>{row.description}</div>
                        </td>
                        <td style={{ verticalAlign: 'top' }}>
                          <code style={{ display: 'block', fontSize: 11, wordBreak: 'break-all', marginBottom: 6 }}>{row.key}</code>
                          <button
                            type="button"
                            className="btn btn-default btn-xs"
                            onClick={() => insertPlaceholder(row.key)}
                          >
                            Вставить
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
