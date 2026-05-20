import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"

export type Plan = "free" | "pro"

const FREE_SUB_LIMIT = 10
const CHECKOUT_URL = "https://checkout.dodopayments.com/buy/pdt_0NfAOGyle2UpxBVyJL1Cn?quantity=1&redirect_url=https://unsubly2.vercel.app/dashboard"

interface PlanState {
  plan: Plan
  loading: boolean
  subCount: number
  canAddSub: boolean
  isPro: boolean
  checkoutUrl: string
  openCheckout: () => void
}

export function usePlan(): PlanState {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan>("free")
  const [subCount, setSubCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    // Developer account always has pro access (for hackathon demo)
    if (user.email === "mesurya.build@gmail.com" || user.email === "mesurya.builds@gmail.com") {
      setPlan("pro")
      setLoading(false)
      return
    }

    const fetchPlan = async () => {
      setLoading(true)
      try {
        // Get plan from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle()

        const userPlan = (profile as any)?.plan === "pro" ? "pro" : "free"
        setPlan(userPlan)

        // Get subscription count
        const { count } = await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)

        setSubCount(count ?? 0)
      } catch {
        setPlan("free")
      } finally {
        setLoading(false)
      }
    }

    fetchPlan()

    // Re-check when window regains focus (user might have just paid)
    const handleFocus = () => fetchPlan()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [user])

  const isPro = plan === "pro"
  const canAddSub = isPro || subCount < FREE_SUB_LIMIT

  const openCheckout = () => {
    // Append user email to checkout URL for Dodo to match
    const email = user?.email || ""
    const url = email
      ? `${CHECKOUT_URL}&customer_email=${encodeURIComponent(email)}`
      : CHECKOUT_URL
    window.open(url, "_blank")
  }

  return { plan, loading, subCount, canAddSub, isPro, checkoutUrl: CHECKOUT_URL, openCheckout }
}
