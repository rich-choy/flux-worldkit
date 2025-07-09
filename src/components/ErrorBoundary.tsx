import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-text flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <div className="bg-surface border border-danger rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-danger text-2xl">⚠️</div>
                <h1 className="text-xl font-bold text-danger">Application Error</h1>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-text-bright mb-2">Error Message:</h2>
                  <div className="bg-background/50 border border-border rounded p-3 font-mono text-sm">
                    {this.state.error?.toString()}
                  </div>
                </div>

                {this.state.errorInfo && (
                  <div>
                    <h2 className="font-semibold text-text-bright mb-2">Component Stack:</h2>
                    <div className="bg-background/50 border border-border rounded p-3 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </div>
                  </div>
                )}

                {this.state.error?.stack && (
                  <div>
                    <h2 className="font-semibold text-text-bright mb-2">Stack Trace:</h2>
                    <div className="bg-background/50 border border-border rounded p-3 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-64">
                      {this.state.error.stack}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                    className="btn bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Try Again
                  </button>

                  <button
                    onClick={() => window.location.reload()}
                    className="btn bg-surface border border-border hover:bg-surface/80"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
