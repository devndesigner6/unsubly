import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { Switch } from "@/components/ui/switch"
import { getCurrencyList } from "@/lib/currency"

export default function Settings() {
  const { user, profile } = useAuth()
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setCurrency(profile.currency || "USD")
      setEmailAlerts(profile.email_alerts ?? true)
    }
  }, [profile])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from("profiles").update({ name, currency, email_alerts: emailAlerts }).eq("id", user.id)
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <div className="mt-6 space-y-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {getCurrencyList().map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Alerts</label>
          <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
        </div>
        <Button onClick={handleSave} isLoading={saving} className="w-full">Save Settings</Button>
      </div>
      <p className="mt-4 text-center text-sm text-gray-500">{user?.email}</p>
    </div>
  )
}
