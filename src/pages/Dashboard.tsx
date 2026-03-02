import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import {
  RiAddLine, RiWalletLine, RiCalendarCheckLine, RiLoader4Line, RiAlertLine,
  RiPlayCircleLine, RiPauseCircleLine, RiCloseCircleLine, RiTimerFlashLine,
  RiBarChartBoxLine, RiArrowUpLine, RiArrowDownLine, RiFireLine,
  RiNotification3Line, RiArrowRightLine,
} from "@remixicon/react"

interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  billing_cycle: string
  next_billing_date: string
  start_date: string
  status: string
  category: string | null
  created_at: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from("subscriptions")
      .select("*")
      .order("next_billing_date", { ascending: true })
      .then(({ data }) => {
        setSubs((data as Subscription[]) || [])
        setLoading(false)
      })
  }, [user])

  const currency = profile?.currency || "USD"
  const userName = profile?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there"

  const insights = useMemo(() => {
    const active = subs.filter((s) => s.status === "active")
    const trial = subs.filter((s) => s.status === "trial")
    const paused = subs.filter((s) => s.status === "paused")
    const now = new Date()
    const monthlySpending = subs.reduce((sum, s) => {
      if (s.status === "cancelled") return sum
      const amt = Number(s.amount)
      if (s.billing_cycle === "monthly") return sum + amt
      if (s.billing_cycle === "yearly") return sum + amt / 12
      if (s.billing_cycle === "quarterly") return sum + amt / 3
      if (s.billing_cycle === "weekly") return sum + amt * 4.33
      return sum
    }, 0)
    const upcoming7Days = subs.filter((s) => {
      const d = new Date(s.next_billing_date)
      const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000)
      return diff >= 0 && diff <= 7 && s.status === "active"
    })
    const todayPayments = subs.filter((s) => {
      return new Date(s.next_billing_date).toDateString() === now.toDateString()
    })
    return { active: active.length, trial: trial.length, paused: paused.length, monthlySpending, upcoming7Days, todayPayments }
  }, [subs])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RiLoader4Line className="size-10 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:border-gray-800">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-white">
              <p className="text-sm text-blue-200">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1 className="mt-1 text-3xl font-bold">{getGreeting()}, {userName}!</h1>
              <p className="mt-1 text-blue-100">
                {insights.todayPayments.length > 0
                  ? `You have ${insights.todayPayments.length} payment(s) due today`
                  : "No payments due today — you're all caught up!"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="secondary" className="border-white/20 bg-white/20 text-white hover:bg-white/30">
                <Link to="/analytics"><RiBarChartBoxLine className="mr-2 size-4" />Analytics</Link>
              </Button>
              <Button asChild className="bg-white text-blue-700 shadow-lg hover:bg-blue-50">
                <Link to="/subscriptions/new"><RiAddLine className="mr-2 size-4" />Add Subscription</Link>
              </Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white">
              <RiWalletLine className="size-4" />
              <span className="font-medium">{formatCurrency(insights.monthlySpending, currency)}/mo</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white">
              <RiPlayCircleLine className="size-4" />
              <span className="font-medium">{insights.active} Active</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white">
              <RiCalendarCheckLine className="size-4" />
              <span className="font-medium">{insights.upcoming7Days.length} due this week</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={RiWalletLine} title="Monthly Spending" value={formatCurrency(insights.monthlySpending, currency)} color="blue" />
          <MetricCard icon={RiPlayCircleLine} title="Active" value={String(insights.active)} color="emerald" />
          <MetricCard icon={RiTimerFlashLine} title="Trials" value={String(insights.trial)} color="amber" />
          <MetricCard icon={RiPauseCircleLine} title="Paused" value={String(insights.paused)} color="blue" />
        </div>

        {/* Upcoming Payments */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Upcoming Payments</h2>
            <Link to="/subscriptions" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              View all <RiArrowRightLine className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {insights.upcoming7Days.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No upcoming payments this week</p>
            ) : (
              insights.upcoming7Days.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                      <RiCalendarCheckLine className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{sub.name}</p>
                      <p className="text-xs text-gray-500">{new Date(sub.next_billing_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(sub.amount), sub.currency || currency)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, title, value, color }: { icon: any; title: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className={cx("flex size-12 items-center justify-center rounded-xl", colorClasses[color])}>
        <Icon className="size-6" />
      </div>
      <p className="mt-4 text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
    </div>
  )
}
