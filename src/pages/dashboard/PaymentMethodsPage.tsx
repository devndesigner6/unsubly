import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiBankCardLine, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiCheckLine, RiPaypalLine,
  RiBankLine, RiAlertLine,
} from "@remixicon/react"
import type { Database } from "@/integrations/supabase/types"

type PaymentMethodType = Database["public"]["Enums"]["payment_method_type"]

// Card data stored as JSON in the `name` field for structured cards
interface CardData {
  __card: true
  brand: CardBrand
  holder: string
  expiry: string   // "MM/YY"
  nickname?: string
}

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "rupay" | "upi" | "other"

interface PaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  last_four: string | null
  created_at: string
}

const TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "paypal", label: "PayPal" },
  { value: "bank_account", label: "Bank Account" },
  { value: "other", label: "Other" },
]

const CARD_BRANDS: { value: CardBrand; label: string; colors: string; textColor: string }[] = [
  { value: "visa", label: "VISA", colors: "bg-blue-700", textColor: "text-white" },
  { value: "mastercard", label: "MC", colors: "bg-red-600", textColor: "text-white" },
  { value: "amex", label: "AMEX", colors: "bg-green-700", textColor: "text-white" },
  { value: "discover", label: "DISC", colors: "bg-orange-500", textColor: "text-white" },
  { value: "rupay", label: "RuPay", colors: "bg-indigo-700", textColor: "text-white" },
  { value: "upi", label: "UPI", colors: "bg-purple-700", textColor: "text-white" },
  { value: "other", label: "Card", colors: "bg-gray-600", textColor: "text-white" },
]

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]

function getBrandConfig(brand: CardBrand) {
  return CARD_BRANDS.find(b => b.value === brand) ?? CARD_BRANDS[CARD_BRANDS.length - 1]
}

function parseCard(name: string): CardData | null {
  try {
    const p = JSON.parse(name)
    if (p.__card === true) return p as CardData
  } catch {}
  return null
}

function isCardType(type: PaymentMethodType) {
  return type === "credit_card" || type === "debit_card"
}

