import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { RiBankCardLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react"

interface PM { id: string; name: string; type: string; last_four: string | null }

export default function PaymentMethods() {
  const { user } = useAuth()
  const [methods, setMethods] = useState<PM[]>([])
  const [name, setName] = useState("")
  const [type, setType] = useState("credit_card")
  const [lastFour, setLastFour] = useState("")

  useEffect(() => {
    if (!user) return
    supabase.from("payment_methods").select("*").order("name").then(({ data }) => setMethods((data as PM[]) || []))
  }, [user])

  const add = async () => {
    if (!name.trim() || !user) return
    const { data } = await supabase.from("payment_methods").insert({
      name, type, last_four: lastFour || null, user_id: user.id
    }).select().single()
    if (data) { setMethods((m) => [...m, data as PM]); setName(""); setLastFour("") }
  }

  const remove = async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id)
    setMethods((m) => m.filter((x) => x.id !== id))
  }

  const typeLabels: Record<string, string> = {
    credit_card: "Credit Card", debit_card: "Debit Card", paypal: "PayPal", bank_account: "Bank Account", other: "Other"
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Methods</h1>
      <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Card name" />
        <div className="flex gap-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="debit_card">Debit Card</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="bank_account">Bank Account</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input value={lastFour} onChange={(e) => setLastFour(e.target.value.slice(0, 4))} placeholder="Last 4" className="w-24" />
          <Button onClick={add}><RiAddLine className="size-4" /></Button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {methods.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <RiBankCardLine className="size-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                <p className="text-xs text-gray-500">{typeLabels[m.type]}{m.last_four && ` •••• ${m.last_four}`}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove(m.id)}><RiDeleteBinLine className="size-4 text-red-500" /></Button>
          </div>
        ))}
        {methods.length === 0 && <p className="py-8 text-center text-gray-500">No payment methods yet</p>}
      </div>
    </div>
  )
}
