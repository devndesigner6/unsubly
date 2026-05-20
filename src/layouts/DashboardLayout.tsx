import { Outlet, NavLink, useLocation } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/Sidebar"
import { DashboardSidebar } from "@/components/ui/navigation/DashboardSidebar"
import { Breadcrumbs } from "@/components/ui/navigation/Breadcrumbs"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"
import { motion, AnimatePresence } from "motion/react"
import {
  RiDashboardLine, RiFileListLine, RiShieldLine,
  RiSparklingLine, RiSettings3Line,
} from "@remixicon/react"

const BOTTOM_NAV = [
  { to: "/dashboard", icon: RiDashboardLine, label: "Home" },
  { to: "/subscriptions", icon: RiFileListLine, label: "Subs" },
  { to: "/escrow-vaults", icon: RiShieldLine, label: "Vaults" },
  { to: "/ai-optimizer", icon: RiSparklingLine, label: "AI" },
  { to: "/settings", icon: RiSettings3Line, label: "Settings" },
]

export default function DashboardLayout() {
  const { pathname } = useLocation()

  return (
    <div className="h-full min-h-screen bg-background">
      <SidebarProvider defaultOpen={false}>
        <DashboardSidebar />
        <div className="w-full">
          <header className="sticky top-0 z-10 flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 size-10 flex items-center justify-center" data-tour="sidebar-trigger" />
            <div className="mr-2 h-4 w-px bg-border" />
            <Breadcrumbs />
          </header>
          {/* Extra bottom padding on mobile for nav bar + safe area */}
          <main className="min-h-[calc(100vh-3.5rem)] pb-24 sm:pb-20 md:pb-0">
            <ErrorBoundary>
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
        <OnboardingTour />
      </SidebarProvider>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center">
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => {
            const end = to === "/dashboard"
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95 ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-foreground" />}
                    <Icon className="size-5" />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}