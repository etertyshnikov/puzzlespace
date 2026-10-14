declare module '*.jsx' {
  import type { ComponentType } from 'react'
  const component: ComponentType<Record<string, unknown>>
  export default component
}

declare module '../ErrorBoundary.jsx' {
  import type { Component, ReactNode } from 'react'
  export class ErrorBoundary extends Component<{ children?: ReactNode }, { error: Error | null }> {}
}

declare module '../flows/FlowViewer.jsx' {
  import type { ComponentType } from 'react'
  type FlowViewerProps = {
    selectedFlowId?: string | null
    onSelectedFlowIdChange?: (id: string) => void
  }
  const FlowViewer: ComponentType<FlowViewerProps>
  export default FlowViewer
}
