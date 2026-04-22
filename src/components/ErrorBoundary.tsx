"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { RiAlertLine, RiRefreshLine } from "@remixicon/react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  private hasAutoRetried = false

  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    // In production, auto-reset once after a short delay.
    // This recovers from transient errors during wallet state changes
    // without a full page reload (which breaks the wallet QR flow).
    if (!import.meta.env.DEV && !this.hasAutoRetried) {
      this.hasAutoRetried = true
      setTimeout(() => {
        this.setState({ hasError: false, error: null })
      }, 350)
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      if (!import.meta.env.DEV) {
        return null
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <RiAlertLine className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              An unexpected error occurred. Please try again.
            </p>
            {this.state.error && (
              <details className="mb-4 rounded-lg bg-red-100 p-3 text-left dark:bg-red-900/30">
                <summary className="cursor-pointer text-xs font-medium text-red-700 dark:text-red-300">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-600 dark:text-red-400">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

