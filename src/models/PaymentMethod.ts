export type PaymentMethodType =
  | "credit_card"
  | "debit_card"
  | "paypal"
  | "bank_account"
  | "other"

export interface IPaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  last_four?: string
  user_id: string
  created_at: string
  updated_at: string
}

export default {} // no-op default export for compatibility
