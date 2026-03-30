import { Component } from 'react'

/**
 * Per-widget error boundary. A runtime error inside a widget shows a fallback
 * card instead of crashing the entire dashboard.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Widget crashed:', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <span className="text-3xl">⚠️</span>
        <p className="text-slate-300 text-sm font-medium text-center">
          This widget encountered an error
        </p>
        {this.state.error?.message && (
          <p className="text-slate-500 text-xs font-mono text-center max-w-xs break-words">
            {this.state.error.message}
          </p>
        )}
        <button
          onClick={this.reset}
          className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          Reload Widget
        </button>
      </div>
    )
  }
}
