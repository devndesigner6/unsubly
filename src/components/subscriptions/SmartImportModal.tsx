import { useState, useRef, useCallback } from "react"
import { RiCloseLine, RiMailLine, RiFileTextLine, RiCheckboxCircleLine, RiAddLine, RiLoader4Line } from "@remixicon/react"
import { toast } from "sonner"
import { Button } from "@/components/Button"
import { detectFromEmail, detectFromBankCsv, type DetectedSubscription } from "@/lib/import-detect"
import { createSubscription } from "@/lib/supabase-queries"
import { useAuth } from "@/lib/auth-context"

interface Props {
  open: boolean
  onClose: () => void
  onImported?: () => void
}

type Mode = "email" | "csv"

export function SmartImportModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>("email")
  const [text, setText] = useState("")
  const [detected, setDetected] = useState<DetectedSubscription[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!open) return null

  const runDetect = (source: string, m: Mode) => {
    if (m === "email") {
      const one = detectFromEmail(source)
      if (!one) {
        setDetected([])
        return
      }
      setDetected([one])
      setSelected(new Set([0]))
    } else {
      const many = detectFromBankCsv(source)
      if (many.length === 0) {
        setDetected([])
        return
      }
      setDetected(many)
      setSelected(new Set(many.map((_, i) => i)))
    }
  }

  const handleEmailChange = (value: string) => {
    setText(value)
    // Debounce live detection by 400ms
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length > 20) {
      debounceRef.current = setTimeout(() => runDetect(value, "email"), 400)
    } else {
      setDetected([])
    }
  }

  const handleDetect = () => {
    if (mode === "email") {
      runDetect(text, "email")
      if (!detectFromEmail(text)) toast.error("Couldn't detect a subscription. Try pasting the receipt or welcome email.")
    } else {
      runDetect(text, "csv")
      if (detectFromBankCsv(text).length === 0) toast.error("No recurring charges found. Need at least 2 same-amount charges from the same merchant.")
    }
  }

  const handleFileUpload = async (file: File) => {
    const t = await file.text()
    setText(t)
    setMode("csv")
    runDetect(t, "csv")
  }

  const handleImport = async () => {
    if (!user) return
    if (selected.size === 0) return toast.error("Select at least one subscription")
    setImporting(true)
    let ok = 0, fail = 0
    for (const idx of selected) {
      const d = detected[idx]
      try {
        await createSubscription({
          user_id: user.id,
          name: d.name,
          amount: d.amount,
          currency: d.currency,
          billing_cycle: d.billingCycle,
          next_billing_date: d.nextBillingDate,
          start_date: d.startDate,
          status: d.status,
          notes: d.notes ?? null,
          alert_days_before: 3,
          alert_enabled: true,
        })
        ok++
      } catch {
        fail++
      }
    }
    setImporting(false)
    if (ok > 0) toast.success(`Imported ${ok} subscription${ok === 1 ? "" : "s"}`)
    if (fail > 0) toast.error(`${fail} failed to import`)
    if (ok > 0) {
      onImported?.()
      onClose()
      setText(""); setDetected([]); setSelected(new Set())
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-white/5">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
            Smart Import
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <RiCloseLine className="size-5" />
          </button>
        </header>

        <div className="flex border-b border-gray-200 dark:border-white/10">
          {([
            { k: "email" as Mode, label: "Paste email", icon: RiMailLine },
            { k: "csv" as Mode, label: "Bank statement (CSV)", icon: RiFileTextLine },
          ]).map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => { setMode(k); setDetected([]); setText("") }}
              className={[
                "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm",
                mode === k
                  ? "border-b-2 border-gray-900 font-medium text-gray-900 dark:border-white dark:text-white/90"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white",
              ].join(" ")}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: "calc(90vh - 200px)" }}>
          {mode === "email" ? (
            <>
              <p className="text-xs text-gray-500">
                Paste a welcome email, receipt, or renewal notice. We'll detect the merchant,
                amount, and billing cycle automatically as you type.
              </p>
              <textarea
                value={text}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder={'e.g. "Welcome to Netflix Premium. Your subscription is $19.99/month. Next charge: 2026-05-15."'}
                rows={8}
                className="w-full rounded border border-gray-300 bg-white p-3 text-sm focus:border-gray-900 focus:outline-none dark:border-white/15 dark:bg-black dark:focus:border-white/80"
              />
              {/* Live detection preview */}
              {detected.length > 0 && text.trim().length > 20 && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs dark:border-green-800/40 dark:bg-green-900/20">
                  <span className="font-medium text-green-800 dark:text-green-300">Detected: </span>
                  <span className="text-green-700 dark:text-green-400">
                    {detected[0].name} · {detected[0].currency} {detected[0].amount.toFixed(2)}/{detected[0].billingCycle}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Upload or paste a bank/credit-card CSV with date, description and amount columns.
                We'll find merchants charged on a recurring schedule.
              </p>
              <div className="flex items-center gap-2">
                <label
                  className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:border-gray-900 dark:border-white/15 dark:hover:border-white/80"
                  title="Pick a CSV file"
                >
                  <input
                    type="file" accept=".csv,text/csv" hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) void handleFileUpload(f)
                    }}
                  />
                  Pick file
                </label>
                <span className="text-xs text-gray-500">or paste below:</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Date,Description,Amount\n2026-01-15,NETFLIX PREMIUM,-19.99\n2026-02-15,NETFLIX PREMIUM,-19.99"}
                rows={6}
                className="w-full rounded border border-gray-300 bg-white p-3 font-mono text-xs focus:border-gray-900 focus:outline-none dark:border-white/15 dark:bg-black dark:focus:border-white/80"
              />
            </>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleDetect} disabled={!text.trim()}>
              Detect
            </Button>
          </div>

          {detected.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                {detected.length} detected · {selected.size} selected
              </div>
              <ul className="divide-y divide-gray-200 overflow-hidden rounded border border-gray-200 dark:divide-gray-800 dark:border-white/10">
                {detected.map((d, i) => {
                  const isOn = selected.has(i)
                  return (
                    <li key={i} className="flex items-start gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => {
                          const n = new Set(selected)
                          if (isOn) n.delete(i); else n.add(i)
                          setSelected(n)
                        }}
                        className="mt-1 size-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-gray-900 dark:text-white/90">{d.name}</span>
                          {d.status === "trial" && (
                            <span className="rounded border border-amber-300 px-1 text-[10px] uppercase text-amber-700 dark:border-amber-900/50 dark:text-amber-300">
                              trial
                            </span>
                          )}
                          <span className="ml-auto text-xs text-gray-500">
                            {Math.round(d.confidence * 100)}% match
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {d.currency} {d.amount.toFixed(2)} · {d.billingCycle} · next {d.nextBillingDate}
                        </div>
                        {d.notes && <div className="mt-0.5 text-xs italic text-gray-400">{d.notes}</div>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-white/10">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
          >
            {importing ? (
              <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Importing…</>
            ) : (
              <><RiAddLine className="mr-2 size-4" /> Import {selected.size > 0 ? `(${selected.size})` : ""}</>
            )}
          </Button>
        </footer>
      </div>
    </div>
  )
}
