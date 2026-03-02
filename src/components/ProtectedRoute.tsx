import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { RiLoader4Line } from "@remixicon/react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <RiLoader4Line className="size-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
