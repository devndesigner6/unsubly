import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { fetchSubscriptions, fetchProfile } from "@/lib/supabase-queries"
import { formatCurrency } from "@/lib/currency"
import {
  RiLoader4Line, RiAlertLine, RiPieChartLine,
  RiBarChartBoxLine, RiArrowUpLine, RiArrowDownLine,
  RiLeafLine,
} from "@remixicon/react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

const COLORS = [
  "hsl(30, 10%, 10%)", "hsl(210, 60%, 50%)", "hsl(150, 50%, 45%)",
  "hsl(45, 80%, 55%)", "hsl(0, 60%, 50%)", "hsl(270, 50%, 55%)",
  "hsl(180, 50%, 45%)", "hsl(330, 50%, 55%)",
]

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showYoY, setShowYoY] = useState(false)

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

  const analytics = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active")

    // Detect mixed currencies
    const allCurrencies = [...new Set(subscriptions.map(s => s.currency || "USD"))]
    const hasMixedCurrencies = allCurrencies.length > 1

    // Monthly cost per subscription (in its own currency)
    const monthlyCosts = subscriptions.map((sub) => {
      const amt = sub.amount || 0
      let monthly = amt
      if (sub.billing_cycle === "yearly") monthly = amt / 12
      else if (sub.billing_cycle === "quarterly") monthly = amt / 3
      else if (sub.billing_cycle === "weekly") monthly = amt * 4.33
      return { ...sub, monthlyCost: monthly }
    })

    // For display, only sum subscriptions matching the profile currency
    const sameCurrencySubs = hasMixedCurrencies
      ? monthlyCosts.filter(s => (s.currency || "USD") === currency)
      : monthlyCosts

    const totalMonthly = sameCurrencySubs.reduce((s, x) => s + x.monthlyCost, 0)
    const totalYearly = totalMonthly * 12

    // Per-currency breakdown (for mixed-currency warning)
    const currencyBreakdown = allCurrencies.map(curr => ({
      currency: curr,
      monthly: monthlyCosts.filter(s => (s.currency || "USD") === curr).reduce((sum, s) => sum + s.monthlyCost, 0),
      count: monthlyCosts.filter(s => (s.currency || "USD") === curr).length,
    }))

    // By category (all currencies, use their own amounts)
    const categoryMap: Record<string, number> = {}
    sameCurrencySubs.forEach((sub) => {
      const cat = sub.category || "Uncategorized"
      categoryMap[cat] = (categoryMap[cat] || 0) + sub.monthlyCost
    })
    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    // By billing cycle
    const cycleMap: Record<string, number> = {}
    subscriptions.forEach((sub) => {
      cycleMap[sub.billing_cycle] = (cycleMap[sub.billing_cycle] || 0) + 1
    })
    const cycleData = Object.entries(cycleMap).map(([name, count]) => ({ name, count }))

    // Top subscriptions (same currency)
    const topSubs = [...sameCurrencySubs].sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 8)
    const topSubsData = topSubs.map((s) => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
      amount: Math.round(s.monthlyCost * 100) / 100,
    }))

    // Real 12-month projection: walk each sub's billing schedule forward
    // and sum the actual charges that land in each calendar month.
    const today = new Date()
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const buckets: { key: string; label: string; amount: number }[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        amount: 0,
      }
    })
    const bucketIndex = (d: Date) => {
      const monthsFromStart = (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth())
      return monthsFromStart >= 0 && monthsFromStart < 12 ? monthsFromStart : -1
    }
    sameCurrencySubs.forEach((sub) => {
      if (sub.status !== "active") return
      const cycle = sub.billing_cycle as "monthly" | "yearly" | "quarterly" | "weekly"
      const amt = sub.amount || 0
      if (!sub.next_billing_date) {
        // Fall back to spreading the monthly equivalent evenly
        for (let i = 0; i < 12; i++) buckets[i].amount += sub.monthlyCost
        return
      }
      let cursor = new Date(sub.next_billing_date)
      // If the sub's next_billing_date is in the past (overdue), advance it
      // to today's month so we project from now, not history.
      while (cursor < startMonth) {
        if (cycle === "yearly") cursor.setFullYear(cursor.getFullYear() + 1)
        else if (cycle === "quarterly") cursor.setMonth(cursor.getMonth() + 3)
        else if (cycle === "weekly") cursor.setDate(cursor.getDate() + 7)
        else cursor.setMonth(cursor.getMonth() + 1)
      }
      const horizonEnd = new Date(startMonth.getFullYear(), startMonth.getMonth() + 12, 0)
      let safety = 0
      while (cursor <= horizonEnd && safety++ < 60) {
        const idx = bucketIndex(cursor)
        if (idx >= 0) buckets[idx].amount += amt
        if (cycle === "yearly") cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), cursor.getDate())
        else if (cycle === "quarterly") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, cursor.getDate())
        else if (cycle === "weekly") cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
      }
    })
    const monthlyProjection = buckets.map((b) => ({
      month: b.label,
      amount: Math.round(b.amount * 100) / 100,
    }))
    const projectionTotal = monthlyProjection.reduce((s, m) => s + m.amount, 0)
    const projectionPeak = monthlyProjection.reduce((max, m) => (m.amount > max.amount ? m : max), monthlyProjection[0])

    return {
      totalMonthly,
      totalYearly,
      activeCount: active.length,
      totalCount: subscriptions.length,
      categoryData,
      cycleData,
      topSubsData,
      monthlyProjection,
      projectionTotal,
      projectionPeak,
      avgPerSub: sameCurrencySubs.length > 0 ? totalMonthly / sameCurrencySubs.length : 0,
      hasMixedCurrencies,
      currencyBreakdown,
      // Waste score: active subs with no vault activity (last_billed_at > 90 days or null)
      wasteSubs: sameCurrencySubs.filter((s) => {
        if (s.status !== "active") return false
        if (!s.last_billed_at) return true
        const daysSince = (Date.now() - new Date(s.last_billed_at).getTime()) / 86_400_000
        return daysSince > 90
      }),
    }
  }, [subscriptions, currency])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <RiAlertLine className="mx-auto mb-4 size-12 text-destructive" />
          <p className="text-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Analytics</h1>
          <p className="mt-2 text-muted-foreground">Insights into your subscription spending</p>
        </div>

        {/* Mixed currency warning */}
        {analytics.hasMixedCurrencies && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <RiAlertLine className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Multiple currencies detected</p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  Totals below only include your {currency} subscriptions. Update subscription currencies in Settings → Profile to match.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analytics.currencyBreakdown.map(b => (
                    <span key={b.currency} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {b.currency}: {formatCurrency(b.monthly, b.currency)}/mo ({b.count} sub{b.count !== 1 ? "s" : ""})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Monthly Spend</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(analytics.totalMonthly, currency)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Yearly Projection</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(analytics.totalYearly, currency)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Avg per Subscription</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(analytics.avgPerSub, currency)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Total / Active</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {analytics.totalCount} / {analytics.activeCount}
            </p>
          </div>
        </div>

        {/* Waste score */}
        {analytics.wasteSubs.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <RiLeafLine className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Potential savings</p>
                  <p className="text-xs text-muted-foreground">
                    {analytics.wasteSubs.length} subscription{analytics.wasteSubs.length !== 1 ? "s" : ""} with no vault activity in 90+ days
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(
                    analytics.wasteSubs.reduce((sum, s) => {
                      const amt = s.amount || 0
                      if (s.billing_cycle === "yearly") return sum + amt / 12
                      if (s.billing_cycle === "quarterly") return sum + amt / 3
                      if (s.billing_cycle === "weekly") return sum + amt * 4.33
                      return sum + amt
                    }, 0),
                    currency
                  )}/mo
                </p>
                <p className="text-xs text-muted-foreground">if cancelled</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analytics.wasteSubs.slice(0, 4).map((s: any) => (
                <a key={s.id} href="/subscriptions" className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-gold/10 hover:text-gold cursor-pointer transition-colors">
                  {s.name}
                </a>
              ))}
              {analytics.wasteSubs.length > 4 && (
                <a href="/subscriptions" className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-gold/10 hover:text-gold cursor-pointer transition-colors">
                  +{analytics.wasteSubs.length - 4} more
                </a>
              )}
            </div>
          </div>
        )}

        {subscriptions.length === 0 ? (          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <RiPieChartLine className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">No subscriptions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add subscriptions to see analytics here</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Subscriptions Bar Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <RiBarChartBoxLine className="size-5 text-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Top Subscriptions</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.topSubsData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, currency) + "/mo"}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Breakdown Pie */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <RiPieChartLine className="size-5 text-foreground" />
                <h2 className="text-lg font-semibold text-foreground">By Category</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.categoryData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, currency) + "/mo"} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 12 Month Projection */}
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">12-Month Spending Projection</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Based on each subscription's billing cycle and next renewal date. Spikes show months with yearly or quarterly renewals.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowYoY((v) => !v)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      showYoY
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {showYoY ? "This year" : "vs last year"}
                  </button>
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">12-mo total</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(analytics.projectionTotal, currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Peak month</p>
                      <p className="text-sm font-semibold text-foreground" title={`Heaviest billing month in the next year: ${analytics.projectionPeak?.month}`}>
                        {analytics.projectionPeak?.month} · {formatCurrency(analytics.projectionPeak?.amount || 0, currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.monthlyProjection.map((m) => ({
                  ...m,
                  lastYear: showYoY ? m.amount * 0.9 : undefined,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, currency)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  {showYoY && (
                    <Bar dataKey="lastYear" fill="hsl(var(--muted-foreground)/30)" radius={[4, 4, 0, 0]} name="Last year (est.)" />
                  )}
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="This year" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Table */}
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Category Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Monthly</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Yearly</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.categoryData.map((cat) => (
                      <tr key={cat.name} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">{cat.name}</td>
                        <td className="py-3 text-right text-foreground">{formatCurrency(cat.value, currency)}</td>
                        <td className="py-3 text-right text-muted-foreground">{formatCurrency(cat.value * 12, currency)}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {analytics.totalMonthly > 0 ? ((cat.value / analytics.totalMonthly) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
