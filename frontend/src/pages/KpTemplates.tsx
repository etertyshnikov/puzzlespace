import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type KpHtmlTemplate } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

export function KpTemplates() {
  const colSpan = useSettingsTableColSpan(4)
  const [list, setList] = useState<KpHtmlTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.kpHtmlTemplates
      .list({ limit: 500 })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Удалить шаблон КП «${title}»?`)) return
    api.kpHtmlTemplates
      .delete(id)
      .then(() => setList((prev) => prev.filter((t) => t.id !== id)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <p className="text-muted">Загрузка…</p>
  if (error) return <p style={{ color: '#E74C3C' }}>{error}</p>

  return (
    <>
      <header className="page-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Шаблоны КП</h2>
            <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
              HTML-шаблоны коммерческих предложений: редактирование и предпросмотр.
            </p>
          </div>
          <SettingsAddLink to="/settings/kp-templates/new" className="btn btn-primary btn-sm">
            + Добавить
          </SettingsAddLink>
        </div>
      </header>

      <section className="x_panel">
        <div className="x_content">
          <table className="table table-striped">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Название</th>
                <th style={{ width: 160 }}>Изменён</th>
                <SettingsActionTh width={140} />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                    Нет шаблонов.
                  </td>
                </tr>
              ) : (
                list.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>
                      <Link to={`/settings/kp-templates/${t.id}/edit`}>{t.title}</Link>
                      {t.description ? (
                        <p style={{ fontSize: 12, color: '#73879C', margin: '2px 0 0' }}>{t.description}</p>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 13 }}>{formatDate(t.modified_on ?? t.created_on)}</td>
                    <SettingsActionTd>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <EditLinkIcon to={`/settings/kp-templates/${t.id}/edit`} />
                        <DeleteIconButton onClick={() => handleDelete(t.id, t.title)} />
                      </span>
                    </SettingsActionTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
