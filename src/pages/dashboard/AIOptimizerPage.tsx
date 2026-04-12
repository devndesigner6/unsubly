import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiSparklingLine, RiLoader4Line, RiLightbulbLine,
  RiMoneyDollarCircleLine, RiShieldLine, RiAlertLine,
  RiRefreshLine, RiRobot2Line, RiArrowRightLine,
  RiCheckLine, RiErrorWarningLine,
} from "@remixicon/react"

interface PortfolioStats {
  totalMonthly: number
  annualProjected: number
  activeSubscriptions: number
  totalVaults: number
  lockedAlgo: number
  currency: string
}

interface AnalysisResult {
  spending?: {
    summary?: string
    topCategory?: string
    monthlyTotal?: number
    annualTotal?: number
    breakdown?: { name: string; monthly: number; category: string; risk: string }[]
  }
  savings?: { title: string; description: string; saving: string; priority: string }[]
  vaultStrategy?: { subscription: string; recommended: string; reason: string }[]
  riskScore?: number
  riskLabel?: string
  topAction?: string
}

const PRIORITY_STYLE: Record<string, string> = {
  high:   "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30",
  medium: "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30",
  low:    "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30",
}
const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500", medium: "bg-amber-500", low: "bg-green-500",
}
const RISK_STYLE: Record<string, string> = {
  Low:    "text-green-600 dark:text-green-400",
  Medium: "text-amber-600 dark:text-amber-400",
  High:   "text-red-600 dark:text-red-400",
}
const VAULT_BADGE: Record<string, string> = {
  standard:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "time-locked":"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "multi-sig": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  dispute:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  asa:         "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
}

