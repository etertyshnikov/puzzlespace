import { createContext, useContext, type ReactNode } from 'react'

const SettingsReadOnlyContext = createContext(false)

export function SettingsReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: ReactNode
}) {
  return (
    <SettingsReadOnlyContext.Provider value={readOnly}>{children}</SettingsReadOnlyContext.Provider>
  )
}

export function useSettingsReadOnly(): boolean {
  return useContext(SettingsReadOnlyContext)
}

/** colSpan таблицы: без столбца «Действия» в режиме просмотра. */
export function useSettingsTableColSpan(columnsWithActions: number): number {
  const readOnly = useSettingsReadOnly()
  return readOnly ? Math.max(1, columnsWithActions - 1) : columnsWithActions
}
