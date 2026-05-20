import { SubscriptionForm } from "@/components/subscriptions/SubscriptionFormVite"
import { Link } from "react-router-dom"
import { RiArrowLeftLine } from "@remixicon/react"

export default function NewSubscriptionPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Header — clean, no gradient */}
        <div className="border-b border-border px-4 sm:px-6 lg:px-8 py-5">
          <Link to="/subscriptions" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RiArrowLeftLine className="size-3.5" />
            Back to Subscriptions
          </Link>
          <div className="relative overflow-hidden">
            <span className="ghost-text">NEW</span>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">Add Subscription</h1>
            <p className="mt-1 text-xs text-muted-foreground">Track a new subscription</p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
          <SubscriptionForm />
        </div>
      </div>
    </div>
  )
}
