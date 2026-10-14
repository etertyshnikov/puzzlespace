import { useState, useEffect } from 'react'
import { api, type AuthUserOut } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink } from '../components/SettingsTableChrome'
import { useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  admin_manager: 'Админ/менеджер',
  manager: 'Менеджер',
  agent: 'Агент',
  viewer: 'Просмотр',
}

function roleLabel(roleName: string | null | undefined): string {
  if (!roleName) return '—'
  return ROLE_LABELS[roleName] ?? roleName
}

export function Users() {
  const colSpan = useSettingsTableColSpan(7)
  const [users, setUsers] = useState<AuthUserOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.users.list()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const remove = (id: number) => {
    if (!confirm('Удалить пользователя?')) return
    api.users.delete(id)
      .then(() => setUsers((prev) => prev.filter((u) => u.id !== id)))
      .catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading && users.length === 0) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Пользователи</h2>
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {users.length}</p>
        </div>
        <SettingsAddLink to="/settings/users/new">Добавить</SettingsAddLink>
      </div>
      <div className="x_panel">
        <div className="x_content">
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Фамилия</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <SettingsActionTh />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                      Нет пользователей.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.nic}</td>
                      <td>{u.first_name}</td>
                      <td>{u.last_name}</td>
                      <td>{u.email}</td>
                      <td>{roleLabel(u.role_name)}</td>
                      <SettingsActionTd>
                        <EditLinkIcon to={`/settings/users/${u.id}/edit`} />
                        <DeleteIconButton onClick={() => remove(u.id)} />
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
