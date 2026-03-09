import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import {
  RiSparklingLine, RiLoader4Line, RiShieldLine, RiMoneyDollarCircleLine,
  RiArrowUpLine, RiArrowDownLine, RiAlertLine, RiRefreshLine,
  RiLightbulbLine, RiLockLine,
} from "@remixicon/react"
import { toast } from "sonner"

interface Recommendation {
  title: string
  description: string
  impact: "high" | "medium" | "low"
  category: "cost" | "security" | "optimization"
}

interface CategoryAnalysis {
  category: string
  monthly_total: number
  percentage: number
  verdict: "optimal" | "review" | "reduce"
}

interface AnalysisResult {
  summary: string
  monthly_savings_potential: number
  risk_score: number
  recommendations: Recommendation[]
  vault_insights: string
  category_analysis: CategoryAnalysis[]
}

interface AnalysisResponse {
  analysis: AnalysisResult
  meta: { total_subscriptions: number; total_monthly: number; currency: string; analyzed_at: string }
}

const impactColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
}

const categoryIcons: Record<string, typeof RiShieldLine> = {
  cost: RiMoneyDollarCircleLine,
  security: RiShieldLine,
  optimization: RiLightbulbLine,
}

const verdictColors: Record<string, string> = {
  optimal: "text-green-600 dark:text-green-400",
  review: "text-yellow-600 dark:text-yellow-400",
  reduce: "text-red-600 dark:text-red-400",
}

export default function AIOptimizerPage() {
  const { user } = useAuth()
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-optimizer")
      if (fnError) throw fnError
      if (data?.error) {
        setError(data.error)
        toast.error("Analysis failed", { description: data.error })
        return
      }
      setResult(data as AnalysisResponse)
      toast.success("Analysis complete!")
    } catch (err: any) {
      const msg = err?.message || "Failed to run analysis"
      setError(msg)
      toast.error("Analysis failed", { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const analysis = result?.analysis
  const meta = result?.meta

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RiSparklingLine className="size-7 text-primary" />
              <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">AI Optimizer</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              AI-powered analysis of your subscription spending with blockchain-aware recommendations
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <RiSparklingLine className="size-3" /> Agentic Commerce
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <RiLockLine className="size-3" /> Algorand-Aware
              </span>
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : result ? (
              <RiRefreshLine className="size-4" />
            ) : (
              <RiSparklingLine className="size-4" />
            )}
            {loading ? "Analyzing…" : result ? "Re-analyze" : "Run AI Analysis"}
          </button>
        </div>

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <RiSparklingLine className="mx-auto mb-4 size-16 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold text-foreground">Ready to Optimize</h2>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Click "Run AI Analysis" to get AI-powered insights on your subscription spending,
              cost-saving opportunities, and Algorand escrow vault strategies.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <RiLoader4Line className="mx-auto size-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">AI agent analyzing your portfolio…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <RiAlertLine className="mx-auto mb-4 size-10 text-destructive" />
            <p className="text-foreground font-medium">{error}</p>
            <button onClick={runAnalysis} className="mt-4 text-sm text-primary hover:text-primary/80">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {analysis && meta && !loading && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Risk Score</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className={`text-3xl font-bold ${
                    analysis.risk_score <= 3 ? "text-green-600 dark:text-green-400"
                    : analysis.risk_score <= 6 ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
                  }`}>{analysis.risk_score}</p>
                  <span className="text-sm text-muted-foreground">/ 10</span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Savings Potential</p>
                <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                  <RiArrowDownLine className="inline size-5" />
                  {meta.currency} {analysis.monthly_savings_potential.toFixed(2)}/mo
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Monthly Spend</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{meta.currency} {meta.total_monthly.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Subscriptions</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{meta.total_subscriptions}</p>
              </div>
            </div>

            {/* AI Summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <RiSparklingLine className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">AI Summary</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Recommendations */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <RiLightbulbLine className="size-5 text-primary" /> Recommendations
              </h2>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, i) => {
                  const CatIcon = categoryIcons[rec.category] || RiLightbulbLine
                  return (
                    <div key={i} className="flex gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <CatIcon className="size-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-foreground">{rec.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${impactColors[rec.impact]}`}>
                            {rec.impact} impact
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Vault Insights */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <RiLockLine className="size-4 text-primary" /> Algorand Vault Insights
              </h2>
              <p className="text-sm text-muted-foreground">{analysis.vault_insights}</p>
            </div>

            {/* Category Analysis */}
            {analysis.category_analysis.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold text-foreground mb-4">Category Breakdown</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-2 text-left font-medium text-muted-foreground">Category</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Monthly</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">% of Total</th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.category_analysis.map((cat) => (
                        <tr key={cat.category} className="border-b border-border/50">
                          <td className="py-3 font-medium text-foreground">{cat.category}</td>
                          <td className="py-3 text-right text-foreground">{meta.currency} {cat.monthly_total.toFixed(2)}</td>
                          <td className="py-3 text-right text-muted-foreground">{cat.percentage.toFixed(1)}%</td>
                          <td className={`py-3 text-right font-medium capitalize ${verdictColors[cat.verdict]}`}>
                            {cat.verdict}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <p className="text-xs text-center text-muted-foreground">
              Analyzed at {new Date(meta.analyzed_at).toLocaleString()} • Powered by AI + Algorand
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
