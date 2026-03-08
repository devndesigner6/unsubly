import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/Button"
import {
  RiAddLine, RiBankCardLine, RiDeleteBinLine, RiEditLine,
  RiLoader4Line, RiCloseLine, RiCheckLine, RiPaypalLine,
  RiBankLine,
} from "@remixicon/react"
import type { Database } from "@/integrations/supabase/types"

type PaymentMethodType = Database["public"]["Enums"]["payment_method_type"]

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

function TypeIcon({ type }: { type: PaymentMethodType }) {
  switch (type) {
    case "paypal": return <RiPaypalLine className="size-5 text-muted-foreground" />
    case "bank_account": return <RiBankLine className="size-5 text-muted-foreground" />
    default: return <RiBankCardLine className="size-5 text-muted-foreground" />
  }
}

export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [type, setType] = useState<PaymentMethodType>("credit_card")
  const [lastFour, setLastFour] = useState("")
  const [saving, setSaving] = useState(false)

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

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    const payload = { name: name.trim(), type, last_four: lastFour || null }
    if (editingId) {
      await supabase.from("payment_methods").update(payload).eq("id", editingId)
    } else {
      await supabase.from("payment_methods").insert({ ...payload, user_id: user.id })
    }
    resetForm(); setSaving(false); load()
  }

  async function handleDelete(id: string) {
    await supabase.from("payment_methods").delete().eq("id", id)
    load()
  }

  function startEdit(m: PaymentMethod) {
    setEditingId(m.id); setName(m.name); setType(m.type); setLastFour(m.last_four || ""); setShowForm(true)
  }

  function resetForm() {
    setName(""); setType("credit_card"); setLastFour(""); setShowForm(false); setEditingId(null)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RiLoader4Line className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your payment methods for subscriptions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <RiAddLine className="mr-1.5 size-4" /> Add Method
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Payment Method" : "New Payment Method"}</h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <RiCloseLine className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Visa ending 4242)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PaymentMethodType)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                value={lastFour}
                onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Last 4 digits"
                maxLength={4}
                className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <RiCheckLine className="mr-1.5 size-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {methods.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <RiBankCardLine className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No payment methods yet. Add one to track how you pay.</p>
          </div>
        ) : (
          methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <TypeIcon type={m.type} />
                <div>
                  <span className="font-medium text-foreground">{m.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{TYPE_OPTIONS.find((o) => o.value === m.type)?.label}</span>
                    {m.last_four && <span>•••• {m.last_four}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(m)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <RiEditLine className="size-4" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <RiDeleteBinLine className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
