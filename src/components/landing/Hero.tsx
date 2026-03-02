import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine, RiCheckLine, RiPlayCircleLine, RiShieldCheckLine } from "@remixicon/react"
import { Link } from "react-router-dom"

export function Hero() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { setLoaded(true) }, [])

  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] pb-16 pt-24 dark:bg-gray-950 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] dark:bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] sm:bg-[size:4rem_4rem]" />
      <div className="absolute left-10 top-40 hidden size-72 animate-pulse rounded-full border border-gray-200/50 dark:border-gray-800/50 lg:block" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          <div className="text-center lg:text-left">
            <div className={`mb-6 inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all duration-700 dark:border-gray-800 dark:bg-gray-900 sm:mb-8 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs ${loaded ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% Free</span>
              <span className="hidden text-gray-500 dark:text-gray-400 xs:inline">subscription tracker</span>
            </div>

            <h1 className={`text-3xl font-semibold leading-[1.15] tracking-tight text-gray-900 transition-all delay-100 duration-700 dark:text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] ${loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              Never lose track of<br />
              <span className="text-gray-400 dark:text-gray-500">subscriptions again</span>
            </h1>

            <p className={`mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-500 transition-all delay-200 duration-700 dark:text-gray-400 sm:mt-6 sm:text-lg lg:mx-0 ${loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              Unsubscribely is your personal subscription assistant. Track spending, get smart alerts before charges, and save money by identifying unused subscriptions.
            </p>

            <div className={`mt-8 flex flex-col justify-center gap-3 transition-all delay-300 duration-700 sm:mt-10 sm:flex-row lg:justify-start ${loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              <Button size="lg" asChild className="group w-full px-6 sm:w-auto">
                <Link to="/register">Start Free Today <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-1" /></Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="group w-full px-6 sm:w-auto">
                <a href="#how-it-works"><RiPlayCircleLine className="size-4" /> See How It Works</a>
              </Button>
            </div>
          </div>

          {/* Right Side Cards */}
          <div className={`relative h-[380px] transition-all delay-300 duration-1000 sm:h-[420px] md:h-[480px] lg:h-[540px] ${loaded ? "translate-x-0 opacity-100" : "translate-x-12 opacity-0"}`}>
            <div className={`absolute -left-2 top-0 z-20 rounded-xl border border-gray-200/80 bg-white p-3 shadow-xl shadow-gray-200/50 transition-all delay-500 duration-700 hover:-translate-y-2 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:left-0 sm:top-4 sm:rounded-2xl sm:p-5 ${loaded ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 sm:size-11"><RiCheckLine className="size-4 text-emerald-600 dark:text-emerald-400 sm:size-5" /></div>
                <div>
                  <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:text-xs">Alert sent!</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">Netflix renews in 3 days</p>
                </div>
              </div>
            </div>

            <div className={`absolute -right-2 bottom-8 z-20 rounded-xl border border-gray-200/80 bg-white p-3 shadow-xl shadow-gray-200/50 transition-all delay-700 duration-700 hover:-translate-y-2 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:bottom-16 sm:right-0 sm:rounded-2xl sm:p-5 ${loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Monthly savings</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400 sm:text-3xl">$47.99</p>
            </div>

            <div className={`relative mx-4 mt-10 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-2xl shadow-gray-300/40 transition-all delay-[400ms] duration-700 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:ml-8 sm:mt-16 sm:rounded-2xl ${loaded ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
                <div className="flex items-center gap-1.5 sm:gap-2"><div className="size-2.5 rounded-full bg-red-400 sm:size-3" /><div className="size-2.5 rounded-full bg-amber-400 sm:size-3" /><div className="size-2.5 rounded-full bg-emerald-400 sm:size-3" /></div>
                <span className="truncate text-[10px] font-medium text-gray-400 sm:text-xs">Unsubscribely</span>
              </div>
              <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 sm:rounded-xl sm:p-4">
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Monthly Spending</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white sm:mt-2 sm:text-2xl">$247.00</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 sm:rounded-xl sm:p-4">
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">Active Subscriptions</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white sm:mt-2 sm:text-2xl">24</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-12 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 transition-all delay-700 duration-700 dark:text-gray-400 sm:mt-16 sm:flex-row sm:gap-3 sm:text-sm lg:mt-20 ${loaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <RiShieldCheckLine className="size-4 text-emerald-500 sm:size-5" />
          <span className="text-center">Bank-level security • Your data is encrypted and never shared</span>
        </div>
      </div>
    </section>
  )
}
