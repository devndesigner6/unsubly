import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { formatCurrency } from "@/lib/currency"
import { cx } from "@/lib/utils"
import { RiArrowRightLine, RiLoader4Line } from "@remixicon/react"
import { Link } from "react-router-dom"
import { useEffect, useState, memo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"

interface Subscription {
  id: string; name: string; amount: number; currency: string | null
  billing_cycle: string; next_billing_date: string; status: string | null; category: string | null
}

const statusConfig = {
  active: { variant: "success" as const, label: "Active", color: "emerald" },
  trial: { variant: "warning" as const, label: "Trial", color: "amber" },
  cancelled: { variant: "neutral" as const, label: "Cancelled", color: "gray" },
  paused: { variant: "default" as const, label: "Paused", color: "blue" },
} as const

const categoryColors: Record<string, string> = {
  Entertainment: "#E50914", Music: "#1DB954", Development: "#6366F1",
  Design: "#F24E1E", Cloud: "#FF9900", Productivity: "#0078D4", default: "#6B7280",
}

const SubscriptionListItem = memo(function SubscriptionListItem({ subscription: sub }: { subscription: Subscription }) {
  const status = statusConfig[(sub.status as keyof typeof statusConfig) || "active"] || statusConfig.active
  const color = categoryColors[sub.category || ""] || categoryColors.default
  return (
    <Link to={`/subscriptions/${sub.id}`} className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: `${color}15`, color }}>{sub.name.charAt(0)}</div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-50">{sub.name}</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{sub.category || "Uncategorized"}</span><span>•</span><span className="capitalize">{sub.billing_cycle}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold text-gray-900 dark:text-gray-50">{formatCurrency(sub.amount, sub.currency || "USD")}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Next: {new Date(sub.next_billing_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        </div>
        <Badge variant={status.variant} className="rounded-full">
          <span className={cx("mr-1.5 size-1.5 rounded-full", status.color === "emerald" && "bg-emerald-500", status.color === "amber" && "bg-amber-500", status.color === "gray" && "bg-gray-500", status.color === "blue" && "bg-blue-500")} />
          {status.label}
        </Badge>
      </div>
    </Link>
  )
})

export function RecentSubscriptions() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function fetchData() {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, amount, currency, billing_cycle, next_billing_date, status, category")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)
      setSubscriptions((data as Subscription[]) || [])
      setLoading(false)
    }
    fetchData()
  }, [user])

  if (loading) return <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><RiLoader4Line className="size-6 animate-spin text-gray-400" /></div>

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Recent Subscriptions</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your latest subscription activities</p>
        </div>
        <Button variant="secondary" asChild className="group">
          <Link to="/subscriptions">View All <RiArrowRightLine className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" /></Link>
        </Button>
      </div>
      {subscriptions.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No subscriptions yet. Add your first subscription to get started.</p>
          <Button asChild className="mt-4"><Link to="/subscriptions/new">Add Subscription</Link></Button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">{subscriptions.map((sub) => <SubscriptionListItem key={sub.id} subscription={sub} />)}</div>
      )}
    </div>
  )
}
