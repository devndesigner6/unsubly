import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { RiLoader4Line, RiArrowUpLine, RiArrowDownLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"

interface MonthlyTrend { month: string; amount: number }

export function SpendingChart() {
  const { user } = useAuth()
  const [chartData, setChartData] = useState<MonthlyTrend[]>([])
  const [displayCurrency, setDisplayCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function fetchData() {
      const { data } = await supabase
        .from("subscriptions")
        .select("amount, billing_cycle, next_billing_date, currency")
        .eq("user_id", user!.id)
        .eq("status", "active")

      // Simple monthly aggregation from active subscriptions
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const now = new Date()
      const months: MonthlyTrend[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const total = (data || []).reduce((sum, s) => sum + (s.amount || 0), 0)
        months.push({ month: monthNames[d.getMonth()], amount: total })
      }
      setChartData(months)
      if (data?.[0]?.currency) setDisplayCurrency(data[0].currency)
      setLoading(false)
    }
    fetchData()
  }, [user])

  const insights = useMemo(() => {
    if (chartData.length < 2) return null
    const current = chartData[chartData.length - 1]?.amount || 0
    const previous = chartData[chartData.length - 2]?.amount || 0
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
    const max = Math.max(...chartData.map((d) => d.amount || 0))
    const total = chartData.reduce((sum, item) => sum + (item.amount || 0), 0)
    return { current, change, isIncreasing: change > 0, average: total / chartData.length, max }
  }, [chartData])

  if (loading) return <div className="flex h-80 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><RiLoader4Line className="size-6 animate-spin text-gray-400" /></div>

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Spending Trend</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Last 6 months</p>
        </div>
        {insights && (
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(insights.current, displayCurrency)}</p>
            <div className={cx("flex items-center justify-end gap-1 text-xs font-medium", insights.isIncreasing ? "text-red-500" : "text-emerald-500")}>
              {insights.isIncreasing ? <RiArrowUpLine className="size-3" /> : <RiArrowDownLine className="size-3" />}
              {Math.abs(insights.change).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {chartData.length > 0 && insights ? (
        <div className="space-y-3">
          {chartData.map((month, index) => {
            const percentage = insights.max > 0 ? (month.amount / insights.max) * 100 : 0
            const isCurrent = index === chartData.length - 1
            return (
              <div key={month.month}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className={cx("font-medium", isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400")}>{month.month}</span>
                  <span className={cx("tabular-nums", isCurrent ? "font-semibold text-gray-900 dark:text-gray-50" : "text-gray-600 dark:text-gray-300")}>{formatCurrency(month.amount, displayCurrency)}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={cx("h-full rounded-full transition-all duration-500", isCurrent ? "bg-gradient-to-r from-blue-500 to-blue-600" : "bg-gray-300 dark:bg-gray-600")} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">No spending data yet</div>
      )}

      {insights && (
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
          <div>
            <p className="text-xs text-gray-500">6-month average</p>
            <p className="font-semibold text-gray-900 dark:text-gray-50">{formatCurrency(insights.average, displayCurrency)}</p>
          </div>
          <Link to="/analytics" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">View details →</Link>
        </div>
      )}
    </div>
  )
}
