import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiBankCardLine,
  RiPaypalLine, RiBankLine, RiWalletLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "motion/react"
import type { Database } from "@/integrations/supabase/types"

type PaymentMethodType = Database["public"]["Enums"]["payment_method_type"]

interface PaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  last_four: string | null
  created_at: string
}

/* ─── Card brand detection from name field (JSON stored) ─── */
type CardBrand = "visa" | "mastercard" | "amex" | "rupay" | "discover" | "upi" | "other"

interface CardMeta {
  __card?: boolean
  brand?: CardBrand
  holder?: string
  expiry?: string
  nickname?: string
}

function parseCardMeta(name: string): CardMeta | null {
  try { const p = JSON.parse(name); if (p.__card) return p } catch {} 
  return null
}

function getDisplayName(method: PaymentMethod): string {
  const meta = parseCardMeta(method.name)
  if (meta?.nickname) return meta.nickname
  if (meta?.holder) return meta.holder
  return method.name
}

function getBrandFromMeta(method: PaymentMethod): CardBrand {
  const meta = parseCardMeta(method.name)
  return meta?.brand || "other"
}

function getExpiry(method: PaymentMethod): string {
  const meta = parseCardMeta(method.name)
  return meta?.expiry || ""
}

/* ─── Visual Card Component ─── */
function CreditCardVisual({ method, onEdit, onDelete }: { method: PaymentMethod; onEdit: () => void; onDelete: () => void }) {
  const brand = getBrandFromMeta(method)
  const holder = getDisplayName(method)
  const expiry = getExpiry(method)
  const lastFour = method.last_four || "••••"

  const brandStyles: Record<CardBrand, string> = {
    visa: "from-[#1a1f71] to-[#0d47a1]",
    mastercard: "from-[#eb001b] to-[#f79e1b]/80",
    amex: "from-[#006fcf] to-[#00175a]",
    rupay: "from-[#3f51b5] to-[#1a237e]",
    discover: "from-[#ff6000] to-[#d84315]",
    upi: "from-[#5f259f] to-[#3f1d6b]",
    other: "from-foreground/80 to-foreground",
  }

  const brandLabel: Record<CardBrand, string> = {
    visa: "VISA", mastercard: "Mastercard", amex: "AMEX",
    rupay: "RuPay", discover: "Discover", upi: "UPI", other: "CARD",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, rotateY: 2 }}
      transition={{ duration: 0.3 }}
      className={`relative w-full max-w-[320px] aspect-[1.6/1] rounded-2xl bg-gradient-to-br ${brandStyles[brand]} p-5 text-white shadow-lg select-none overflow-hidden group`}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 200 120">
          <circle cx="160" cy="90" r="80" fill="white" opacity="0.1" />
          <circle cx="180" cy="90" r="60" fill="white" opacity="0.05" />
        </svg>
      </div>

      {/* Top row: type + brand */}
      <div className="relative flex items-center justify-between mb-6">
        <span className="text-[10px] font-medium opacity-70 uppercase tracking-wider">
          {method.type === "credit_card" ? "Credit" : "Debit"}
        </span>
        <span className="text-sm font-bold tracking-wider">{brandLabel[brand]}</span>
      </div>

      {/* Card number */}
      <div className="relative mb-6">
        <p className="font-mono-pixel text-lg tracking-[0.2em] opacity-90">
          •••• •••• •••• {lastFour}
        </p>
      </div>

      {/* Bottom: holder + expiry */}
      <div className="relative flex items-end justify-between">
        <div>
          <p className="text-[9px] opacity-50 uppercase tracking-wider mb-0.5">Card Holder</p>
          <p className="text-xs font-medium truncate max-w-[140px]">{holder}</p>
        </div>
        {expiry && (
          <div className="text-right">
            <p className="text-[9px] opacity-50 uppercase tracking-wider mb-0.5">Expires</p>
            <p className="text-xs font-medium">{expiry}</p>
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="flex size-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
          <RiEditLine className="size-3 text-white" />
        </button>
        <button onClick={onDelete} className="flex size-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-red-500/60 transition-colors">
          <RiDeleteBinLine className="size-3 text-white" />
        </button>
      </div>
    </motion.div>
  )
}

