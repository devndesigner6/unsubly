import { Link } from "react-router-dom"
import { Button } from "@/components/Button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        <p className="mt-4 text-lg text-gray-500">Page not found</p>
        <Button asChild className="mt-6"><Link to="/">Go Home</Link></Button>
      </div>
    </div>
  )
}
