import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  RiLoader4Line,
  RiFileTextLine,
  RiFolderLine,
  RiNotification3Line,
} from "@remixicon/react"

import { useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { 
  createSubscription, 
  updateSubscription, 
  fetchFolders, 
  fetchTags, 
  fetchPaymentMethods,
  setSubscriptionTags,
  fetchProfile
} from "@/lib/supabase-queries"
import { searchSubscriptions, findSubscription, getFaviconUrl, type SubscriptionEntry } from "@/data/subscriptionCatalog"

function parseCardName(name: string) {
  try {
    const p = JSON.parse(name)
    if (p.__card === true) return p
  } catch {}
  return null
}

function formatPaymentMethodLabel(pm: { name: string; last_four?: string | null; type?: string }): string {
  const card = parseCardName(pm.name)
  if (!card) return pm.name
  const brand = card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "Card"
  const last4 = pm.last_four || "••••"
  const holder = card.holder ? ` · ${card.holder}` : ""
  return `${brand} •••• ${last4}${holder}`
}

interface SubscriptionFormProps {
  subscription?: any
  tagIds?: string[]
}

const billingCycles = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

const categories = [
  "Entertainment", "Music", "Development", "Design", "Productivity", 
  "Cloud", "Marketing", "Finance", "Education", "Health", "Other",
]

const currencies = [
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "GBP", label: "GBP (£)", symbol: "£" },
  { value: "INR", label: "INR (₹)", symbol: "₹" },
  { value: "CAD", label: "CAD ($)", symbol: "$" },
  { value: "AUD", label: "AUD ($)", symbol: "$" },
  { value: "JPY", label: "JPY (¥)", symbol: "¥" },
]

