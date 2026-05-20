import { Button } from "@/components/Button"
import { RiArrowRightLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { motion } from "motion/react"

const steps = [
  {
    number: "01",
    title: "Connect Wallet",
    description: "Link your Pera Wallet to Unsubscribely. Your keys, your control, we never hold your funds.",
  },
  {
    number: "02",
    title: "Add Subscriptions",
    description: "Import via CSV or add manually. Set billing cycles, amounts, and organize with folders and tags.",
  },
  {
    number: "03",
    title: "Lock & Protect",
    description: "Create escrow vaults for each subscription. Set kill switches. Build your on-chain payment resume.",
  },
  {
    number: "04",
    title: "Agent Pays",
    description: "The autonomous agent releases your vault on billing day. Funds go on-chain. You get a Telegram confirmation and an immutable proof.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 border-t border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <p className="font-display italic text-lg text-muted-foreground">How it works</p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
            Four steps to
            <br />
            <span className="text-muted-foreground/50">autonomous payments</span>
          </h2>
        </motion.div>

        <div className="mt-20 sm:mt-28">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="py-10 md:py-0 md:px-8 first:pl-0 last:pr-0"
              >
                <div className="flex items-start gap-3">
                  <span className="font-display text-7xl sm:text-8xl text-border/60 leading-none">{step.number}</span>
                </div>
                <h3 className="mt-4 text-xl font-medium text-foreground tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 sm:mt-20"
        >
          <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-7 py-6 text-sm font-medium gap-2 group">
            <Link to="/register">
              <div className="flex size-6 items-center justify-center rounded-md bg-background/20">
                <RiArrowRightLine className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
              Start Building
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
