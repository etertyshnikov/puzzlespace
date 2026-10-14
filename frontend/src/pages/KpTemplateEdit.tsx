import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { HtmlCodeEditor } from '../components/HtmlCodeEditor'
import { buildKpPreviewHtml, openKpHtmlPrintTab } from '../utils/kpPreviewHtml'

/** Пример альбомного КП: 3 листа (.kp-page). Подложка в PDF — после рендера (см. pdf_kp_background). */
const SAMPLE_HTML = `<!-- kp-layout:landscape -->
<div class="kp-landscape-doc">
  <div class="kp-page">
    <div class="kp-panel">
      <header class="kp-header">
        <div>
          <div class="kp-logo"><img class="kp-logo-img" src="/static/images/logo%20KP.png" alt="Дома Кубани" />
            <span>Дома из минибруса</span>
          </div>
        </div>
        <div class="kp-meta">
          <strong>Коммерческое предложение</strong>
          № {{kp_number}} от {{kp_date}}<br/>
          Срок действия: {{kp_validity_days}} календарных дней
          <span class="kp-badge">Предварительный расчёт</span>
        </div>
      </header>
      <p>Уважаемый(ая) <strong>{{customer_full_name}}</strong>!</p>
      <section class="kp-block">
        <h2>1. Параметры объекта</h2>
        <table class="kp-info">
          <tr><td>Проект</td><td>{{project_number}} — {{project_name}}</td></tr>
          <tr><td>Заказчик</td><td>{{customer_contact_line}}</td></tr>
          <tr><td>Тип дома</td><td>{{house_type}}</td></tr>
          <tr><td>Площадь</td><td>{{house_area}}</td></tr>
        </table>
      </section>
    </div>
  </div>

  <div class="kp-page">
    <div class="kp-panel kp-panel-table">
      <section class="kp-block">
        <h2>2. Состав и стоимость</h2>
        <table class="kp-table">
          <thead>
            <tr>
              <th>№</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Сумма</th>
            </tr>
          </thead>
          <tbody>{{kp_items_table}}</tbody>
        </table>
        <p class="kp-total">Итого: <strong>{{total_amount}}</strong></p>
      </section>
    </div>
  </div>

  <div class="kp-page">
    <div class="kp-panel">
      <section class="kp-block">
        <h2>3. Условия оплаты</h2>
        <ol>
          <li>Аванс — {{prepayment}}</li>
          <li>Остаток — {{balance}}</li>
        </ol>
      </section>
      <p>С уважением,<br/><strong>ООО &quot;ПСК &quot;Дома кубани&quot;</strong></p>
    </div>
  </div>
</div>`

export function KpTemplateEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    const numId = Number(id)
    if (!Number.isFinite(numId)) return
    api.kpHtmlTemplates
      .get(numId)
      .then((t) => {
        setTitle(t.title)
        setDescription(t.description ?? '')
        setHtml(t.html_content ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const previewDoc = useMemo(() => buildKpPreviewHtml(html), [html])

  const handlePrint = useCallback(() => {
    openKpHtmlPrintTab(html)
  }, [html])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Укажите название')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      html_content: html,
    }
    const req = isNew
      ? api.kpHtmlTemplates.create(payload)
      : api.kpHtmlTemplates.update(Number(id), payload)
    req
      .then((t) => navigate(`/settings/kp-templates/${t.id}/edit`, { replace: true }))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSaving(false))
  }

  if (loading) return <p style={{ color: '#73879C' }}>Загрузка…</p>

  return (
    <>
      <header className="page-title" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{isNew ? 'Новый шаблон КП' : `Шаблон КП: ${title}`}</h2>
        <p style={{ margin: '6px 0 0', color: '#73879C', fontSize: 13 }}>
          HTML и предпросмотр. Подложка на каждый лист PDF накладывается при скачивании КП.
        </p>
      </header>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 'calc(100vh - 200px)' }}>
        {error ? (
          <p style={{ color: '#E74C3C', margin: 0, padding: '8px 12px', background: '#fdf0ef', borderRadius: 4 }}>{error}</p>
        ) : null}

        <section className="x_panel" style={{ marginBottom: 0 }}>
          <div className="x_content" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <label style={{ flex: '1 1 240px' }}>
              <span style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Название</span>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label style={{ flex: '2 1 320px' }}>
              <span style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Описание (необязательно)</span>
              <input
                type="text"
                className="form-control"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-default btn-sm" onClick={() => setHtml(SAMPLE_HTML)}>
                Пример HTML
              </button>
              <button type="button" className="btn btn-default btn-sm" onClick={handlePrint} disabled={!html.trim()}>
                Печать
              </button>
              <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" className="btn btn-default btn-sm" onClick={() => navigate('/settings/kp-templates')}>
                К списку
              </button>
            </span>
          </div>
        </section>

        <article className="x_panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0, flex: 1 }}>
          <header className="x_title" style={{ padding: '10px 16px' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>HTML</h3>
          </header>
          <section style={{ padding: '0 16px 16px' }}>
            <HtmlCodeEditor value={html} onChange={setHtml} height="480px" />
          </section>
          <header className="x_title" style={{ padding: '10px 16px', borderTop: '1px solid #E6E9ED' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Предпросмотр</h3>
          </header>
          <section style={{ padding: '0 16px 16px' }}>
            {html.trim() ? (
              <iframe
                title="Превью КП"
                srcDoc={previewDoc}
                style={{ width: '100%', height: 480, border: '1px solid #E6E9ED', borderRadius: 4, background: '#fff' }}
                sandbox="allow-same-origin"
              />
            ) : (
              <p
                style={{
                  height: 480,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#73879C',
                  border: '1px dashed #ccc',
                  borderRadius: 4,
                  margin: 0,
                }}
              >
                Введите HTML или нажмите «Пример HTML»
              </p>
            )}
          </section>
        </article>
      </form>
    </>
  )
}
