import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { RiArrowLeftLine } from "@remixicon/react"

export default function NewSubscription() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", amount: "", currency: "USD", billing_cycle: "monthly",
    next_billing_date: "", start_date: new Date().toISOString().split("T")[0],
    status: "active", category: "", url: "", notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from("subscriptions").insert([{
      ...form,
      amount: parseFloat(form.amount),
      billing_cycle: form.billing_cycle as "monthly" | "quarterly" | "weekly" | "yearly",
      status: form.status as "active" | "cancelled" | "trial" | "paused",
      user_id: user.id,
    }])
    setSaving(false)
    if (!error) navigate("/subscriptions")
  }

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <Link to="/subscriptions" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
          <RiArrowLeftLine className="size-4" /> Back to subscriptions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Subscription</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="e.g. Netflix" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => update("amount", e.target.value)} required placeholder="14.99" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Billing Cycle</label>
              <Select value={form.billing_cycle} onValueChange={(v) => update("billing_cycle", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Next Billing Date *</label>
              <Input type="date" value={form.next_billing_date} onChange={(e) => update("next_billing_date", e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="e.g. Entertainment" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" isLoading={saving}>Save Subscription</Button>
        </form>
      </div>
    </div>
  )
}
