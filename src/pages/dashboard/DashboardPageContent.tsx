import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { Button } from "@/components/Button"
import { Link } from "react-router-dom"
import {
  RiAddLine, RiArrowUpLine, RiArrowDownLine, RiWalletLine,
  RiCalendarCheckLine, RiAlertLine, RiLoader4Line,
  RiPlayCircleLine, RiBarChartBoxLine,
} from "@remixicon/react"
import { useState, useEffect, useMemo } from "react"

export default function DashboardPageContent() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [subs, prof] = await Promise.all([
          fetchSubscriptions(user!.id),
          fetchProfile(user!.id),
        ])
        setSubscriptions(subs)
        setProfile(prof)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const currency = profile?.currency || "USD"
  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "there"

  const metrics = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active")
    const monthly = subscriptions.reduce((sum, sub) => {
      const amt = sub.amount || 0
      if (sub.billing_cycle === "monthly") return sum + amt
      if (sub.billing_cycle === "yearly") return sum + amt / 12
      if (sub.billing_cycle === "quarterly") return sum + amt / 3
      if (sub.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)

    const now = new Date()
    const upcoming = subscriptions.filter((s) => {
      const days = Math.ceil((new Date(s.next_billing_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 7 && s.status === "active"
    })

    return {
      total: subscriptions.length,
      active: active.length,
      monthly,
      upcoming: upcoming.length,
    }
  }, [subscriptions])

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <RiLoader4Line className="size-10 animate-spin text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <RiAlertLine className="mx-auto mb-4 size-12 text-red-400" />
          <p className="text-lg font-medium text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-white">
              <p className="text-xs font-medium text-blue-200 sm:text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl lg:text-4xl">
                {getGreeting()}, {userName}!
              </h1>
              <p className="mt-1.5 text-sm text-blue-100 sm:mt-2 sm:text-base">
                {metrics.upcoming > 0
                  ? `You have ${metrics.upcoming} payment${metrics.upcoming > 1 ? "s" : ""} due this week`
                  : "No payments due this week — you're all caught up!"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button asChild variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-white/20 text-sm sm:text-base">
                <Link to="/analytics">
                  <RiBarChartBoxLine className="mr-1.5 size-4 sm:mr-2" />
                  Analytics
                </Link>
              </Button>
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg text-sm sm:text-base">
                <Link to="/subscriptions/new">
                  <RiAddLine className="mr-1.5 size-4 sm:mr-2" />
                  Add Subscription
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiWalletLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{formatCurrency(metrics.monthly, currency)}/mo</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiPlayCircleLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <RiCalendarCheckLine className="size-3.5 sm:size-4" />
              <span className="font-medium">{metrics.upcoming} due this week</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Subscriptions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">{metrics.total}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Active</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">{metrics.active}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Spending</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(metrics.monthly, currency)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Yearly Projection</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(metrics.monthly * 12, currency)}</p>
          </div>
        </div>

        {/* Recent Subscriptions */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">Recent Subscriptions</h2>
            <Link to="/subscriptions" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {subscriptions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No subscriptions yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/subscriptions/new">
                    <RiAddLine className="mr-2 size-4" />
                    Add your first subscription
                  </Link>
                </Button>
              </div>
            ) : (
              subscriptions.slice(0, 5).map((sub) => (
                <Link
                  key={sub.id}
                  to={`/subscriptions/${sub.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">{sub.name}</p>
                    <p className="text-xs text-gray-500">{sub.category || "Uncategorized"} · {sub.billing_cycle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-gray-50">
                      {formatCurrency(sub.amount, sub.currency || currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(sub.next_billing_date).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
