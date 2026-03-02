import { useEffect, useRef, useState } from "react"
import { RiArrowRightLine, RiAddLine, RiBellLine, RiPieChartLine, RiCheckLine, RiTimeLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { Button } from "@/components/Button"

const steps = [
  { step: "01", name: "Add Subscriptions", description: "Import via CSV or add manually. Set billing cycles, amounts, and organize with folders.", icon: RiAddLine },
  { step: "02", name: "Get Smart Alerts", description: "Receive email notifications before renewals. Customize timing — 1, 3, or 7 days before.", icon: RiBellLine },
  { step: "03", name: "Track & Optimize", description: "View spending insights, identify unused subscriptions, and take control of your finances.", icon: RiPieChartLine },
]

export function HowItWorks() {
  const [inView, setInView] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setInView(true) }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const timer = setInterval(() => setActiveStep((prev) => (prev + 1) % 3), 3000)
    return () => clearInterval(timer)
  }, [inView])

  return (
    <section id="how-it-works" className="overflow-hidden bg-gray-50 py-16 dark:bg-gray-900 sm:py-24 lg:py-32">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-2xl text-center transition-all duration-700 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-950 sm:px-4 sm:py-2 sm:text-sm">
            <span className="font-medium text-gray-900 dark:text-white">How It Works</span>
          </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:mt-6 sm:text-4xl lg:text-5xl">
              Get started in <span className="text-gray-400 dark:text-gray-500">3 simple steps</span>
            </h2>
        </div>

        <div className="mt-12 grid items-start gap-8 sm:mt-16 sm:gap-12 lg:mt-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="space-y-4 sm:space-y-6">
            {steps.map((step, index) => (
              <div key={step.step} className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-500 sm:rounded-2xl sm:p-6 ${activeStep === index ? "border-gray-900 bg-white shadow-lg dark:border-white dark:bg-gray-950 sm:shadow-xl" : "border-gray-200 bg-white/50 dark:border-gray-800 dark:bg-gray-950/50"} ${inView ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"}`} style={{ transitionDelay: `${index * 150}ms` }} onClick={() => setActiveStep(index)}>
                {activeStep === index && <div className="absolute bottom-0 left-0 h-0.5 animate-[progress_3s_linear] rounded-b-xl bg-gray-900 dark:bg-white sm:h-1 sm:rounded-b-2xl" style={{ width: "100%" }} />}
                <div className="flex items-start gap-3 sm:gap-5">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors duration-300 sm:size-12 sm:rounded-xl sm:text-sm ${activeStep === index ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-400 dark:bg-gray-800"}`}>{step.step}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-base font-semibold transition-colors duration-300 sm:text-lg ${activeStep === index ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{step.name}</h3>
                    <p className={`mt-1 text-xs leading-relaxed transition-colors duration-300 sm:mt-2 sm:text-sm ${activeStep === index ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`relative transition-all delay-300 duration-700 ${inView ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}>
            <div className="flex h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950 sm:h-[380px] lg:h-[420px]">
              <div className="text-center">
                {steps[activeStep] && <steps[activeStep].icon className="mx-auto size-12 text-gray-900 dark:text-white" />}
                <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{steps[activeStep]?.name}</h3>
                <p className="mt-2 text-gray-500">{steps[activeStep]?.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-12 text-center transition-all delay-500 duration-700 sm:mt-16 ${inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <Button size="lg" asChild><Link to="/register">Start Free Today <RiArrowRightLine className="size-4" /></Link></Button>
        </div>
      </div>
    </section>
  )
}
