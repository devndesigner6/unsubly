import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine, RiCheckLine, RiSparklingLine } from "@remixicon/react"
import { Link } from "react-router-dom"

const benefits = ["100% Free forever", "No credit card required", "Set up in 2 minutes"]

export function CTA() {
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setInView(true) }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="overflow-hidden bg-gray-50 py-16 dark:bg-gray-900 sm:py-24 lg:py-32">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-700 dark:border-gray-800 dark:bg-gray-950 sm:rounded-3xl sm:p-8 sm:shadow-xl lg:p-12 ${inView ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-50 dark:bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] sm:bg-[size:4rem_4rem]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs transition-all duration-500 dark:border-gray-800 dark:bg-gray-900 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${inView ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
              <RiSparklingLine className="size-3.5 text-amber-500 sm:size-4" />
              <span className="text-gray-600 dark:text-gray-400">100% Free</span>
            </div>
            <h2 className={`mt-6 text-2xl font-semibold tracking-tight text-gray-900 transition-all delay-100 duration-700 dark:text-white sm:mt-8 sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              Ready to take control of<br /><span className="text-gray-400 dark:text-gray-500">your subscriptions?</span>
            </h2>
            <p className={`mt-4 text-sm text-gray-500 transition-all delay-200 duration-700 dark:text-gray-400 sm:mt-6 sm:text-base lg:text-lg ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              Start saving money and stay on top of your recurring expenses for free.
            </p>
            <div className={`mt-6 flex flex-col items-center justify-center gap-3 transition-all delay-300 duration-700 sm:mt-8 sm:flex-row sm:gap-4 lg:mt-10 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              <Button size="lg" asChild className="w-full px-6 py-5 text-sm sm:w-auto sm:px-8 sm:py-6 sm:text-base"><Link to="/register">Get Started Free <RiArrowRightLine className="size-4 sm:size-5" /></Link></Button>
              <Button variant="secondary" size="lg" asChild className="w-full px-6 py-5 text-sm sm:w-auto sm:px-8 sm:py-6 sm:text-base"><a href="#how-it-works">See How It Works</a></Button>
            </div>
            <div className={`mt-6 flex flex-wrap items-center justify-center gap-3 transition-all delay-[400ms] duration-700 sm:mt-8 sm:gap-4 lg:mt-10 lg:gap-6 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              {benefits.map((b) => (<div key={b} className="flex items-center gap-1.5 sm:gap-2"><RiCheckLine className="size-3.5 text-emerald-500 sm:size-4" /><span className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">{b}</span></div>))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
