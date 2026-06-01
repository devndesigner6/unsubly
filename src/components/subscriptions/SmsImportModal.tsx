import { useState, useRef } from "react"
import { RiCloseLine, RiSmartphoneLine, RiCheckboxCircleLine, RiAddLine, RiLoader4Line } from "@remixicon/react"
import { toast } from "sonner"
import { Button } from "@/components/Button"
import { splitSmsMessages, detectSubscriptionsFromSms, type DetectedSmsSubscription } from "@/lib/sms-detect"
import { createSubscription } from "@/lib/supabase-queries"
import { useAuth } from "@/lib/auth-context"

interface Props {
  open: boolean
  onClose: () => void
  onImported?: () => void
}

export function SmsImportModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth()
  const [text, setText] = useState("")
  const [detected, setDetected] = useState<DetectedSmsSubscription[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [scanned, setScanned] = useState(false)

  if (!open) return null

  const handleScan = () => {
    if (text.trim().length < 30) {
      toast.error("Paste at least a few SMS messages to scan")
      return
    }

    const messages = splitSmsMessages(text)
    const subs = detectSubscriptionsFromSms(messages)

    if (subs.length === 0) {
      toast.error("No recurring subscriptions detected. Try pasting more SMS messages (at least 2-3 months).")
      setDetected([])
      setScanned(true)
      return
    }

    setDetected(subs)
    setSelected(new Set(subs.map((_, i) => i)))
    setScanned(true)
    toast.success(`Found ${subs.length} subscription${subs.length > 1 ? "s" : ""}!`)
  }

  const handleImport = async () => {
    if (!user) return
    if (selected.size === 0) return toast.error("Select at least one subscription")
    setImporting(true)
    let ok = 0, fail = 0

    for (const idx of selected) {
      const d = detected[idx]
      try {
        // Calculate next billing date (last date + cycle)
        const lastDate = new Date(d.lastDate)
        const nextDate = new Date(lastDate)
        if (d.billingCycle === "monthly") nextDate.setMonth(nextDate.getMonth() + 1)
        else if (d.billingCycle === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3)
        else nextDate.setFullYear(nextDate.getFullYear() + 1)

        await createSubscription({
          user_id: user.id,
          name: d.name,
          amount: d.amount,
          currency: d.currency,
          billing_cycle: d.billingCycle,
          next_billing_date: nextDate.toISOString().split("T")[0],
          start_date: d.lastDate,
          status: "active",
          notes: `Auto-detected from SMS (${d.occurrences} charges found)`,
          alert_days_before: 3,
          alert_enabled: true,
        })
        ok++
      } catch (err) {
        fail++
        console.warn(`[sms-import] Failed to import ${d.name}:`, err)
      }
    }

    setImporting(false)
    if (ok > 0) {
      toast.success(`Imported ${ok} subscription${ok > 1 ? "s" : ""}${fail > 0 ? ` (${fail} failed)` : ""}`)
      onImported?.()
      onClose()
    } else {
      toast.error("Import failed. Please try again.")
    }
  }

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RiSmartphoneLine className="size-5 text-foreground" />
            <h2 className="text-base font-medium text-foreground">Import from SMS</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <RiCloseLine className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {!scanned ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Paste your bank SMS messages below. We'll detect recurring subscription charges automatically.
              </p>
              <p className="text-xs text-muted-foreground/70 mb-4">
                Works with HDFC, SBI, ICICI, Axis, Kotak, and 10+ Indian banks. Paste 2-3 months of messages for best results.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Paste your bank SMS here...\n\nExample:\nYour A/c XX1234 debited for Rs.199.00 on 24-May-26. Info: UPI/SPOTIFY\n\nINR 649.00 spent on HDFC CC X5678 at NETFLIX on 24-May\n\nRs 499 debited from A/c **9012 on 24-05-26 to AMAZONPRIME`}
                className="w-full h-48 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
              <p className="mt-2 text-[10px] text-muted-foreground/50">
                Your SMS data is processed locally in your browser. Nothing is sent to any server.
              </p>
            </>
          ) : detected.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Found <span className="font-medium text-foreground">{detected.length}</span> recurring subscription{detected.length > 1 ? "s" : ""}. Select which to import:
              </p>
              <div className="space-y-2">
                {detected.map((sub, idx) => (
                  <div
                    key={`${sub.name}-${idx}`}
                    onClick={() => toggleSelect(idx)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(idx)
                        ? "border-foreground/20 bg-foreground/[0.03]"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-5 rounded-md border flex items-center justify-center ${
                        selected.has(idx) ? "border-foreground bg-foreground" : "border-border"
                      }`}>
                        {selected.has(idx) && <RiCheckboxCircleLine className="size-3.5 text-background" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{sub.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.occurrences} charges · {sub.billingCycle} · last: {sub.lastDate}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium text-foreground">₹{sub.amount.toFixed(0)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(sub.confidence * 100)}% match
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No recurring subscriptions detected.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try pasting more SMS messages (2-3 months worth).</p>
              <Button variant="secondary" className="mt-4" onClick={() => { setScanned(false); setDetected([]) }}>
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          {!scanned ? (
            <Button onClick={handleScan} disabled={text.trim().length < 30}>
              <RiSmartphoneLine className="mr-2 size-4" />
              Scan SMS
            </Button>
          ) : detected.length > 0 ? (
            <>
              <Button variant="secondary" onClick={() => { setScanned(false); setDetected([]) }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                {importing ? <RiLoader4Line className="mr-2 size-4 animate-spin" /> : <RiAddLine className="mr-2 size-4" />}
                Import {selected.size} subscription{selected.size !== 1 ? "s" : ""}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
