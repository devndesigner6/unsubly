import { useEffect, useState, useRef } from "react"
import { RiGroupLine, RiFileList3Line, RiMoneyDollarCircleLine, RiCheckboxCircleLine } from "@remixicon/react"

function AnimatedCounter({ value, prefix, suffix, inView }: { value: number; prefix: string; suffix: string; inView: boolean }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView || value === 0) return
    const duration = 2000; const steps = 60; const stepValue = value / steps; let current = 0
    const timer = setInterval(() => { current += stepValue; if (current >= value) { setCount(value); clearInterval(timer) } else { setCount(Math.floor(current)) } }, duration / steps)
    return () => clearInterval(timer)
  }, [value, inView])
  const formatNumber = (num: number) => { if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"; if (num >= 1000) return (num / 1000).toFixed(0) + "K"; return num.toString() }
  return <span>{prefix}{formatNumber(count)}{suffix}</span>
}

export function Stats() {
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setInView(true) }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const stats = [
    { id: 1, name: "Users", value: 500, suffix: "+", prefix: "", description: "Tracking subscriptions", icon: RiGroupLine },
    { id: 2, name: "Active Subscriptions", value: 2500, suffix: "+", prefix: "", description: "Currently tracked", icon: RiCheckboxCircleLine },
    { id: 3, name: "Total Subscriptions", value: 5000, suffix: "+", prefix: "", description: "Being managed", icon: RiFileList3Line },
    { id: 4, name: "Value Tracked", value: 250000, suffix: "+", prefix: "$", description: "Annual subscriptions", icon: RiMoneyDollarCircleLine },
  ]

  return (
    <section id="stats" className="overflow-hidden bg-white py-16 dark:bg-gray-950 sm:py-24 lg:py-32">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-2xl text-center transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">Trusted by <span className="text-gray-400 dark:text-gray-500">users worldwide</span></h2>
          <p className="mt-4 text-base text-gray-500 dark:text-gray-400 sm:mt-6 sm:text-lg">Join our community and take control of your subscription spending.</p>
        </div>
        <dl className="mt-12 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 lg:mt-20 lg:grid-cols-4 lg:gap-6">
          {stats.map((stat, index) => (
            <div key={stat.id} className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all duration-500 hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 sm:rounded-2xl sm:p-6 lg:p-8 ${inView ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`} style={{ transitionDelay: `${index * 100}ms` }}>
              <div className="absolute inset-0 bg-gray-50 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:bg-gray-800/50" />
              <div className="relative flex size-10 items-center justify-center rounded-lg bg-gray-100 transition-transform duration-500 group-hover:scale-110 dark:bg-gray-800 sm:size-12 sm:rounded-xl">
                <stat.icon className="size-5 text-gray-900 dark:text-white sm:size-6" />
              </div>
              <dd className="relative mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:mt-6 sm:text-3xl lg:text-4xl xl:text-5xl">
                <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} inView={inView} />
              </dd>
              <dt className="relative mt-1 text-sm font-medium text-gray-900 dark:text-white sm:mt-2 sm:text-base">{stat.name}</dt>
              <p className="relative text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{stat.description}</p>
              <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gray-900 transition-all duration-700 group-hover:w-full dark:bg-white sm:h-1" />
            </div>
          ))}
        </dl>
        <div className={`mt-10 flex flex-wrap items-center justify-center gap-4 transition-all delay-500 duration-700 sm:mt-12 sm:gap-6 lg:mt-16 lg:gap-8 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          {["Open Source", "GDPR Ready", "256-bit SSL", "100% Free"].map((badge) => (
            <div key={badge} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 sm:gap-2 sm:text-sm">
              <div className="size-1 rounded-full bg-emerald-500 sm:size-1.5" />{badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
