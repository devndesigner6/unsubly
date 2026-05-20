import { Logo } from "@/components/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/Sidebar"
import { siteConfig } from "@/lib/siteConfig"
import {
  DashboardMark, SubscriptionsMark, CalendarMark, AnalyticsMark,
  FoldersMark, TagsMark, PaymentMark,
  VaultsMark, OptimizerMark, RegistryMark, X402Mark,
  ResumeMark,
} from "./SidebarIcons"
import { Link, useLocation, useNavigate } from "react-router-dom"
import * as React from "react"
import { UserProfile } from "./UserProfile"
import { useUpcomingCount } from "@/hooks/useUpcomingCount"
import { RiSettings3Line, RiArrowRightSLine } from "@remixicon/react"
import { motion } from "motion/react"

const primaryNav = [
  { name: "Dashboard", href: siteConfig.baseLinks.dashboard, icon: DashboardMark },
  { name: "Subscriptions", href: siteConfig.baseLinks.subscriptions, icon: SubscriptionsMark },
  { name: "Calendar", href: siteConfig.baseLinks.calendar, icon: CalendarMark },
  { name: "Analytics", href: siteConfig.baseLinks.analytics, icon: AnalyticsMark },
] as const

const pinnedNav = [
  { name: "Escrow Vaults", href: "/escrow-vaults", icon: VaultsMark },
  { name: "MCP", href: "/connect-agent", icon: RegistryMark },
  { name: "Chat", href: "/ai-optimizer", icon: OptimizerMark },
  { name: "On-Chain Resume", href: "/onchain-resume", icon: ResumeMark },
] as const

const organizationNav = [
  { name: "Folders", href: "/folders", icon: FoldersMark },
  { name: "Tags", href: "/tags", icon: TagsMark },
  { name: "Payment Methods", href: "/payment-methods", icon: PaymentMark },
  { name: "Service Registry", href: "/service-registry", icon: RegistryMark },
  { name: "x402 Payments", href: "/x402-demo", icon: X402Mark },
] as const

/* ─── Nav Item with micro-interactions ─── */
function NavItem({ href, icon: Icon, name, active, badge, hasArrow }: {
  href: string; icon: React.ElementType; name: string; active: boolean; badge?: React.ReactNode; hasArrow?: boolean
}) {
  return (
    <Link to={href}>
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 relative ${
          active
            ? "bg-foreground/[0.07] text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gold"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
        <Icon className="size-[16px] shrink-0" />
        <span className="flex-1 truncate">{name}</span>
        {badge}
        {hasArrow && active && (
          <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <RiArrowRightSLine className="size-3.5 text-muted-foreground" />
          </motion.div>
        )}
      </motion.div>
    </Link>
  )
}

export function DashboardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const upcomingCount = useUpcomingCount()

  const isActive = React.useCallback((href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }, [pathname])

  return (
    <Sidebar {...props} className="bg-background">
      {/* Header */}
      <SidebarHeader className="px-4 pt-4 pb-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex size-8 items-center justify-center rounded-lg bg-foreground shrink-0"
          >
            <Logo className="size-4 text-background" />
          </motion.div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Unsubscribely
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Primary */}
        <div className="px-3 space-y-0.5">
          {primaryNav.map((item) => (
            <NavItem
              key={item.name}
              href={item.href}
              icon={item.icon}
              name={item.name}
              active={isActive(item.href)}
              badge={item.name === "Dashboard" && upcomingCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-md bg-foreground/10 text-[10px] font-semibold text-foreground">
                  {upcomingCount}
                </span>
              ) : undefined}
            />
          ))}
        </div>

        <div className="mx-4 my-3 h-px bg-border" />

        {/* Pinned */}
        <div className="px-3">
          <p className="px-3 mb-2 text-[11px] font-medium font-display italic text-muted-foreground/60 tracking-wider">Pinned</p>
          <div className="space-y-0.5">
            {pinnedNav.map((item) => (
              <NavItem
                key={item.name}
                href={item.href}
                icon={item.icon}
                name={item.name}
                active={isActive(item.href)}
                hasArrow
              />
            ))}
          </div>
        </div>

        <div className="mx-4 my-3 h-px bg-border" />

        {/* Organization */}
        <div className="px-3">
          <p className="px-3 mb-2 text-[11px] font-medium font-display italic text-muted-foreground/60 tracking-wider">Organization</p>
          <div className="space-y-0.5">
            {organizationNav.map((item) => (
              <NavItem
                key={item.name}
                href={item.href}
                icon={item.icon}
                name={item.name}
                active={isActive(item.href)}
              />
            ))}
          </div>
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between px-2 py-2">
          <UserProfile />
          <motion.button
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(siteConfig.baseLinks.settings)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Settings"
          >
            <RiSettings3Line className="size-4" />
          </motion.button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
