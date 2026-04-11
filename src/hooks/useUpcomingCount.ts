import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"

export function useUpcomingCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return
    async function fetch() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const sevenDays = new Date(today)
      sevenDays.setDate(sevenDays.getDate() + 7)

      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user!.id)
        .in("status", ["active", "trial"])
        .gte("next_billing_date", today.toISOString().split("T")[0])
        .lte("next_billing_date", sevenDays.toISOString().split("T")[0])

      setCount(data?.length ?? 0)
    }
    fetch()
    // Refresh every 5 minutes
    const interval = setInterval(fetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  return count
}