/* ─── Non-card method row ─── */
function MethodRow({ method, onEdit, onDelete }: { method: PaymentMethod; onEdit: () => void; onDelete: () => void }) {
  const icons: Record<PaymentMethodType, React.ReactNode> = {
    paypal: <RiPaypalLine className="size-5 text-foreground" />,
    bank_account: <RiBankLine className="size-5 text-foreground" />,
    credit_card: <RiBankCardLine className="size-5 text-foreground" />,
    debit_card: <RiBankCardLine className="size-5 text-foreground" />,
    other: <RiWalletLine className="size-5 text-foreground" />,
  }
  const typeLabels: Record<PaymentMethodType, string> = {
    credit_card: "Credit Card", debit_card: "Debit Card",
    paypal: "PayPal", bank_account: "Bank Account", other: "Other",
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      whileHover={{ x: 2 }}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 group hover:shadow-sm transition-shadow"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted shrink-0">
        {icons[method.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{getDisplayName(method)}</p>
        <p className="text-[11px] text-muted-foreground">
          {typeLabels[method.type]}
          {method.last_four && ` · •••• ${method.last_four}`}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="flex size-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <RiEditLine className="size-3.5" />
        </button>
        <button onClick={onDelete} className="flex size-7 items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <RiDeleteBinLine className="size-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

/* ─── Add/Edit Form ─── */
const TYPE_OPTIONS: { value: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
  { value: "credit_card", label: "Credit Card", icon: <RiBankCardLine className="size-4" /> },
  { value: "debit_card", label: "Debit Card", icon: <RiBankCardLine className="size-4" /> },
  { value: "paypal", label: "PayPal", icon: <RiPaypalLine className="size-4" /> },
  { value: "bank_account", label: "Bank Account", icon: <RiBankLine className="size-4" /> },
  { value: "other", label: "Other / Wallet", icon: <RiWalletLine className="size-4" /> },
]

const BRANDS: { value: CardBrand; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "Amex" },
  { value: "rupay", label: "RuPay" },
  { value: "discover", label: "Discover" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
]

export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [type, setType] = useState<PaymentMethodType>("credit_card")
  const [brand, setBrand] = useState<CardBrand>("visa")
  const [holder, setHolder] = useState("")
  const [lastFour, setLastFour] = useState("")
  const [expiryMonth, setExpiryMonth] = useState("")
  const [expiryYear, setExpiryYear] = useState("")
  const [nickname, setNickname] = useState("")

  const isCardType = type === "credit_card" || type === "debit_card"

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
    setEditingId(null); setType("credit_card"); setBrand("visa")
    setHolder(""); setLastFour(""); setExpiryMonth(""); setExpiryYear(""); setNickname("")
  }

  function startEdit(m: PaymentMethod) {
    setEditingId(m.id)
    setType(m.type)
    setLastFour(m.last_four || "")
    const meta = parseCardMeta(m.name)
    if (meta) {
      setBrand(meta.brand || "other")
      setHolder(meta.holder || "")
      setNickname(meta.nickname || "")
      if (meta.expiry) {
        const [mm, yy] = meta.expiry.split("/")
        setExpiryMonth(mm || ""); setExpiryYear(yy || "")
      }
    } else {
      setHolder(m.name); setBrand("other")
    }
    setShowForm(true)
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const nameVal = isCardType
      ? JSON.stringify({ __card: true, brand, holder: holder.trim(), expiry: expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : "", nickname: nickname.trim() })
      : holder.trim() || nickname.trim() || type

    const payload = { user_id: user.id, type, name: nameVal, last_four: lastFour.slice(-4) || null }

    try {
      if (editingId) {
        const { error } = await supabase.from("payment_methods").update(payload).eq("id", editingId)
        if (error) throw error
        toast.success("Payment method updated")
      } else {
        const { error } = await supabase.from("payment_methods").insert(payload)
        if (error) throw error
        toast.success("Payment method added")
      }
      resetForm(); setShowForm(false); await load()
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); return }
    toast.success("Deleted")
    setMethods(methods.filter(m => m.id !== id))
  }

  const cardMethods = methods.filter(m => m.type === "credit_card" || m.type === "debit_card")
  const otherMethods = methods.filter(m => m.type !== "credit_card" && m.type !== "debit_card")

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 min-h-0 overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 shrink-0">
          <div className="relative overflow-hidden">
            <span className="ghost-text">PAY</span>
            <svg className="absolute -z-10 -top-2 -right-2 opacity-[0.03] text-foreground pointer-events-none" width="160" height="100" viewBox="0 0 220 140" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="10" y="10" width="200" height="120" rx="12" />
              <line x1="10" y1="50" x2="210" y2="50" />
              <rect x="25" y="90" width="60" height="10" rx="3" />
            </svg>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">Payment Methods</h1>
            <p className="font-display italic text-xs text-muted-foreground mt-1.5">
              {methods.length} method{methods.length !== 1 ? "s" : ""} saved · Used when linking subscriptions
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={() => { resetForm(); setShowForm(true) }}>
              <RiAddLine className="mr-1.5 size-4" /> Add Method
            </Button>
          </motion.div>
        </div>

        {/* Add/Edit Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-6 shrink-0"
            >
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Method" : "Add Payment Method"}</h3>
                  <button onClick={() => { setShowForm(false); resetForm() }} className="text-muted-foreground hover:text-foreground transition-colors">
                    <RiCloseLine className="size-5" />
                  </button>
                </div>

                {/* Type selector pills */}
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        type === opt.value
                          ? "bg-foreground text-background"
                          : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>

                {/* Card-specific fields */}
                {isCardType && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Card Brand</label>
                      <select
                        value={brand}
                        onChange={e => setBrand(e.target.value as CardBrand)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        {BRANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Last 4 Digits</label>
                      <input
                        value={lastFour}
                        onChange={e => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="1234"
                        maxLength={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Cardholder Name</label>
                      <input
                        value={holder}
                        onChange={e => setHolder(e.target.value)}
                        placeholder="John Doe"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Month</label>
                        <select value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                          <option value="">MM</option>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Year</label>
                        <select value={expiryYear} onChange={e => setExpiryYear(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                          <option value="">YY</option>
                          {Array.from({ length: 10 }, (_, i) => String(26 + i)).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-card fields */}
                {!isCardType && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                        {type === "paypal" ? "PayPal Email" : type === "bank_account" ? "Account Name" : "Name / Label"}
                      </label>
                      <input
                        value={holder}
                        onChange={e => setHolder(e.target.value)}
                        placeholder={type === "paypal" ? "user@email.com" : type === "bank_account" ? "HDFC Savings ****1234" : "My Wallet"}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Last 4 (optional)</label>
                      <input
                        value={lastFour}
                        onChange={e => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="1234"
                        maxLength={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                )}

                {/* Nickname */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Nickname (optional)</label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="e.g. Personal Visa, Work Card"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                {/* Save */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving || (!holder.trim() && !nickname.trim())}>
                    {saving ? <RiLoader4Line className="mr-1.5 size-4 animate-spin" /> : null}
                    {editingId ? "Update" : "Save Method"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : methods.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-dashed border-border mb-4">
                <RiBankCardLine className="size-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No payment methods</p>
              <p className="text-xs text-muted-foreground mt-1">Add a card, bank account, or wallet to link with subscriptions.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards section */}
            {cardMethods.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-3">Cards</p>
                <div className="flex flex-wrap gap-4">
                  {cardMethods.map(m => (
                    <CreditCardVisual
                      key={m.id}
                      method={m}
                      onEdit={() => startEdit(m)}
                      onDelete={() => handleDelete(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other methods */}
            {otherMethods.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-3">
                  {cardMethods.length > 0 ? "Other Methods" : "Payment Methods"}
                </p>
                <div className="space-y-2">
                  {otherMethods.map(m => (
                    <MethodRow
                      key={m.id}
                      method={m}
                      onEdit={() => startEdit(m)}
                      onDelete={() => handleDelete(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
