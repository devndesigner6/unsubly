/**
 * GmailImportModal
 *
 * Calls /api/gmail-scan, shows detected subscriptions as checkboxes,
 * and inserts confirmed ones into the subscriptions table with source='gmail'.
 */

import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/Button"
import { toast } from "sonner"
import {
  RiMailLine, RiLoader4Line, RiCheckboxLine, RiCheckboxBlankLine,
  RiCloseLine, RiAlertLine,
} from "@remixicon/react"

interface DetectedSubscription {
  name: string
  amount: number | null
  currency: string
  billing_cycle: string
  source: string
  detected_from_email: boolean
  domain?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function GmailImportModal({ open, onClose, onImported }: Props) {
  const { user, session } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [detected, setDetected] = useState<DetectedSubscription[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  if (!open) return null

  async function handleScan() {
    if (!session?.access_token) return
    setScanning(true)
    setError(null)
    setDetected([])
    setSelected(new Set())
    setScanned(false)

    try {
      const res = await fetch("/api/gmail-scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      // Guard against empty / non-JSON responses (e.g. Vercel 404 HTML page)
      const contentType = res.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        setError(`Server error (${res.status}): Gmail scan endpoint not available. Check deployment.`)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Gmail scan failed")
        return
      }
      setDetected(data.subscriptions || [])
      // Pre-select all by default
      setSelected(new Set((data.subscriptions || []).map((_: any, i: number) => i)))
      setScanned(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gmail scan failed")
    } finally {
      setScanning(false)
    }
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === detected.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(detected.map((_, i) => i)))
    }
  }

  async function handleImport() {
    if (!user || selected.size === 0) return
    setImporting(true)

    const toImport = detected.filter((_, i) => selected.has(i))
    let successCount = 0

    for (const sub of toImport) {
      try {
        // Default next billing date to 1 month from now
        const nextBillingDate = new Date()
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

        const { error } = await supabase.from("subscriptions").insert({
          user_id: user.id,
          name: sub.name,
          amount: sub.amount || 0,
          currency: sub.currency || "USD",
          billing_cycle: sub.billing_cycle || "monthly",
          next_billing_date: nextBillingDate.toISOString().split("T")[0],
          status: "active",
          source: "gmail",
          alert_days: 3,
          alert_enabled: true,
        })
        if (!error) successCount++
      } catch (err) {
        console.warn("[gmail-import] Failed to insert:", sub.name, err)
      }
    }

    setImporting(false)
    if (successCount > 0) {
      toast.success(`Imported ${successCount} subscription${successCount !== 1 ? "s" : ""} from Gmail`)
      onImported()
      onClose()
    } else {
      setError("Failed to import subscriptions. Please try again.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-white/5">
              <RiMailLine className="size-5 text-blue-600 dark:text-white/70" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Import from Gmail</h2>
              <p className="text-xs text-muted-foreground">Scan your inbox for subscription receipts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <RiAlertLine className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!scanned ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-6">
                We'll scan your Gmail for subscription receipts, invoices, and billing confirmations
                from the last 6 months. No emails are stored — only service names and amounts are extracted.
              </p>
              <Button
                onClick={handleScan}
                disabled={scanning}
                className="gap-2"
              >
                {scanning ? (
                  <><RiLoader4Line className="size-4 animate-spin" /> Scanning Gmail…</>
                ) : (
                  <><RiMailLine className="size-4" /> Scan Gmail</>
                )}
              </Button>
            </div>
          ) : detected.length === 0 ? (
            <div className="text-center py-6">
              <RiMailLine className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No subscriptions found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We couldn't detect any subscription receipts in your recent emails.
              </p>
              <Button variant="secondary" onClick={handleScan} className="mt-4 gap-2" disabled={scanning}>
                {scanning ? <RiLoader4Line className="size-4 animate-spin" /> : null}
                Scan again
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {detected.length} subscription{detected.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {selected.size === detected.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {detected.map((sub, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleSelect(idx)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected.has(idx)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    {selected.has(idx) ? (
                      <RiCheckboxLine className="size-5 shrink-0 text-primary" />
                    ) : (
                      <RiCheckboxBlankLine className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.amount
                          ? `${sub.currency} ${sub.amount.toFixed(2)} / ${sub.billing_cycle}`
                          : `${sub.billing_cycle} · amount not detected`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-white/5 dark:text-white/70">
                      Gmail
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {scanned && detected.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {selected.size} of {detected.length} selected
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={importing}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="gap-2"
              >
                {importing ? (
                  <><RiLoader4Line className="size-4 animate-spin" /> Importing…</>
                ) : (
                  `Import ${selected.size} subscription${selected.size !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
