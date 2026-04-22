import { useState } from "react"
import { findCancelFlow, type CancelFlow } from "@/data/cancelFlows"
import { cancelSubscriptionOnChain } from "@/lib/algorand/cancel"
import { useAlgorand } from "@/lib/algorand/context"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  RiCloseLine, RiExternalLinkLine, RiCheckLine,
  RiInformationLine, RiLoader4Line, RiSearchLine,
} from "@remixicon/react"

interface Subscription {
  id: string
  name: string
  url?: string | null
}

interface CancelHelperModalProps {
  subscription: Subscription
  onClose: () => void
  onCancelled?: () => void
}

export default function CancelHelperModal({ subscription, onClose, onCancelled }: CancelHelperModalProps) {
  const { user } = useAuth()
  const { walletAddress, algodClient, peraWallet } = useAlgorand()
  const flow: CancelFlow | null = findCancelFlow(subscription.name)
  const [opened, setOpened] = useState(false)
  const [running, setRunning] = useState(false)

  const fallbackUrl = subscription.url || (flow?.cancelUrl)

  function openCancelPage() {
    if (!fallbackUrl) {
      toast.error("No cancel URL available, search the merchant's website for \"cancel subscription\".")
      return
    }
    window.open(fallbackUrl, "_blank", "noopener,noreferrer")
    setOpened(true)
  }

  async function markCancelled() {
    if (!user) return
    setRunning(true)
    try {
      const signTransaction = async (txn: any): Promise<Uint8Array[]> => {
        return await peraWallet.signTransaction([[{ txn }]])
      }
      const result = await cancelSubscriptionOnChain({
        subscriptionId: subscription.id,
        userId: user.id,
        walletAddress,
        algodClient,
        signTransaction,
      })
      if (result.ok) {
        const parts = ["Subscription marked cancelled"]
        if (result.vaultsKilled > 0) parts.push(`${result.vaultsKilled} vault${result.vaultsKilled > 1 ? "s" : ""} refunded on-chain`)
        toast.success(parts.join(" · "))
        if (result.errors.length) {
          toast.warning(result.errors.join(" "))
        }
        onCancelled?.()
        onClose()
      } else {
        toast.error(result.errors.join(" ") || "Cancellation failed")
      }
    } catch (err: any) {
      toast.error(err?.message || "Cancellation failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-helper-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 id="cancel-helper-title" className="text-lg font-bold text-foreground truncate">
              Cancel {subscription.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {flow ? "We know this one, guided steps below." : "Generic cancel, we'll open the merchant site."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {flow ? (
            <>
              <ol className="space-y-2.5">
                {flow.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
              {flow.note && (
                <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <RiInformationLine className="size-4 shrink-0 text-foreground/70" />
                  <span>{flow.note}</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              <RiSearchLine className="mx-auto mb-2 size-6 text-muted-foreground/60" />
              <p>
                We don't have a guided flow for <span className="font-medium text-foreground">{subscription.name}</span> yet.
              </p>
              <p className="mt-1 text-xs">
                {fallbackUrl
                  ? "We'll open the merchant site so you can cancel there."
                  : "Search the merchant's website for \"cancel subscription\"."}
              </p>
            </div>
          )}

          {/* Step 1: open the cancel page */}
          {!opened && fallbackUrl && (
            <button
              onClick={openCancelPage}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90"
            >
              Open cancel page <RiExternalLinkLine className="size-4" />
            </button>
          )}

          {/* Step 2: confirm + on-chain refund */}
          {(opened || !fallbackUrl) && (
            <div className="space-y-2">
              <div className="rounded-lg bg-muted/60 p-3 text-xs text-foreground/80">
                Once you've completed the cancellation on the merchant site, click below.
                We'll mark this subscription as cancelled and{" "}
                <span className="font-semibold text-foreground">refund any locked vault on-chain</span>.
              </div>
              <button
                onClick={markCancelled}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {running ? (
                  <><RiLoader4Line className="size-4 animate-spin" /> Cancelling…</>
                ) : (
                  <><RiCheckLine className="size-4" /> I've cancelled, finalise</>
                )}
              </button>
              {fallbackUrl && (
                <button
                  onClick={openCancelPage}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Reopen cancel page
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
