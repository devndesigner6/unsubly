import { Providers } from "@/components/Providers"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Sign In | Unsubscribely",
    template: "%s | Unsubscribely",
  },
  description:
    "Sign in to Unsubscribely to manage your subscriptions, view spending analytics, and get payment alerts.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <Providers>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Providers>
    </div>
  )
}
