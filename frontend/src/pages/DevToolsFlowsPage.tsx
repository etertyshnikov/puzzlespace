import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '../ErrorBoundary.jsx'

const FlowViewer = lazy(() => import('../flows/FlowViewer.jsx'))

function ScreenFallback() {
  return <div className="app-screen-loading">Загрузка…</div>
}

export function DevToolsFlowsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<ScreenFallback />}>
        <FlowViewer />
      </Suspense>
    </ErrorBoundary>
  )
}
