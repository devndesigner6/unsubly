import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { fetchProfile, updateProfile } from "@/lib/supabase-queries"
import { supabase } from "@/integrations/supabase/client"
import { usePushNotifications } from "@/lib/usePushNotifications"
import { Button } from "@/components/Button"
import {
  RiLoader4Line, RiSaveLine, RiLogoutBoxLine, RiAlertLine,
  RiUserLine, RiMoneyDollarCircleLine, RiNotification3Line,
  RiShieldLine, RiCheckLine, RiLockPasswordLine,
  RiSmartphoneLine,
} from "@remixicon/react"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "SGD", "AED"]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [defaultAlertDays, setDefaultAlertDays] = useState(3)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [algorandAddress, setAlgorandAddress] = useState("")

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const prof = await fetchProfile(user!.id)
        if (prof) {
          setProfile(prof)
          setName(prof.name || "")
          setCurrency(prof.currency || "USD")
          setDefaultAlertDays(prof.default_alert_days ?? 3)
          setEmailAlerts(prof.email_alerts ?? true)
          setWeeklyDigest(prof.weekly_digest ?? false)
          setAlgorandAddress(prof.algorand_address || "")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile(user.id, {
        name,
        currency,
        default_alert_days: defaultAlertDays,
        email_alerts: emailAlerts,
        weekly_digest: weeklyDigest,
        algorand_address: algorandAddress || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError("")
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match")
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Settings</h1>
          <p className="mt-2 text-muted-foreground">Manage your account and preferences</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <RiAlertLine className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Profile Section */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiUserLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>
          </div>
        </section>

        {/* Currency & Preferences */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiMoneyDollarCircleLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Default Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Default Alert Days Before Payment</label>
              <input
                type="number"
                min={1}
                max={30}
                value={defaultAlertDays}
                onChange={(e) => setDefaultAlertDays(Number(e.target.value))}
                className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiNotification3Line className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified before subscription renewals</p>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`relative h-6 w-11 rounded-full transition-colors ${emailAlerts ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-primary-foreground transition-transform ${emailAlerts ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">Weekly summary of your spending</p>
              </div>
              <button
                onClick={() => setWeeklyDigest(!weeklyDigest)}
                className={`relative h-6 w-11 rounded-full transition-colors ${weeklyDigest ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-primary-foreground transition-transform ${weeklyDigest ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
        </section>

        {/* Algorand */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiShieldLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Algorand Wallet</h2>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Wallet Address</label>
            <input
              type="text"
              value={algorandAddress}
              onChange={(e) => setAlgorandAddress(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ALGO..."
            />
            <p className="mt-1 text-xs text-muted-foreground">Your Algorand Testnet address for on-chain features</p>
          </div>
        </section>

        {/* Change Password */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <RiLockPasswordLine className="size-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p className="flex items-center gap-1 text-sm text-green-600"><RiCheckLine className="size-4" />Password updated!</p>}
            <Button onClick={handleChangePassword} variant="secondary" disabled={!newPassword}>
              Update Password
            </Button>
          </div>
        </section>

        {/* Save & Sign Out */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><RiLoader4Line className="mr-2 size-4 animate-spin" />Saving...</>
            ) : saved ? (
              <><RiCheckLine className="mr-2 size-4" />Saved!</>
            ) : (
              <><RiSaveLine className="mr-2 size-4" />Save Changes</>
            )}
          </Button>
          <Button variant="destructive" onClick={signOut}>
            <RiLogoutBoxLine className="mr-2 size-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
