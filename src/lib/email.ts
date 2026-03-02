// Email functionality has been moved to backend edge functions.
// This file is kept as a stub for compatibility.

export interface SubscriptionAlertData {
  subscriptionName: string
  amount: number
  currency: string
  billingDate: Date
  daysUntil: number
  userName?: string
}

export interface WelcomeEmailData {
  userName: string
  email: string
}
