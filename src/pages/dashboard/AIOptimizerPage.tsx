import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiSparklingLine, RiLoader4Line, RiLightbulbLine,
  RiMoneyDollarCircleLine, RiShieldLine, RiAlertLine,
  RiRefreshLine,
} from "@remixicon/react"

interface PortfolioSummary {
  totalMonthly: string
  annualProjected: string
  activeSubscriptions: number
  totalVaults: number
  lockedAlgo: string
  currency: string
}

export default function AIOptimizerPage() {
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runAnalysis() {
    if (!user) return
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-optimizer')
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setAnalysis(data.analysis)
      setPortfolio(data.portfolio)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <RiSparklingLine className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Subscription Optimizer</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered analysis of your subscriptions and vault strategies
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Stats */}
        {portfolio && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RiMoneyDollarCircleLine className="size-4" />
                <span className="text-xs font-medium">Monthly Spend</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {portfolio.currency} {portfolio.totalMonthly}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RiMoneyDollarCircleLine className="size-4" />
                <span className="text-xs font-medium">Annual Projected</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {portfolio.currency} {portfolio.annualProjected}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RiLightbulbLine className="size-4" />
                <span className="text-xs font-medium">Active Subs</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">{portfolio.activeSubscriptions}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-primary">
                <RiShieldLine className="size-4" />
                <span className="text-xs font-medium">Locked ALGO</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">{portfolio.lockedAlgo}</p>
            </div>
          </div>
        )}

        {/* Run Analysis Button */}
        {!analysis && !loading && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <RiSparklingLine className="mx-auto size-12 text-primary/40" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Optimize Your Subscription Portfolio
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Our AI agent analyzes your subscriptions, spending patterns, and escrow vaults
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
              This may take a few seconds while the AI reviews your subscriptions and vaults
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <RiAlertLine className="size-5 shrink-0 text-destructive mt-0.5" />
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
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <RiLightbulbLine className="size-5 text-primary" />
                AI Recommendations
              </h2>
              <Button variant="secondary" onClick={runAnalysis} disabled={loading}>
                <RiRefreshLine className="mr-1.5 size-4" />
                Re-analyze
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {analysis.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.slice(2)}</h2>
                  if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold text-foreground mt-3 mb-1">{line.slice(3)}</h3>
                  if (line.startsWith('**') && line.endsWith('**')) return <h3 key={i} className="text-base font-semibold text-foreground mt-3 mb-1">{line.slice(2, -2)}</h3>
                  if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="text-sm text-foreground ml-4">{line.slice(2)}</li>
                  if (line.match(/^\d+\.\s/)) return <li key={i} className="text-sm text-foreground ml-4 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>
                  if (line.trim() === '') return <br key={i} />
                  return <p key={i} className="text-sm text-foreground">{line}</p>
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
