import { Outlet } from "react-router-dom"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}
