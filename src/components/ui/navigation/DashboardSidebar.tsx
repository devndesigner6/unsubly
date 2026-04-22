import { Divider } from "@/components/Divider"
import { Logo } from "@/components/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/Sidebar"
import { siteConfig } from "@/lib/siteConfig"
import {
  DashboardMark, SubscriptionsMark, CalendarMark, AnalyticsMark,
  FoldersMark, TagsMark, PaymentMark,
  VaultsMark, OptimizerMark, RegistryMark, X402Mark, ResumeMark, TransactionsMark,
  SettingsMark,
} from "./SidebarIcons"
import { Link, useLocation } from "react-router-dom"
import * as React from "react"
import { UserProfile } from "./UserProfile"
import { useUpcomingCount } from "@/hooks/useUpcomingCount"

const mainNavigation = [
  { name: "Dashboard", href: siteConfig.baseLinks.dashboard, icon: DashboardMark },
  { name: "Subscriptions", href: siteConfig.baseLinks.subscriptions, icon: SubscriptionsMark },
  { name: "Calendar", href: siteConfig.baseLinks.calendar, icon: CalendarMark },
  { name: "Analytics", href: siteConfig.baseLinks.analytics, icon: AnalyticsMark },
] as const

const organizationNavigation = [
  { name: "Folders", href: "/folders", icon: FoldersMark },
  { name: "Tags", href: "/tags", icon: TagsMark },
  { name: "Payment Methods", href: "/payment-methods", icon: PaymentMark },
] as const

const algorandNavigation = [
  { name: "Escrow Vaults", href: "/escrow-vaults", icon: VaultsMark },
  { name: "AI Optimizer", href: "/ai-optimizer", icon: OptimizerMark },
  { name: "Service Registry", href: "/service-registry", icon: RegistryMark },
  { name: "x402 Demo", href: "/x402-demo", icon: X402Mark },
  { name: "On-Chain Resume", href: "/onchain-resume", icon: ResumeMark },
  { name: "Transactions", href: "/transactions", icon: TransactionsMark },
] as const

const settingsNavigation = [
  { name: "Settings", href: siteConfig.baseLinks.settings, icon: SettingsMark },
] as const

export function DashboardSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const upcomingCount = useUpcomingCount()

  const isActive = React.useCallback((href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }, [pathname])

  return (
    <Sidebar {...props} className="bg-muted">
      <SidebarHeader className="px-3 py-4">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg transition-colors hover:bg-accent -m-2 p-2"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground shrink-0">
            <Logo className="size-5 text-background" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground truncate">
              Unsubscribely
            </span>
            <span className="block text-xs text-muted-foreground truncate">
              Subscription Manager
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink
                    href={item.href}
                    isActive={isActive(item.href)}
                    icon={item.icon}
                    notifications={item.name === "Dashboard" && upcomingCount > 0 ? upcomingCount : undefined}
                  >
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-3"><Divider className="my-0 py-0" /></div>
        <SidebarGroup>
          <SidebarGroupContent>
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p>
            <SidebarMenu className="space-y-1">
              {organizationNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink href={item.href} isActive={isActive(item.href)} icon={item.icon}>
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-3"><Divider className="my-0 py-0" /></div>
        <SidebarGroup>
          <SidebarGroupContent>
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Algorand</p>
            <SidebarMenu className="space-y-1">
              {algorandNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink href={item.href} isActive={isActive(item.href)} icon={item.icon}>
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-3"><Divider className="my-0 py-0" /></div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarLink href={item.href} isActive={isActive(item.href)} icon={item.icon}>
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="border-t border-border" />
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  )
}