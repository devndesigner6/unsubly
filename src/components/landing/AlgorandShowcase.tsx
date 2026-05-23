import { useEffect, useRef, useState, useMemo } from "react"
import { motion, useInView } from "motion/react"

function AnimatedValue({ value, inView }: { value: string; inView: boolean }) {
  const [displayed, setDisplayed] = useState(value)
  const numericMatch = value.match(/[\d.]+/)

  useEffect(() => {
    if (!inView || !numericMatch) return
    const target = parseFloat(numericMatch[0])
    const duration = 1200
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = target * eased

      // Preserve the format (e.g. "< $0.001" or "3.3 seconds")
      const formatted = target < 1
        ? current.toFixed(3)
        : current.toFixed(1)
      setDisplayed(value.replace(numericMatch[0], formatted))

      if (progress < 1) requestAnimationFrame(animate)
      else setDisplayed(value)
    }
    requestAnimationFrame(animate)
  }, [inView, value, numericMatch])

  return <span>{displayed}</span>
}

export function AlgorandShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  // Fix: compute dot opacities once, not on every re-render
  const dots = useMemo(
    () => Array.from({ length: 200 }, () => Math.random() > 0.3),
    []
  )

  return (
    <section id="blockchain" className="py-16 sm:py-20 lg:py-24 border-t border-border overflow-hidden">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left - Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
              Audit every payment
              <br />
              down to a
              <br />
              <span className="text-muted-foreground/50">single transaction,</span>
            </h2>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
              and make sure it <span className="text-foreground font-medium">never happens again</span>
            </p>
          </motion.div>

          {/* Right - Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <p className="text-sm text-foreground/70 leading-relaxed">
              The first-of-its-kind decentralized subscription management system that can understand and control payment state across multiple providers using the Algorand blockchain.
            </p>
            <div className="mt-10 space-y-6">
              {[
                { label: "Sub-penny fees", value: "< $0.001 per transaction" },
                { label: "Finality", value: "3.3 seconds average" },
                { label: "Infrastructure", value: "Carbon negative blockchain" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between border-b border-border pb-4">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-foreground">
                    <AnimatedValue value={item.value} inView={isInView} />
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Decorative dot matrix */}
        <div className={`mt-16 flex justify-end transition-all duration-1000 delay-500 ${isInView ? "opacity-100" : "opacity-0"}`}>
          <div className="grid gap-1.5 opacity-[0.06]" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
            {dots.map((visible, i) => (
              <div
                key={i}
                className="size-1 rounded-full bg-foreground"
                style={{ opacity: visible ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
