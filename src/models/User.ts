export interface IUser {
  id: string
  email: string
  name?: string
  currency: string
  default_alert_days?: number
  email_alerts: boolean
  weekly_digest: boolean
  created_at: string
  updated_at: string
}

export default {} // no-op default export for compatibility