export function SubscriptionForm({ subscription, tagIds: initialTagIds = [] }: SubscriptionFormProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = !!subscription

  // Autocomplete state
  const [nameSuggestions, setNameSuggestions] = useState<SubscriptionEntry[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<SubscriptionEntry | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    currency: "USD",
    billingCycle: "monthly",
    nextBillingDate: new Date().toISOString().split("T")[0],
    startDate: new Date().toISOString().split("T")[0],
    status: "active",
    category: "",
    url: "",
    notes: "",
    alertDays: "3",
    alertEnabled: true,
    folderId: "",
    paymentMethodId: "",
    tagIds: [] as string[],
    requireConfirmation: false, // Feature 4: trial guard
  })

  const [folders, setFolders] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (subscription) {
      setFormData({
        name: subscription.name || "",
        description: subscription.description || "",
        amount: subscription.amount?.toString() || "",
        currency: subscription.currency || "USD",
        billingCycle: subscription.billing_cycle || "monthly",
        nextBillingDate: subscription.next_billing_date 
          ? new Date(subscription.next_billing_date).toISOString().split("T")[0] 
          : new Date().toISOString().split("T")[0],
        startDate: subscription.start_date
          ? new Date(subscription.start_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        status: subscription.status || "active",
        category: subscription.category || "",
        url: subscription.url || "",
        notes: subscription.notes || "",
        alertDays: subscription.alert_days?.toString() || "3",
        alertEnabled: subscription.alert_enabled ?? true,
        folderId: subscription.folder_id || "",
        paymentMethodId: subscription.payment_method_id || "",
        tagIds: initialTagIds,
      })
    }
  }, [subscription, initialTagIds])

  useEffect(() => {
    if (!user) return
    async function loadOptions() {
      try {
        const [foldersData, tagsData, paymentMethodsData, profile] = await Promise.all([
          fetchFolders(user!.id),
          fetchTags(user!.id),
          fetchPaymentMethods(user!.id),
          !isEditing ? fetchProfile(user!.id) : null
        ])
        
        setFolders(foldersData)
        setTags(tagsData)
        setPaymentMethods(paymentMethodsData)
        
        if (profile && !isEditing) {
          setFormData(prev => ({
            ...prev,
            currency: profile.currency || "USD",
            alertDays: String(profile.default_alert_days || 3),
            alertEnabled: profile.email_alerts ?? true
          }))
        }
      } catch (err) {
        console.error("Failed to load options", err)
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [user, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setError("")
    setIsLoading(true)

    try {
      // Duplicate check: prevent creating a subscription with the same name
      // unless it's an edit of the existing one
      if (!isEditing) {
        const { supabase } = await import("@/integrations/supabase/client")
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("id, name")
          .eq("user_id", user.id)
          .ilike("name", formData.name.trim())
        if (existing && existing.length > 0) {
          setError(`You already have "${existing[0].name}" tracked. Edit the existing one or use a different name (e.g. "${formData.name.trim()} - 2nd account").`)
          setIsLoading(false)
          return
        }
      }

      const subscriptionData = {
        name: formData.name,
        description: formData.description || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        billing_cycle: formData.billingCycle,
        next_billing_date: formData.nextBillingDate,
        start_date: formData.startDate,
        status: formData.status,
        category: formData.category || null,
        url: formData.url || null,
        notes: formData.notes || null,
        alert_days: parseInt(formData.alertDays),
        alert_enabled: formData.alertEnabled,
        folder_id: formData.folderId || null,
        payment_method_id: formData.paymentMethodId || null,
        user_id: user.id
      } as any

      let subscriptionId = subscription?.id

      if (isEditing) {
        await updateSubscription(subscription.id, subscriptionData)
      } else {
        const newSub = await createSubscription(subscriptionData)
        subscriptionId = newSub.id
      }

      // Update tags
      await setSubscriptionTags(subscriptionId, formData.tagIds)

      // Feature 4: save trial guard setting to subscription_guardrails
      if (formData.requireConfirmation) {
        const { supabase } = await import("@/integrations/supabase/client")
        await (supabase.from("subscription_guardrails" as any) as any).upsert({
          subscription_id: subscriptionId,
          require_confirmation: true,
          is_trial: formData.status === "trial",
        }, { onConflict: "subscription_id" })
      }

      navigate("/subscriptions")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border">
              <RiFileTextLine className="size-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
              <p className="text-sm text-muted-foreground">Enter subscription details</p>
            </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="sub-name" className="mb-2 block text-sm font-medium text-foreground">Name *</label>
            <div className="relative" ref={suggestionsRef}>
              <div className="flex items-center gap-2">
                {selectedCatalogEntry && (
                  <img
                    src={getFaviconUrl(selectedCatalogEntry.domain)}
                    alt=""
                    className="size-6 rounded object-contain bg-white p-0.5 border border-border"
                  />
                )}
                <Input
                  ref={nameInputRef}
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({ ...formData, name: val })
                    if (val.length >= 2 && !isEditing) {
                      const results = searchSubscriptions(val)
                      setNameSuggestions(results)
                      setShowSuggestions(results.length > 0)
                    } else {
                      setShowSuggestions(false)
                    }
                    // Clear selected entry if name changes
                    if (selectedCatalogEntry && val.toLowerCase() !== selectedCatalogEntry.name.toLowerCase()) {
                      setSelectedCatalogEntry(null)
                    }
                  }}
                  onFocus={() => {
                    if (nameSuggestions.length > 0 && !isEditing) setShowSuggestions(true)
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  placeholder="e.g., Netflix, Spotify, ChatGPT..."
                  required
                  className="flex-1"
                />
              </div>
              {/* Autocomplete dropdown */}
              {showSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                  {nameSuggestions.map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setFormData({
                          ...formData,
                          name: entry.name,
                          category: entry.category || formData.category,
                        })
                        setSelectedCatalogEntry(entry)
                        setShowSuggestions(false)
                        setNameSuggestions([])
                      }}
                    >
                      <img
                        src={getFaviconUrl(entry.domain)}
                        alt=""
                        className="size-6 rounded object-contain bg-white p-0.5 border border-border shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                        <p className="text-[11px] text-muted-foreground">{entry.category}</p>
                      </div>
                      {entry.autoCancel && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Auto-cancel
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="sub-amount" className="mb-2 block text-sm font-medium text-foreground">Amount *</label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="9.99"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Currency</label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Billing Cycle</label>
            <Select value={formData.billingCycle} onValueChange={(v) => setFormData({ ...formData, billingCycle: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {billingCycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="sub-next-billing" className="mb-2 block text-sm font-medium text-foreground">Next Billing Date</label>
            <Input
              type="date"
              value={formData.nextBillingDate}
              onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
              required
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="sub-description" className="mb-2 block text-sm font-medium text-foreground">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border">
            <RiFolderLine className="size-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Organization</h2>
            <p className="text-sm text-muted-foreground">Folders, tags, and payment methods</p>
          </div>
        </div>

        {loadingOptions ? (
          <div className="flex justify-center py-8"><RiLoader4Line className="animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Folder</label>
              <Select value={formData.folderId} onValueChange={(v) => setFormData({ ...formData, folderId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Payment Method</label>
              <Select value={formData.paymentMethodId} onValueChange={(v) => setFormData({ ...formData, paymentMethodId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {formatPaymentMethodLabel(pm)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border">
            <RiNotification3Line className="size-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Reminders</h2>
            <p className="text-sm text-muted-foreground">Get notified before this subscription renews</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Renewal Alert</p>
            <p className="text-xs text-muted-foreground mt-0.5">Notify me before this subscription bills</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, alertEnabled: !formData.alertEnabled })}
            className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${formData.alertEnabled ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle renewal alert"
          >
            <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-primary-foreground shadow transition-transform ${formData.alertEnabled ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {/* Feature 4: Trial-to-paid guard */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Ask before paying <span className="ml-1.5 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-foreground">OpenClaw</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Agent will ask you via Telegram before releasing payment. Useful for trials.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, requireConfirmation: !formData.requireConfirmation })}
            className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${(formData as any).requireConfirmation ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle payment confirmation"
          >
            <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-primary-foreground shadow transition-transform ${(formData as any).requireConfirmation ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => navigate("/subscriptions")}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : null}
          {isEditing ? "Save Changes" : "Create Subscription"}
        </Button>
      </div>
    </form>
  )
}
