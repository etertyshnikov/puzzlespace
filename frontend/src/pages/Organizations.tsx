import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Organization } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function Organizations() {
  const colSpan = useSettingsTableColSpan(8)
  const [searchParams] = useSearchParams()
  const companyFilterId = (() => {
    const raw = searchParams.get('company_id')
    if (raw == null) return null
    const id = parseInt(raw, 10)
    return Number.isFinite(id) ? id : null
  })()
  const [list, setList] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.organizations
      .list({ limit: 5000, company_id: companyFilterId ?? undefined })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [companyFilterId])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить организацию «${name}»?`)) return
    api.organizations
      .delete(id)
      .then(() => setList((prev) => prev.filter((o) => o.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Организации</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>
            Всего: {list.length}
            {companyFilterId != null && (
              <>
                {' · '}
                <Link to="/settings/organizations">Сбросить фильтр по компании</Link>
              </>
            )}
          </p>
        </div>
        <SettingsAddLink to="/settings/organizations/new">Добавить организацию</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Компания</th>
                  <th>Название</th>
                  <th>ИНН</th>
                  <th>КПП</th>
                  <th>Адрес</th>
                  <th>По умолчанию</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет организаций.
                    </td>
                  </tr>
                ) : (
                  list.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.company_name ?? '—'}</td>
                      <td>{o.name}</td>
                      <td>{o.inn ?? '—'}</td>
                      <td>{o.kpp ?? '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address ?? '—'}</td>
                      <td>
                        <span className={o.is_default ? 'badge badge-success' : 'badge badge-default'}>
                          {o.is_default ? 'Да' : 'Нет'}
                        </span>
                      </td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/organizations/${o.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(o.id, o.name)} />
                      </SettingsActionTd>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