function RiskMeter({ score, label }: { score: number; label: string }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct < 33 ? "bg-green-500" : pct < 66 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Risk Score</span>
        <span className={`font-bold ${RISK_STYLE[label] ?? "text-foreground"}`}>{label} · {score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-border">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AIOptimizerPage() {
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runAnalysis() {
    if (!user) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setStats(null)

    try {
      const [subsRes, vaultsRes, profileRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("name, amount, currency, billing_cycle, status, next_billing_date, category")
          .eq("user_id", user.id),
        supabase
          .from("escrow_vaults")
          .select("amount, currency, status, vault_type, created_at, unlock_time")
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("currency")
          .eq("id", user.id)
          .single(),
      ])

      const subscriptions = subsRes.data || []
      const vaults = vaultsRes.data || []
      const userCurrency = (profileRes.data as any)?.currency || "USD"

      const totalMonthly = subscriptions
        .filter((s) => s.status === "active")
        .reduce((sum, s) => {
          const amt = Number(s.amount)
          switch (s.billing_cycle) {
            case "weekly":    return sum + amt * 4.33
            case "monthly":   return sum + amt
            case "quarterly": return sum + amt / 3
            case "yearly":    return sum + amt / 12
            default:          return sum + amt
          }
        }, 0)

      const totalVaultLocked = vaults
        .filter((v) => v.status === "locked")
        .reduce((sum, v) => sum + Number(v.amount), 0)

      setStats({
        totalMonthly,
        annualProjected: totalMonthly * 12,
        activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
        totalVaults: vaults.length,
        lockedAlgo: totalVaultLocked,
        currency: userCurrency,
      })

      // Try edge function first, fall back to local API proxy
      let parsed: AnalysisResult | null = null

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("ai-optimizer", {
        body: { subscriptions, vaults, userCurrency, totalMonthly, totalVaultLocked },
      })

      if (!edgeError && edgeData && !edgeData.error) {
        parsed = typeof edgeData.analysis === "object" ? edgeData.analysis : JSON.parse(edgeData.analysis)
      } else {
        const res = await fetch("/api/ai-optimizer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptions, vaults, userCurrency, totalMonthly, totalVaultLocked }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || "Analysis failed")
        parsed = typeof data.analysis === "object" ? data.analysis : JSON.parse(data.analysis)
      }

      setAnalysis(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <RiSparklingLine className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Subscription Optimizer</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered analysis of your subscriptions and Algorand vault strategies
            </p>
          </div>
        </div>

        {/* Portfolio Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Monthly Spend",    value: `${stats.currency} ${stats.totalMonthly.toFixed(2)}` },
              { label: "Annual Projected", value: `${stats.currency} ${stats.annualProjected.toFixed(2)}` },
              { label: "Active Subs",      value: String(stats.activeSubscriptions) },
              { label: "Locked ALGO",      value: stats.lockedAlgo.toFixed(4), highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className={`text-xs font-medium ${highlight ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
                <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!analysis && !loading && !error && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <RiRobot2Line className="size-8 text-primary/60" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Optimize Your Subscription Portfolio</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Analyzes your subscriptions, spending patterns, and escrow vaults to find savings and recommend vault strategies.
            </p>
            <Button onClick={runAnalysis} className="mt-6">
              <RiSparklingLine className="mr-2 size-4" />
              Run AI Analysis
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <RiLoader4Line className="mx-auto size-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium text-foreground">Analyzing your portfolio…</p>
            <p className="mt-1 text-xs text-muted-foreground">Reviewing subscriptions and vault data</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <RiAlertLine className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button variant="secondary" onClick={runAnalysis} className="mt-3">
                <RiRefreshLine className="mr-1.5 size-4" /> Retry
              </Button>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-5">

            {/* Re-analyze button */}
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <RiLightbulbLine className="size-5 text-primary" />
                AI Recommendations
              </h2>
              <Button variant="secondary" onClick={runAnalysis} disabled={loading}>
                <RiRefreshLine className="mr-1.5 size-4" /> Re-analyze
              </Button>
            </div>

            {/* Top action banner */}
            {analysis.topAction && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <RiArrowRightLine className="size-5 shrink-0 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  <span className="text-primary">Top action: </span>{analysis.topAction}
                </p>
              </div>
            )}

            {/* Risk meter */}
            {analysis.riskScore !== undefined && analysis.riskLabel && (
              <div className="rounded-xl border border-border bg-card p-5">
                <RiskMeter score={analysis.riskScore} label={analysis.riskLabel} />
              </div>
            )}

            {/* Spending analysis */}
            {analysis.spending && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Spending Analysis
                </h3>
                {analysis.spending.summary && (
                  <p className="text-sm text-foreground">{analysis.spending.summary}</p>
                )}
                {analysis.spending.breakdown && analysis.spending.breakdown.length > 0 && (
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {analysis.spending.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-card">
                        <div className="flex items-center gap-2.5">
                          <span className={`size-2 rounded-full ${PRIORITY_DOT[item.risk] ?? "bg-border"}`} />
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                          {item.category && (
                            <span className="text-xs text-muted-foreground">{item.category}</span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          ${Number(item.monthly).toFixed(2)}/mo
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Savings opportunities */}
            {analysis.savings && analysis.savings.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Savings Opportunities
                </h3>
                <div className="space-y-2.5">
                  {analysis.savings.map((s, i) => (
                    <div key={i} className={`rounded-lg border p-4 ${PRIORITY_STYLE[s.priority] ?? "border-border bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{s.title}</p>
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                        </div>
                        {s.saving && (
                          <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs font-bold text-foreground border border-border">
                            {s.saving}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vault strategy */}
            {analysis.vaultStrategy && analysis.vaultStrategy.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Vault Strategy
                </h3>
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {analysis.vaultStrategy.map((v, i) => (
                    <div key={i} className="flex items-start gap-4 px-4 py-3 bg-card">
                      <RiCheckLine className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{v.subscription}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VAULT_BADGE[v.recommended] ?? "bg-muted text-muted-foreground"}`}>
                            {v.recommended}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{v.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
