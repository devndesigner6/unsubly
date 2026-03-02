import { SubscriptionForm } from "@/components/subscriptions/SubscriptionFormVite"
import { Link } from "react-router-dom"
import { RiAddLine, RiArrowLeftLine } from "@remixicon/react"

export default function NewSubscriptionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Link to="/subscriptions" className="mb-2 inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors sm:text-sm">
            <RiArrowLeftLine className="size-3.5 sm:size-4" />
            Back to Subscriptions
          </Link>
          <div className="flex items-center gap-3 text-white">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:size-12">
              <RiAddLine className="size-5 sm:size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Add Subscription</h1>
              <p className="mt-0.5 text-sm text-blue-100">Track a new subscription</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl p-3 sm:p-6 lg:p-8">
        <SubscriptionForm />
      </div>
    </div>
  )
}
