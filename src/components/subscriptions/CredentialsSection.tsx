/**
 * CredentialsSection
 *
 * Lets users store their service login credentials once so the OpenClaw agent
 * can automatically cancel the subscription via browser automation.
 *
 * Security model:
 * - Password is sent to /api/save-credentials which encrypts it server-side (AES-256-GCM)
 * - The encrypted value is stored in Supabase — plaintext never touches the DB
 * - Once saved, the password field is NEVER shown again — only a "••••••••" placeholder
 * - The agent reads credentials via service_role key (bypasses RLS)
 * - Users can update credentials by entering a new password
 */

import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { toast } from "sonner"
import {
  RiShieldKeyholeLine, RiEyeLine, RiEyeOffLine,
  RiCheckLine, RiLockLine, RiDeleteBinLine,
} from "@remixicon/react"

interface Props {
  subscriptionId: string
  subscriptionName: string
  /** Whether credentials have already been saved (from DB: credentials_set_at IS NOT NULL) */
  credentialsAlreadySet: boolean
  onSaved: () => void
}

export function CredentialsSection({
  subscriptionId,
  subscriptionName,
  credentialsAlreadySet,
  onSaved,
}: Props) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showForm, setShowForm] = useState(!credentialsAlreadySet)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")

      const res = await fetch("/api/save-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          username: username.trim(),
          password,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")

      toast.success("Credentials saved securely", {
        description: "The agent can now cancel this subscription automatically.",
      })
      setUsername("")
      setPassword("")
      setShowForm(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save credentials")
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      // Clear credentials directly via Supabase — null out the fields
      const { error } = await supabase
        .from("subscriptions")
        .update({
          service_username: null,
          service_password_enc: null,
          credentials_set_at: null,
        })
        .eq("id", subscriptionId)

      if (error) throw error

      toast.success("Credentials removed")
      setShowForm(true)
      onSaved()
    } catch (err) {
      toast.error("Failed to clear credentials")
    } finally {
      setClearing(false)
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-black">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiShieldKeyholeLine className="size-4 text-gray-700 dark:text-white/70" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Agent Credentials
          </h2>
        </div>
        {credentialsAlreadySet && !showForm && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <RiCheckLine className="size-3" /> Saved
            </span>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Update
            </button>
          </div>
        )}
      </header>

      <p className="text-xs text-gray-500">
        Store your {subscriptionName} login so the OpenClaw agent can cancel it automatically
        when you reply CANCEL on Telegram. Password is encrypted server-side and never shown again.
      </p>

      {credentialsAlreadySet && !showForm ? (
        // Credentials are set — show masked state
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <RiLockLine className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Credentials stored securely</p>
              <p className="text-sm font-medium text-foreground">••••••••••••</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowForm(true)}
              className="text-xs"
            >
              Update credentials
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={clearing}
              className="text-xs text-destructive hover:text-destructive"
            >
              <RiDeleteBinLine className="mr-1 size-3" />
              {clearing ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        // Show the credential entry form
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-white/50">
              Email / Username
            </label>
            <Input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`your@email.com`}
              autoComplete="off"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-white/50">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="new-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword
                  ? <RiEyeOffLine className="size-4" />
                  : <RiEyeLine className="size-4" />
                }
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
            🔒 Encrypted with AES-256 before storage. Never shown again after saving.
            Only the OpenClaw agent can use these to cancel your subscription.
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={saving || !username.trim() || !password}
              className="text-xs"
            >
              {saving ? "Saving…" : "Save credentials"}
            </Button>
            {credentialsAlreadySet && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { setShowForm(false); setUsername(""); setPassword("") }}
                className="text-xs"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
