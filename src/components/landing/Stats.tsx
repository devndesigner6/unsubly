import { useEffect, useState, useRef } from "react"
import { motion } from "motion/react"

const stats = [
  { value: "3.3s", label: "Transaction finality" },
  { value: "<$0.001", label: "Per transaction fee" },
  { value: "12", label: "MCP tools available" },
]

export function Stats() {
  return (
    <section className="py-12 sm:py-16 border-y border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col items-start gap-2 py-6 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0"
            >
              <p className="font-mono-pixel text-5xl sm:text-6xl text-accent-gold tracking-tight">{stat.value}</p>
              <p className="text-sm text-foreground/50">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center gap-6 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <img src="/icons/algorand-white.svg" alt="Algorand" className="size-4 hidden dark:block" />
            <img src="/icons/algorand-black.svg" alt="Algorand" className="size-4 dark:hidden" />
            Algorand Blockchain
          </span>
          <span className="flex items-center gap-2">
            <img src="/icons/pera-white.svg" alt="Pera" className="h-4 w-auto hidden dark:block" />
            <img src="/icons/pera-black.svg" alt="Pera" className="h-4 w-auto dark:hidden" />
            Pera Wallet
          </span>
          <span className="flex items-center gap-2">
            <img src="/defly-logo.png" alt="Defly" className="size-5 rounded" />
            Defly Wallet
          </span>
          <span className="flex items-center gap-2">
            <img src="/icons/telegram.svg" alt="Telegram" className="size-5 rounded-full" />
            Telegram Bot
          </span>
        </motion.div>
      </div>
    </section>
  )
}