function TypeIcon({ type, brand }: { type: PaymentMethodType; brand?: CardBrand }) {
  switch (type) {
    case "paypal": return <RiPaypalLine className="size-5 text-blue-500" />
    case "bank_account": return <RiBankLine className="size-5 text-muted-foreground" />
    default: {
      if (brand) {
        const cfg = getBrandConfig(brand)
        return (
          <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${cfg.colors} ${cfg.textColor}`}>
            {cfg.label}
          </span>
        )
      }
      return <RiBankCardLine className="size-5 text-muted-foreground" />
    }
  }
}

function VisualCard({ type, card, lastFour }: { type: PaymentMethodType; card: CardData | null; lastFour: string }) {
  const brand = card?.brand ?? "other"
  const brandCfg = getBrandConfig(brand)
  const holder = card?.holder || "Cardholder"
  const expiry = card?.expiry || "••/••"

  if (!isCardType(type) || !lastFour) return null

  return (
    <div className={`relative w-full max-w-xs rounded-2xl p-5 shadow-lg select-none text-white ${
      brand === "visa" ? "bg-gradient-to-br from-blue-700 to-blue-900" :
      brand === "mastercard" ? "bg-gradient-to-br from-red-600 to-red-900" :
      brand === "amex" ? "bg-gradient-to-br from-green-700 to-green-900" :
      brand === "discover" ? "bg-gradient-to-br from-orange-500 to-orange-700" :
      brand === "rupay" ? "bg-gradient-to-br from-indigo-700 to-indigo-900" :
      brand === "upi" ? "bg-gradient-to-br from-purple-700 to-purple-900" :
      "bg-gradient-to-br from-gray-700 to-gray-900"
    }`}>
      <div className="flex items-center justify-between mb-8">
        <span className="text-xs font-medium opacity-80">{TYPE_OPTIONS.find(t => t.value === type)?.label}</span>
        <span className="text-sm font-bold tracking-widest">{brandCfg.label}</span>
      </div>
      <div className="mb-6 font-mono text-lg tracking-widest">
        •••• •••• •••• {lastFour || "••••"}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] opacity-60 uppercase tracking-wider mb-0.5">Card Holder</p>
          <p className="text-sm font-medium">{holder}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] opacity-60 uppercase tracking-wider mb-0.5">Expires</p>
          <p className="text-sm font-medium">{expiry}</p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form fields
  const [type, setType] = useState<PaymentMethodType>("credit_card")
  const [brand, setBrand] = useState<CardBrand>("visa")
  const [holder, setHolder] = useState("")
  const [lastFour, setLastFour] = useState("")
  const [expiryMonth, setExpiryMonth] = useState("")
  const [expiryYear, setExpiryYear] = useState("")
  const [nickname, setNickname] = useState("")

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setMethods(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  function resetForm() {
    setEditingId(null)
    setType("credit_card")
    setBrand("visa")
    setHolder("")
    setLastFour("")
    setExpiryMonth("")
    setExpiryYear("")
    setNickname("")
    setShowForm(false)
  }

  function startEdit(m: PaymentMethod) {
    setEditingId(m.id)
    setType(m.type)
    const card = parseCard(m.name)
    if (card) {
      setBrand(card.brand)
      setHolder(card.holder)
      const [em, ey] = card.expiry.split("/")
      setExpiryMonth(em ?? "")
      setExpiryYear(ey ?? "")
      setNickname(card.nickname ?? "")
    } else {
      setBrand("other")
      setHolder("")
      setExpiryMonth("")
      setExpiryYear("")
      setNickname(m.name)
    }
    setLastFour(m.last_four ?? "")
    setShowForm(true)
  }

  function buildName(): string {
    if (isCardType(type)) {
      const cardData: CardData = {
        __card: true,
        brand,
        holder: holder.trim() || "Cardholder",
        expiry: expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : "",
        nickname: nickname.trim() || undefined,
      }
      return JSON.stringify(cardData)
    }
    return nickname.trim() || type.replace("_", " ")
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const payload = {
      name: buildName(),
      type,
      last_four: lastFour || null,
    }
    if (editingId) {
      await supabase.from("payment_methods").update(payload).eq("id", editingId)
    } else {
      await supabase.from("payment_methods").insert({ ...payload, user_id: user.id })
    }
    resetForm()
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from("payment_methods").delete().eq("id", id)
    setDeleteConfirmId(null)
    load()
  }

  const isCardForm = isCardType(type)
  const canSave = isCardForm
    ? (lastFour.length === 4 && !!holder.trim())
    : !!nickname.trim()

  // Compute current year for expiry selector
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 15 }, (_, i) => String(thisYear + i).slice(-2))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the cards and accounts linked to your subscriptions</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => { resetForm(); setShowForm(true) }}>
          <RiAddLine className="mr-1.5 size-4" /> Add Method
        </Button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">{editingId ? "Edit Payment Method" : "New Payment Method"}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <RiCloseLine className="size-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Type selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PaymentMethodType)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {isCardForm ? (
              <>
                {/* Brand selector */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Card Network</label>
                  <div className="flex flex-wrap gap-2">
                    {CARD_BRANDS.map(b => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBrand(b.value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider transition-all ${
                          brand === b.value
                            ? `${b.colors} ${b.textColor} ring-2 ring-offset-2 ring-current scale-105`
                            : "border border-border bg-muted text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card preview */}
                <VisualCard type={type} card={{ __card: true, brand, holder, expiry: `${expiryMonth}/${expiryYear}` }} lastFour={lastFour} />

                {/* Cardholder name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Cardholder Name <span className="text-destructive">*</span></label>
                  <input
                    value={holder}
                    onChange={e => setHolder(e.target.value)}
                    placeholder="John Doe"
                    maxLength={60}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Last 4 + Expiry */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Last 4 Digits <span className="text-destructive">*</span></label>
                    <input
                      value={lastFour}
                      onChange={e => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="4242"
                      maxLength={4}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Exp. Month</label>
                    <select
                      value={expiryMonth}
                      onChange={e => setExpiryMonth(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">MM</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Exp. Year</label>
                    <select
                      value={expiryYear}
                      onChange={e => setExpiryYear(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">YY</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Optional nickname */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Nickname <span className="text-xs text-muted-foreground">(optional)</span></label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="e.g. Personal Visa"
                    maxLength={60}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Non-card: just nickname + optional last 4 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {type === "paypal" ? "PayPal Email / Label" : type === "bank_account" ? "Account Nickname" : "Name"} <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder={type === "paypal" ? "user@example.com" : type === "bank_account" ? "Savings Account" : "Payment Method"}
                    maxLength={100}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {type === "bank_account" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Last 4 Digits</label>
                    <input
                      value={lastFour}
                      onChange={e => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="5678"
                      maxLength={4}
                      className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              <RiCheckLine className="mr-1.5 size-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <RiDeleteBinLine className="size-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Delete payment method?</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button
                onClick={() => handleDelete(deleteConfirmId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Methods list */}
      <div className="mt-6 space-y-3">
        {methods.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <RiBankCardLine className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">No payment methods yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a card or account to track how you pay for subscriptions.</p>
          </div>
        ) : (
          methods.map(m => {
            const card = parseCard(m.name)
            const displayName = card
              ? (card.nickname || `${getBrandConfig(card.brand).label} •••• ${m.last_four ?? ""}`)
              : m.name

            return (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="shrink-0">
                    <TypeIcon type={m.type} brand={card?.brand} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{displayName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span>{TYPE_OPTIONS.find(o => o.value === m.type)?.label}</span>
                      {m.last_four && (
                        <span className="font-mono">•••• {m.last_four}</span>
                      )}
                      {card?.expiry && <span>Expires {card.expiry}</span>}
                      {card?.holder && <span>{card.holder}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button onClick={() => startEdit(m)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <RiEditLine className="size-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <RiDeleteBinLine className="size-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
