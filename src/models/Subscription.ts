export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly"
export type SubscriptionStatus = "active" | "cancelled" | "trial" | "paused"

export interface ISubscription {
  id: string
  name: string
  description?: string
  amount: number
  currency: string
  billing_cycle: BillingCycle
  next_billing_date: string
  start_date: string
  status: SubscriptionStatus
  category?: string
  url?: string
  logo?: string
  notes?: string
  alert_days: number
  alert_enabled: boolean
  last_alert_sent?: string
  user_id: string
  folder_id?: string
  payment_method_id?: string
  created_at: string
  updated_at: string
}

export default {} // no-op default export for compatibility
