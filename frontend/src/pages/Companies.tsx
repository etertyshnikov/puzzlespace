import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Company, type Organization } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

export function Companies() {
  const colSpan = useSettingsTableColSpan(6)
  const [list, setList] = useState<Company[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([api.companies.list(), api.organizations.list({ limit: 5000 })])
      .then(([companies, orgs]) => {
        setList(companies)
        setOrganizations(orgs)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const orgCountByCompanyId = useMemo(() => {
    const map = new Map<number, number>()
    for (const o of organizations) {
      if (o.company_id != null) {
        map.set(o.company_id, (map.get(o.company_id) ?? 0) + 1)
      }
    }
    return map
  }, [organizations])

  const remove = (id: number, name: string) => {
    if (!confirm(`Удалить компанию «${name}»?`)) return
    api.companies
      .delete(id)
      .then(() => setList((prev) => prev.filter((c) => c.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div style={{ color: '#73879C' }}>Загрузка…</div>
  if (error) return <div style={{ color: '#E74C3C' }}>{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Компании</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {list.length}</p>
        </div>
        <SettingsAddLink to="/settings/companies/new">Добавить компанию</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <table className="table table-striped">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Название</th>
                <th style={{ width: 120 }}>Код</th>
                <th style={{ width: 120 }}>Организаций</th>
                <th style={{ width: 80 }}>Активна</th>
                <SettingsActionTh />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                    Нет компаний.
                  </td>
                </tr>
              ) : (
                list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                    <td>{c.code ?? '—'}</td>
                    <td>
                      <Link to={`/settings/organizations?company_id=${c.id}`}>
                        {orgCountByCompanyId.get(c.id) ?? 0}
                      </Link>
                    </td>
                    <td>
                      <span className={c.is_active ? 'badge badge-success' : 'badge badge-default'}>
                        {c.is_active ? 'Да' : 'Нет'}
                      </span>
                    </td>
                    <SettingsActionTd>
                      <EditLinkIcon to={`/settings/companies/${c.id}/edit`} />
                      <DeleteIconButton onClick={() => remove(c.id, c.name)} />
                    </SettingsActionTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
