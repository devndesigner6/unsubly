import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions } from "@/lib/supabase-queries"
import { fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { useState, useEffect, useMemo } from "react"
import {
  RiArrowLeftSLine, RiArrowRightSLine, RiLoader4Line,
  RiWalletLine,
} from "@remixicon/react"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function toMonthlyAmount(amount: number, cycle: string): number {
  switch (cycle) {
    case "weekly": return amount * 4.33
    case "monthly": return amount
    case "quarterly": return amount / 3
    case "yearly": return amount / 12
    default: return amount
  }
}

function getBillingDaysInMonth(sub: any, year: number, month: number): number[] {
  if (sub.status !== "active" && sub.status !== "trial") return []

  const base = new Date(sub.next_billing_date + "T00:00:00")
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: number[] = []

  switch (sub.billing_cycle) {
    case "monthly": {
      // Same day every month, cap to last day of month
      days.push(Math.min(base.getDate(), daysInMonth))
      break
    }
    case "yearly": {
      // Only in the anniversary month
      if (base.getMonth() === month) {
        days.push(Math.min(base.getDate(), daysInMonth))
      }
      break
    }
    case "quarterly": {
      // Advance forward from base until we reach the target month
      let d = new Date(base)
      // Clamp to future if base is too far ahead
      while (d.getFullYear() > year || (d.getFullYear() === year && d.getMonth() > month)) {
        d.setMonth(d.getMonth() - 3)
      }
      // Advance until we hit or pass the target
      while (d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() < month)) {
        d.setMonth(d.getMonth() + 3)
      }
      if (d.getFullYear() === year && d.getMonth() === month) {
        days.push(Math.min(d.getDate(), daysInMonth))
      }
      break
    }
    case "weekly": {
      // Find every occurrence within the target month
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      let d = new Date(base)
      // Rewind to before the month start
      while (d > monthStart) d.setDate(d.getDate() - 7)
      // Advance until we enter the month
      while (d < monthStart) d.setDate(d.getDate() + 7)
      // Collect every occurrence in the month
      while (d <= monthEnd) {
        days.push(d.getDate())
        d = new Date(d)
        d.setDate(d.getDate() + 7)
      }
      break
    }
    default:
      break
  }

  return days
}

export default function CalendarPageContent() {
  const { user } = useAuth()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [currency, setCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [subs, profile] = await Promise.all([
          fetchSubscriptions(user!.id),
          fetchProfile(user!.id)
        ])
        setSubscriptions(subs)
        setCurrency(profile?.currency || "USD")

        // Silently advance any past-due billing dates
        try {
          const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession()
          if (session?.access_token) {
            const res = await fetch("/api/advance-billing", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            })
            const json = await res.json()
            if (res.ok && json.advanced > 0) {
              const refreshed = await fetchSubscriptions(user!.id)
              setSubscriptions(refreshed)
            }
          }
        } catch { /* non-critical */ }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [firstDayOfMonth, daysInMonth])

  // Build a map of day → subscriptions that bill on that day this month
  const daySubsMap = useMemo(() => {
    const map: Record<number, any[]> = {}
    for (const sub of subscriptions) {
      const days = getBillingDaysInMonth(sub, year, month)
      for (const day of days) {
        if (!map[day]) map[day] = []
        map[day].push(sub)
      }
    }
    return map
  }, [subscriptions, year, month])

  // Monthly total: sum of actual billing amounts in this month (weekly may bill multiple times)
  const monthlyTotal = useMemo(() => {
    let total = 0
    for (const sub of subscriptions) {
      const days = getBillingDaysInMonth(sub, year, month)
      total += days.length * (sub.amount || 0)
    }
    return total
  }, [subscriptions, year, month])

  const activeSubs = subscriptions.filter(s => s.status === "active" || s.status === "trial").length

  if (loading) return <div className="flex h-screen items-center justify-center"><RiLoader4Line className="animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700">
        <div className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-3 text-white sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold sm:text-2xl">Payment Calendar</h1>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 p-1 self-start sm:self-auto">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} aria-label="Previous month" title="Previous month" className="flex size-9 items-center justify-center hover:bg-white/10 rounded-md transition-colors"><RiArrowLeftSLine className="size-5" /></button>
              <span className="min-w-[110px] text-center font-medium sm:min-w-[120px]">{MONTHS[month]} {year}</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} aria-label="Next month" title="Next month" className="flex size-9 items-center justify-center hover:bg-white/10 rounded-md transition-colors"><RiArrowRightSLine className="size-5" /></button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-white">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1">
              <RiWalletLine className="size-4" />
              <span>{formatCurrency(monthlyTotal, currency)} due this month</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
              {activeSubs} active subscription{activeSubs !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        {(() => {
          const monthsAhead =
            (year - today.getFullYear()) * 12 + (month - today.getMonth())
          if (monthsAhead < 6) return null
          return (
            <div className="mb-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
              speculative window: prices and renewals shift beyond a 6-month horizon
            </div>
          )
        })()}
        <div className={cx(
          "grid grid-cols-7 gap-px rounded-xl border border-border bg-border overflow-hidden",
          ((year - today.getFullYear()) * 12 + (month - today.getMonth())) >= 6 && "doomscroll-guard"
        )}>
          {DAYS.map(day => (
            <div key={day} className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[60px] bg-card sm:min-h-[100px]" />
            const daySubs = daySubsMap[day] ?? []
            const dayTotal = daySubs.reduce((sum, s) => sum + (s.amount || 0), 0)
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

            return (
              <div key={day} className={cx(
                "group relative min-h-[60px] bg-card p-1 transition-colors hover:bg-accent/50 sm:min-h-[100px] sm:p-2",
                day && isPast && "opacity-60"
              )}>
                <span className={cx(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}>
                  {day}
                </span>
                <div className="mt-2 space-y-1">
                  {daySubs.map((sub, idx) => (
                    <div key={`${sub.id}-${idx}`} className="truncate rounded px-1.5 py-0.5 text-xs bg-primary/10 text-primary">
                      {sub.name}
                    </div>
                  ))}
                  {dayTotal > 0 && (
                    <div className="mt-1 text-xs font-semibold text-foreground">
                      {formatCurrency(dayTotal, currency)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {subscriptions.length === 0 && (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            No subscriptions yet. Add one to see your payment calendar.
          </div>
        )}
      </div>
    </div>
  )
}
