import { Component, ErrorInfo, ReactNode } from "react"
import { RiAlertLine, RiRefreshLine } from "@remixicon/react"

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null }
  public static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("ErrorBoundary:", error, errorInfo) }
  private handleReset = () => { this.setState({ hasError: false, error: null }) }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <RiAlertLine className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">Something went wrong</h2>
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">An unexpected error occurred.</p>
            <button onClick={this.handleReset} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">
              <RiRefreshLine className="size-4" /> Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
