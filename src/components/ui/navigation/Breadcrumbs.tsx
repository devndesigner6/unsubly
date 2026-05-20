import { ChevronRight } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  subscriptions: "Subscriptions",
  new: "New",
  calendar: "Calendar",
  analytics: "Analytics",
  settings: "Settings",
  folders: "Folders",
  tags: "Tags",
  "payment-methods": "Payment Methods",
  "escrow-vaults": "Escrow Vaults",
  "ai-optimizer": "AI Optimizer",
  "onchain-resume": "On-Chain Resume",
  "service-registry": "Service Registry",
  "renewal-radar": "Renewal Radar",
  "dispute-center": "Dispute Center",
  "cancellation-insurance": "Cancel Insurance",
  "a2a-demo": "A2A Demo",
  "x402-demo": "x402 Protocol",
  "api-docs": "API Docs",
  transactions: "Transactions",
  "vault-approve": "Vault Approval",
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <nav aria-label="Breadcrumb" className="ml-2 min-w-0 flex-1 overflow-hidden">
      <ol role="list" className="flex items-center space-x-3 text-sm whitespace-nowrap">
        <li className="flex">
          <Link to="/dashboard" className="text-gray-500 transition hover:text-gray-700 dark:text-white/50 hover:dark:text-white/70">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const isLast = index === segments.length - 1
          const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

          // On small screens hide intermediate segments to prevent header
          // overflow; the first crumb (Home) plus the current page is enough.
          const hideOnMobile = !isLast && segments.length > 1
          return (
            <li
              key={segment}
              className={`flex items-center ${hideOnMobile ? "hidden sm:flex" : ""}`}
            >
              <ChevronRight className="mr-3 size-4 shrink-0 text-gray-600 dark:text-white/50" aria-hidden="true" />
              <Link
                to={href}
                aria-current={isLast ? "page" : undefined}
                className={`max-w-[40vw] truncate sm:max-w-none ${isLast ? "text-gray-900 dark:text-white" : "text-gray-500 transition hover:text-gray-700 dark:text-white/50 hover:dark:text-white/70"}`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
