import { Link } from "react-router-dom"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Page not found</p>
      <Button asChild className="mt-6">
        <Link to="/">
          Go Home <RiArrowRightLine className="ml-2 size-4" />
        </Link>
      </Button>
    </div>
  )
}
