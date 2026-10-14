import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type AppChromeContextValue = {
  chromeCollapsed: boolean
  setChromeCollapsed: (v: boolean) => void
  toggleChromeCollapsed: () => void
}

const AppChromeContext = createContext<AppChromeContextValue | null>(null)

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [chromeCollapsed, setChromeCollapsed] = useState(false)
  const toggleChromeCollapsed = useCallback(() => setChromeCollapsed((v) => !v), [])
  const value = useMemo(
    () => ({ chromeCollapsed, setChromeCollapsed, toggleChromeCollapsed }),
    [chromeCollapsed, toggleChromeCollapsed],
  )
  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>
}

export function useAppChrome(): AppChromeContextValue {
  const ctx = useContext(AppChromeContext)
  if (!ctx) {
    throw new Error('useAppChrome must be used within AppChromeProvider')
  }
  return ctx
}
