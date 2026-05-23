import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { motion, AnimatePresence } from "motion/react"

interface SocialProof {
  vaults: number
  algoLocked: number
  payments: number
}

function ProCard() {
  const [hovered, setHovered] = useState(false)
  const [shaken, setShaken] = useState(false)

  const handleMouseEnter = () => {
    setHovered(true)
    if (!shaken) {
      setShaken(true)
    }
  }

  return (
    <motion.div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      animate={shaken && hovered ? { x: [0, -3, 3, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="rounded-xl border border-gold/30 bg-gold/5 p-4 cursor-default"
    >
      <p className="font-medium text-foreground mb-2">Pro <span className="text-gold">₹349</span></p>
      <ul className="space-y-1.5 text-muted-foreground">
        <li>Unlimited subs</li>
        <li>Telegram bot</li>
        <li>Escrow vaults</li>
        <li>AI agent + MCP</li>
      </ul>
      <p className="mt-2 text-[10px] italic text-muted-foreground/70">
        We hate subscriptions. So we won't make you subscribe to us.
      </p>
      <AnimatePresence>
        {hovered && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 text-[9px] text-gold/70"
          >
            Still ₹349. We're not Spotify.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function CTA() {
  const [proof, setProof] = useState<SocialProof | null>(null)

  useEffect(() => {
    const fetchProof = async () => {
      try {
        const [vaultsRes, paymentsRes] = await Promise.all([
          supabase.from("escrow_vaults" as any).select("amount, status"),
          supabase.from("onchain_payments" as any).select("id", { count: "exact", head: true }),
        ])

        const vaultRows = (vaultsRes.data as any[]) ?? []
        const totalVaults = vaultRows.length
        const algoLocked = vaultRows
          .filter((v: any) => v.status === "locked")
          .reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0)
        const totalPayments = paymentsRes.count ?? 0

        setProof({
          vaults: totalVaults,
          algoLocked: Math.round(algoLocked * 100) / 100,
          payments: totalPayments,
        })
      } catch {
        // Silently fail — social proof is optional
      }
    }
    fetchProof()
  }, [])

  return (
    <section id="pricing" className="py-16 sm:py-20 lg:py-24 border-t border-border overflow-hidden">
      <div className="mx-auto max-w-5xl px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
        >

          {/* Social proof numbers — only show if meaningful */}
          {proof && (proof.vaults > 0 || proof.payments > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-6 mb-10 text-sm text-muted-foreground">
              {proof.vaults > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{proof.vaults}</span> vaults created
                </span>
              )}
              {proof.vaults > 0 && proof.algoLocked > 0 && <span className="size-1 rounded-full bg-border" />}
              {proof.algoLocked > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{proof.algoLocked.toFixed(2)}</span> ALGO locked
                </span>
              )}
              {proof.payments > 0 && <span className="size-1 rounded-full bg-border" />}
              {proof.payments > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{proof.payments}</span> payments released
                </span>
              )}
            </div>
          )}

          <h2 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-foreground tracking-tight leading-[0.9]">
            TAKE
            <br />
            <span className="text-muted-foreground/70">CONTROL.</span>
          </h2>
          <p className="mt-8 text-base sm:text-lg text-foreground/70 max-w-xl mx-auto leading-relaxed">
            Start tracking subscriptions, locking payments in escrow,
            and building your on-chain financial identity. 100% free.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="relative group w-full sm:w-auto">
              {/* Shimmer border loop */}
              <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/40 to-transparent bg-[length:200%_auto] animate-[shimmer_3s_ease-in-out_infinite]" />
              <Button asChild className="relative rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-sm font-medium gap-2 group/btn w-full sm:w-auto">
                <Link to="/register">
                  <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                    <RiArrowRightLine className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                  </div>
                  Get Started Free
                </Link>
              </Button>
            </div>
            <Button variant="ghost" asChild className="rounded-full px-8 py-6 text-sm text-muted-foreground hover:text-foreground w-full sm:w-auto">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {["No credit card", "Free forever (10 subs)", "₹349 lifetime Pro"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-foreground/30" />
                {item}
              </span>
            ))}
          </div>

          {/* Free vs Pro comparison */}
          <div className="mt-8 mx-auto max-w-md grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium text-foreground mb-2">Free</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>10 subscriptions</li>
                <li>Calendar + Analytics</li>
                <li>Gmail import</li>
                <li>CSV import/export</li>
              </ul>
            </div>
            <ProCard />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
