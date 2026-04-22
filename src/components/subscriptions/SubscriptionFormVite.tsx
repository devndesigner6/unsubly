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
  RiStoreLine,
} from "@remixicon/react"
import RegistryPickerModal, { cycleDaysToBillingCycle, type RegistryService } from "./RegistryPickerModal"
import { useAlgorand } from "@/lib/algorand/context"

function RegistryPickerButton({ onOpen }: { onOpen: () => void }) {
  const { network } = useAlgorand()
  const isMainnet = network === "mainnet"
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isMainnet}
      title={isMainnet
        ? "Service Registry is testnet-only for now. Switch to TestNet in Settings."
        : "Pick from on-chain Service Registry"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
    >
      <RiStoreLine className="size-3.5" /> From Registry
    </button>
  )
}

import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
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

function parseCardName(name: string) {
  try {
    const p = JSON.parse(name)
    if (p.__card === true) return p
  } catch {}
  return null
}

function formatPaymentMethodLabel(pm: { name: string }): string {
  const card = parseCardName(pm.name)
  if (!card) return pm.name
  const brand = card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "Card"
  const last4 = card.holder ? String(card.holder).slice(-4) : "••••"
  const suffix = card.nickname ? ` · ${card.nickname}` : ""
  return `${brand} •••• ${last4}${suffix}`
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

const statuses = [
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
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

function pickRegistryServiceMapper(s: RegistryService) {
  const algo = s.price_microalgos / 1_000_000
  return {
    name: s.name || s.service_id,
    amount: algo.toFixed(4),
    currency: "USD" as const, // local display currency; on-chain price stays in ALGO
    billingCycle: cycleDaysToBillingCycle(s.cycle_days),
    notes: `On-chain registry service: ${s.service_id} (${algo.toFixed(4)} ALGO / ${s.cycle_days}d, provider ${s.provider.slice(0, 8)}…)`,
  }
}

export function SubscriptionForm({ subscription, tagIds: initialTagIds = [] }: SubscriptionFormProps) {
  const [showRegistryPicker, setShowRegistryPicker] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = !!subscription

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

      navigate("/subscriptions")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
    {showRegistryPicker && (
      <RegistryPickerModal
        onClose={() => setShowRegistryPicker(false)}
        onPick={(s) => {
          const m = pickRegistryServiceMapper(s)
          setFormData(prev => ({ ...prev, ...m }))
          setShowRegistryPicker(false)
        }}
      />
    )}
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
              <RiFileTextLine className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Basic Information</h2>
              <p className="text-sm text-gray-500">Enter subscription details</p>
            </div>
          </div>
          <RegistryPickerButton onOpen={() => setShowRegistryPicker(true)} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Netflix"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</label>
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
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
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
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Billing Cycle</label>
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
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Next Billing Date</label>
            <Input
              type="date"
              value={formData.nextBillingDate}
              onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
              required
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
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
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/50">
            <RiFolderLine className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Organization</h2>
            <p className="text-sm text-gray-500">Folders, tags, and payment methods</p>
          </div>
        </div>

        {loadingOptions ? (
          <div className="flex justify-center py-8"><RiLoader4Line className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Folder</label>
              <Select value={formData.folderId} onValueChange={(v) => setFormData({ ...formData, folderId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
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

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/50">
            <RiNotification3Line className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Reminders</h2>
            <p className="text-sm text-gray-500">Get notified before this subscription renews</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Renewal Alert</p>
            <p className="text-xs text-gray-500 mt-0.5">Notify me before this subscription bills</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, alertEnabled: !formData.alertEnabled })}
            className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${formData.alertEnabled ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
            aria-label="Toggle renewal alert"
          >
            <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${formData.alertEnabled ? "translate-x-5" : ""}`} />
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
    </>
  )
}
