import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { RiArrowRightLine, RiCheckLine, RiPlayCircleLine, RiShieldCheckLine } from "@remixicon/react"
import { Link } from "react-router-dom"

export function Hero() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24 bg-[#FAFAFA] dark:bg-gray-950 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:3rem_3rem] sm:bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] dark:bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)]" />
      
      <div className="absolute left-10 top-40 size-72 rounded-full border border-gray-200/50 dark:border-gray-800/50 animate-pulse hidden lg:block" />
      <div className="absolute right-20 bottom-20 size-48 rounded-full border border-gray-200/50 dark:border-gray-800/50 animate-pulse hidden lg:block" style={{ animationDelay: "1s" }} />
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-20 items-center">
          <div className="text-center lg:text-left">
            <div 
              className={`mb-6 sm:mb-8 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-gray-200/80 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium shadow-sm transition-all duration-700 dark:border-gray-800 dark:bg-gray-900 ${
                loaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% Free</span>
              <span className="text-gray-500 dark:text-gray-400 hidden xs:inline">subscription tracker</span>
            </div>

            <h1 
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] font-semibold tracking-tight text-gray-900 leading-[1.15] transition-all duration-700 delay-100 dark:text-white ${
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              Never lose track of
              <br />
              <span className="text-gray-400 dark:text-gray-500">subscriptions again</span>
            </h1>

            <p 
              className={`mt-4 sm:mt-6 text-base sm:text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg mx-auto lg:mx-0 transition-all duration-700 delay-200 ${
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              Unsubscribely is your personal subscription assistant. Track spending, get smart alerts before charges, and save money by identifying unused subscriptions.
            </p>

            <div 
              className={`mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start transition-all duration-700 delay-300 ${
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <Button size="lg" asChild className="px-6 group w-full sm:w-auto">
                <Link to="/register">
                  Start Free Today
                  <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="px-6 group w-full sm:w-auto">
                <a href="#how-it-works">
                  <RiPlayCircleLine className="size-4" />
                  See How It Works
                </a>
              </Button>
            </div>
          </div>

          {/* Dashboard preview card - same as before but without stats fetch */}
          <div 
            className={`relative h-[380px] sm:h-[420px] md:h-[480px] lg:h-[540px] transition-all duration-1000 delay-300 ${
              loaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
            }`}
          >
            <div className={`absolute -left-2 sm:left-0 top-0 sm:top-4 z-20 rounded-xl sm:rounded-2xl border border-gray-200/80 bg-white p-3 sm:p-5 shadow-xl shadow-gray-200/50 transition-all duration-700 delay-500 hover:-translate-y-2 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none ${loaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"}`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex size-9 sm:size-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                  <RiCheckLine className="size-4 sm:size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">Alert sent!</p>
                  <p className="mt-0.5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">Netflix renews in 3 days</p>
                </div>
              </div>
            </div>

            <div className={`absolute -right-2 sm:right-0 bottom-8 sm:bottom-16 z-20 rounded-xl sm:rounded-2xl border border-gray-200/80 bg-white p-3 sm:p-5 shadow-xl shadow-gray-200/50 transition-all duration-700 delay-700 hover:-translate-y-2 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Monthly savings</p>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold text-emerald-600 dark:text-emerald-400">$47.99</p>
            </div>

            <div className={`relative mx-4 sm:ml-8 mt-10 sm:mt-16 rounded-xl sm:rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-gray-300/40 overflow-hidden transition-all duration-700 delay-400 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 dark:border-gray-800">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="size-2.5 sm:size-3 rounded-full bg-red-400" />
                  <div className="size-2.5 sm:size-3 rounded-full bg-amber-400" />
                  <div className="size-2.5 sm:size-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-gray-400 truncate">Unsubscribely</span>
              </div>
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg sm:rounded-xl bg-gray-50 p-3 sm:p-4 dark:bg-gray-800/50">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Spending</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">$247.00</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-gray-50 p-3 sm:p-4 dark:bg-gray-800/50">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">Active Subscriptions</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">24</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-12 sm:mt-16 lg:mt-20 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 transition-all duration-700 delay-700 dark:text-gray-400 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <RiShieldCheckLine className="size-4 sm:size-5 text-emerald-500" />
          <span className="text-center">Bank-level security • Your data is encrypted and never shared</span>
        </div>
      </div>
    </section>
  )
}
