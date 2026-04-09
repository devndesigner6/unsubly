import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiSparklingLine, RiLoader4Line, RiLightbulbLine,
  RiMoneyDollarCircleLine, RiShieldLine, RiAlertLine,
  RiRefreshLine, RiRobot2Line,
} from "@remixicon/react"

interface PortfolioStats {
  totalMonthly: number
  annualProjected: number
  activeSubscriptions: number
  totalVaults: number
  lockedAlgo: number
  currency: string
}

function renderAnalysis(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("# "))
      return <h2 key={i} className="mt-5 mb-2 text-lg font-bold text-foreground">{line.slice(2)}</h2>
    if (line.startsWith("## ") || (line.startsWith("**") && line.endsWith("**")))
      return <h3 key={i} className="mt-4 mb-1 text-base font-semibold text-foreground">
        {line.startsWith("**") ? line.slice(2, -2) : line.slice(3)}
      </h3>
    if (line.startsWith("- ") || line.startsWith("* "))
      return <li key={i} className="ml-5 text-sm text-foreground list-disc">{line.slice(2)}</li>
    if (line.match(/^\d+\.\s/))
      return <li key={i} className="ml-5 text-sm text-foreground list-decimal">{line.replace(/^\d+\.\s/, "")}</li>
    if (line.trim() === "") return <div key={i} className="h-2" />
    return <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
  })
}

export default function AIOptimizerPage() {
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState<string | null>(null)
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
            case "weekly": return sum + amt * 4.33
            case "monthly": return sum + amt
            case "quarterly": return sum + amt / 3
            case "yearly": return sum + amt / 12
            default: return sum + amt
          }
        }, 0)

      const totalVaultLocked = vaults
        .filter((v) => v.status === "locked")
        .reduce((sum, v) => sum + Number(v.amount), 0)

      const portfolioStats: PortfolioStats = {
        totalMonthly,
        annualProjected: totalMonthly * 12,
        activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
        totalVaults: vaults.length,
        lockedAlgo: totalVaultLocked,
        currency: userCurrency,
      }

      const { data, error: fnError } = await supabase.functions.invoke("ai-optimizer", {
        body: { subscriptions, vaults, userCurrency, totalMonthly, totalVaultLocked },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setAnalysis(data.analysis)
      setStats(portfolioStats)
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
        <div className="mb-8">
          <div className="flex items-center gap-3">
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
        </div>

        {/* Portfolio Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: <RiMoneyDollarCircleLine className="size-4" />, label: "Monthly Spend", value: `${stats.currency} ${stats.totalMonthly.toFixed(2)}` },
              { icon: <RiMoneyDollarCircleLine className="size-4" />, label: "Annual Projected", value: `${stats.currency} ${stats.annualProjected.toFixed(2)}` },
              { icon: <RiLightbulbLine className="size-4" />, label: "Active Subs", value: String(stats.activeSubscriptions) },
              { icon: <RiShieldLine className="size-4" />, label: "Locked ALGO", value: stats.lockedAlgo.toFixed(4), highlight: true },
            ].map(({ icon, label, value, highlight }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <div className={`flex items-center gap-2 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
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
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Optimize Your Subscription Portfolio
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The AI agent analyzes your subscriptions, spending patterns, and escrow vaults
              to find savings opportunities and recommend optimal vault strategies.
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
            <p className="mt-1 text-xs text-muted-foreground">
              Reviewing your subscriptions and vault data
            </p>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <RiLightbulbLine className="size-5 text-primary" />
                AI Recommendations
              </h2>
              <Button variant="secondary" onClick={runAnalysis} disabled={loading}>
                <RiRefreshLine className="mr-1.5 size-4" />
                Re-analyze
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-1">
                {renderAnalysis(analysis)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
