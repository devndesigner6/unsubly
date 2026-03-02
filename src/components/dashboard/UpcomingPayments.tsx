import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { RiArrowRightLine, RiLoader4Line, RiTimeLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { useEffect, useState, memo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"

interface UpcomingPayment {
  id: string
  name: string
  amount: number
  currency: string
  next_billing_date: string
  billing_cycle: string
  category?: string
  status?: string
}

function formatDaysFromNow(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Today"
  if (days === 1) return "Tomorrow"
  return `In ${days} days`
}

function getDaysUntil(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const categoryColors: Record<string, string> = {
  Entertainment: "#E50914", Music: "#1DB954", Development: "#6366F1",
  Design: "#F24E1E", Cloud: "#FF9900", Productivity: "#0078D4", default: "#6B7280",
}

const PaymentListItem = memo(function PaymentListItem({ payment, displayCurrency }: { payment: UpcomingPayment; displayCurrency: string }) {
  const daysUntil = getDaysUntil(payment.next_billing_date)
  const isUrgent = daysUntil <= 1
  const isWarning = daysUntil <= 3
  const color = categoryColors[payment.category || ""] || categoryColors.default

  return (
    <div className={cx("flex items-center justify-between rounded-xl p-4 transition-all", isUrgent ? "bg-red-50 dark:bg-red-900/20" : isWarning ? "bg-amber-50 dark:bg-amber-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50")}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: `${color}15`, color }}>
          {payment.name.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-50">{payment.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{payment.category || payment.billing_cycle}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900 dark:text-gray-50">{formatCurrency(payment.amount, payment.currency || displayCurrency)}</p>
        <p className={cx("text-sm font-medium", isUrgent ? "text-red-600 dark:text-red-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400")}>{formatDaysFromNow(payment.next_billing_date)}</p>
      </div>
    </div>
  )
})

export function UpcomingPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<UpcomingPayment[]>([])
  const [displayCurrency, setDisplayCurrency] = useState("USD")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function fetchData() {
      const now = new Date().toISOString().split("T")[0]
      const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, amount, currency, next_billing_date, billing_cycle, category, status")
        .eq("user_id", user!.id)
        .gte("next_billing_date", now)
        .lte("next_billing_date", sevenDays)
        .order("next_billing_date")
        .limit(5)
      setPayments((data as UpcomingPayment[]) || [])
      setLoading(false)
    }
    fetchData()
  }, [user])

  if (loading) {
    return <div className="flex h-96 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><RiLoader4Line className="size-6 animate-spin text-gray-400" /></div>
  }

  const total = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <RiTimeLine className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Upcoming Payments</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Next 7 days</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(total, displayCurrency)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">total due</p>
        </div>
      </div>
      <div className="p-2">
        {payments.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">All clear!</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No upcoming payments in the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-1">{payments.map((p) => <PaymentListItem key={p.id} payment={p} displayCurrency={displayCurrency} />)}</div>
        )}
      </div>
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <Button variant="ghost" asChild className="w-full justify-center group">
          <Link to="/calendar">View Calendar <RiArrowRightLine className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" /></Link>
        </Button>
      </div>
    </div>
  )
}
