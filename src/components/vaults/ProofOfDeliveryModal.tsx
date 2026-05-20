import { useState } from "react"
import { RiCloseLine, RiSendPlaneLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/Button"

interface Props {
  open: boolean
  defaultProof?: string
  onClose: () => void
  onConfirm: (proof: string) => Promise<void>
}

/**
 * Asks the agent / user for a free-form proof-of-delivery note (URL, hash,
 * description) before releasing the funds. The note will be permanently
 * attached to the release transaction.
 */
export function ProofOfDeliveryModal({ open, defaultProof, onClose, onConfirm }: Props) {
  const [proof, setProof] = useState(defaultProof ?? "")
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    if (!proof.trim()) return
    setBusy(true)
    try { await onConfirm(proof.trim()) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Release with proof of delivery
          </h2>
          <button
            onClick={onClose} aria-label="Close" title="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <RiCloseLine className="size-5" />
          </button>
        </header>

        <div className="space-y-3 p-5">
          <p className="text-xs text-muted-foreground">
            Attach a short receipt, an invoice URL, content hash, or one-line
            description of what was delivered. This is written into the release
            transaction's note and is permanently visible on-chain.
          </p>
          <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Proof
          </label>
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            rows={4}
            maxLength={900}
            placeholder={"e.g. https://invoices.acme.com/inv_2026-04-22.pdf  or  sha256:9f86d…"}
            className="w-full rounded border border-input bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="text-right text-[10px] text-muted-foreground">{proof.length} / 900</div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!proof.trim() || busy}>
            {busy ? (
              <><RiLoader4Line className="mr-2 size-4 animate-spin" /> Releasing…</>
            ) : (
              <><RiSendPlaneLine className="mr-2 size-4" /> Release & sign</>
            )}
          </Button>
        </footer>
      </div>
    </div>
  )
}
