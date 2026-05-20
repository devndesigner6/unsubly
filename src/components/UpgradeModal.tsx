import { motion, AnimatePresence } from "motion/react"
import { RiCloseLine, RiVipCrownLine, RiCheckLine } from "@remixicon/react"
import { usePlan } from "@/hooks/usePlan"

const PRO_FEATURES = [
  "Unlimited subscriptions",
  "Telegram bot (cancel/keep/done)",
  "Escrow vaults (all 8 types)",
  "Autonomous agent (auto-release)",
  "AI Chat (spending analysis)",
  "Browser automation cancel",
  "On-chain cancellation proofs",
  "MCP agent access",
]

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  trigger?: string // what feature triggered the modal
}

export function UpgradeModal({ isOpen, onClose, trigger }: UpgradeModalProps) {
  const { openCheckout, subCount } = usePlan()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RiVipCrownLine className="size-5 text-gold" />
                <h2 className="text-lg font-display font-semibold text-foreground">Upgrade to Pro</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                <RiCloseLine className="size-5 text-muted-foreground" />
              </button>
            </div>

            {/* Message */}
            <p className="text-sm text-muted-foreground mb-4">
              {trigger
                ? `"${trigger}" requires Pro access.`
                : `You've used ${subCount} of 10 free subscriptions.`
              }
              {" "}Upgrade once, use forever.
            </p>

            {/* Price */}
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-pixel text-3xl font-bold text-foreground">₹349</span>
                <span className="text-sm text-muted-foreground">one-time, lifetime access</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground italic">
                We hate subscriptions. So we won't make you subscribe to us.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2 mb-5">
              {PRO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <RiCheckLine className="size-4 text-gold shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => { openCheckout(); onClose() }}
              className="w-full rounded-full bg-foreground text-background py-3 text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Get Lifetime Access - ₹349
            </button>

            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Powered by Dodo Payments. Secure checkout. No recurring charges.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
