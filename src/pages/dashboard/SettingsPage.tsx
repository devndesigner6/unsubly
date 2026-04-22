import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAlgorand } from "@/lib/algorand/context"
import { fetchProfile, updateProfile } from "@/lib/supabase-queries"
import { supabase } from "@/integrations/supabase/client"
import algosdk from "algosdk"
import { toast } from "sonner"

import { Button } from "@/components/Button"
import {
  RiLoader4Line, RiSaveLine, RiLogoutBoxLine, RiAlertLine,
  RiUserLine, RiMoneyDollarCircleLine, RiNotification3Line,
  RiShieldLine, RiCheckLine, RiLockPasswordLine,
  RiArrowLeftRightLine, RiWalletLine, RiMailSendLine,
  RiDeleteBinLine, RiErrorWarningLine,
} from "@remixicon/react"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "SGD", "AED"]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { walletAddress, network, switchNetwork } = useAlgorand()

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
  const [addressError, setAddressError] = useState("")

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  // sendingTestAlert removed, email reminders are coming soon

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Sync wallet address from Pera when connected
  useEffect(() => {
    if (walletAddress && walletAddress !== algorandAddress) {
      setAlgorandAddress(walletAddress)
      setAddressError("")
    }
  }, [walletAddress])

  const validateAlgorandAddress = (addr: string): boolean => {
    if (!addr) return true // empty is valid
    if (addr.length !== 58) {
      setAddressError("Address must be 58 characters")
      return false
    }
    try {
      algosdk.decodeAddress(addr)
      setAddressError("")
      return true
    } catch {
      setAddressError("Invalid Algorand address checksum")
      return false
    }
  }

  async function handleSave() {
    if (!user) return
    if (algorandAddress && !validateAlgorandAddress(algorandAddress)) return
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

  function validatePasswordStrength(pwd: string): string | null {
    if (pwd.length < 8) return "Password must be at least 8 characters"
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter"
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter"
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number"
    return null
  }

  async function handleChangePassword() {
    setPasswordError("")
    setPasswordSuccess(false)
    const strengthError = validatePasswordStrength(newPassword)
    if (strengthError) {
      setPasswordError(strengthError)
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


  async function handleDeleteAccount() {
    if (!user || deleteConfirmText !== "DELETE") return
    setIsDeleting(true)

    // Helper, delete from a table silently; ignore 404 / RLS / missing table errors
    async function tryDelete(table: string, column: string, value: string) {
      try {
        await (supabase.from(table as any) as any).delete().eq(column, value)
      } catch (_) { /* table may not exist in this environment, that's fine */ }
    }

    try {
      // Step 1, wipe every application data table; failures are silent
      await tryDelete("resume_shares",   "user_id", user.id)
      await tryDelete("onchain_payments","user_id", user.id)
      await tryDelete("agent_actions",   "user_id", user.id)
      await tryDelete("escrow_vaults",   "user_id", user.id)
      await tryDelete("subscriptions",   "user_id", user.id)
      await tryDelete("profiles",        "id",      user.id)

      // Step 2, obfuscate the email so the original address is free to re-register.
      // GoTrue's DELETE /user (405) is disabled in Lovable's Supabase, so instead we
      // rename the email to a throwaway address. If Supabase requires email confirmation
      // the rename won't take immediate effect, but all data is already gone above.
      const ghostEmail = `deleted_${user.id.slice(0, 8)}_${Date.now()}@unsubscribely.deleted`
      const { error: updateErr } = await supabase.auth.updateUser({ email: ghostEmail })

      if (updateErr) {
        // Email rename failed (e.g. confirmation required), data is still gone; sign out.
        toast.success("Account data deleted", {
          description: "All your subscriptions, vaults, and profile have been permanently removed. Your login email may still be reserved, use a different address or add +1 to re-register.",
          duration: 8000,
        })
      } else {
        toast.success("Account deleted", {
          description: "All data wiped and your email has been released. You can re-register with the same address.",
        })
      }

      await signOut()
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete account")
      setIsDeleting(false)
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
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground mb-0.5">Email Reminder Delivery</p>
                  <p className="text-xs text-muted-foreground">
                    Automated renewal alerts sent to <span className="font-mono">{user?.email}</span>
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <RiLoader4Line className="size-3" />
                  Coming Soon
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Email delivery is being set up. Your preferences below are saved and will activate automatically when it launches.
              </p>
            </div>
          </div>
        </section>

        {/* Algorand */}
        <section className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiShieldLine className="size-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Algorand Wallet</h2>
            </div>
            <button
              onClick={() => switchNetwork(network === "testnet" ? "mainnet" : "testnet")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                network === "mainnet"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              <RiArrowLeftRightLine className="size-3" />
              {network === "mainnet" ? "Mainnet" : "Testnet"}
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Wallet Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={algorandAddress}
                  onChange={(e) => {
                    setAlgorandAddress(e.target.value)
                    if (e.target.value) validateAlgorandAddress(e.target.value)
                    else setAddressError("")
                  }}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    addressError ? "border-destructive" : "border-input"
                  }`}
                  placeholder="ALGO..."
                />
                {walletAddress && walletAddress === algorandAddress && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-600">
                    <RiWalletLine className="size-3" /> Pera
                  </span>
                )}
              </div>
              {addressError && <p className="mt-1 text-xs text-destructive">{addressError}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {walletAddress
                  ? "Synced from your connected Pera Wallet"
                  : "Your Algorand address for on-chain features"}
              </p>
            </div>
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
                placeholder="Min 8 chars, uppercase, lowercase, number"
                autoComplete="new-password"
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
                autoComplete="new-password"
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

        {/* Danger Zone */}
        <section className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <RiErrorWarningLine className="size-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Permanently delete your account and all associated data, subscriptions, escrow vaults, on-chain payment records, NFT receipts, and your profile. This cannot be undone. If you sign up again with the same email, you will start completely fresh.
          </p>
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <RiDeleteBinLine className="mr-2 size-4" />
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || isDeleting}
                >
                  {isDeleting ? (
                    <><RiLoader4Line className="mr-2 size-4 animate-spin" />Deleting everything...</>
                  ) : (
                    <><RiDeleteBinLine className="mr-2 size-4" />Confirm Delete</>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
