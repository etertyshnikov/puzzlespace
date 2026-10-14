import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-panel">
          <h2>Ошибка экрана</h2>
          <pre>{this.state.error?.message || String(this.state.error)}</pre>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
