import * as React from "react"

type IconProps = React.SVGProps<SVGSVGElement>

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  xmlns: "http://www.w3.org/2000/svg",
}

/* Modern geometric/blob icons — inspired by Diatom Studios, Oxyma, Open Group style.
   Clean, bold, minimal. Black fills that invert with theme. */

export const DashboardMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* 4 rounded squares — grid layout */}
    <rect x="3" y="3" width="8" height="8" rx="2.5" />
    <rect x="13" y="3" width="8" height="8" rx="2.5" />
    <rect x="3" y="13" width="8" height="8" rx="2.5" />
    <rect x="13" y="13" width="8" height="8" rx="4" />
  </svg>
)

export const SubscriptionsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Stacked cards — layered rectangles */}
    <rect x="4" y="6" width="16" height="13" rx="2.5" />
    <rect x="6" y="4" width="12" height="3" rx="1.5" opacity="0.4" />
    <rect x="7" y="10" width="6" height="1.5" rx="0.75" fill="currentColor" opacity="0" />
  </svg>
)

export const CalendarMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Calendar — rounded rect with top pins */}
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <rect x="7" y="2" width="2" height="4" rx="1" />
    <rect x="15" y="2" width="2" height="4" rx="1" />
    <circle cx="8" cy="14" r="1.5" fill="currentColor" className="text-background dark:text-background" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
    <circle cx="12" cy="14" r="1.5" fill="currentColor" className="text-background dark:text-background" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
  </svg>
)

export const AnalyticsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Pie chart — circle with wedge cut */}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 9 9h-9V3Z" fill="currentColor" opacity="0.4" />
  </svg>
)

export const FoldersMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Folder — organic blob shape */}
    <path d="M3 7a3 3 0 0 1 3-3h3.5l2 2H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z" />
  </svg>
)

export const TagsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Tag — rounded diamond with dot */}
    <path d="M2 12.5V5a3 3 0 0 1 3-3h7.5a2 2 0 0 1 1.4.6l8.1 8.1a2 2 0 0 1 0 2.8l-7.5 7.5a2 2 0 0 1-2.8 0l-8.1-8.1A2 2 0 0 1 2 12.5Z" />
    <circle cx="7.5" cy="7.5" r="2" fill="currentColor" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
  </svg>
)

export const PaymentMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Credit card — two overlapping circles (Mastercard-inspired) */}
    <circle cx="9.5" cy="12" r="6.5" />
    <circle cx="14.5" cy="12" r="6.5" opacity="0.5" />
  </svg>
)

export const VaultsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Shield — bold geometric */}
    <path d="M12 2L4 6v5c0 5.5 3.4 10.3 8 12 4.6-1.7 8-6.5 8-12V6l-8-4Z" />
  </svg>
)

export const OptimizerMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Starburst — radiating lines from center (like the reference star icons) */}
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
)

export const RegistryMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Network/MCP — connected nodes */}
    <circle cx="12" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M12 9v3M9.5 14.5L7.5 15.5M14.5 14.5l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
)

export const X402Mark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Payment protocol — two interlocking circles with line */}
    <circle cx="9" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="15" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
  </svg>
)

export const ResumeMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Document with person — rounded rect + avatar circle */}
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <circle cx="12" cy="9" r="2.5" fill="currentColor" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
    <path d="M8.5 17a3.5 3.5 0 0 1 7 0v1h-7v-1Z" fill="currentColor" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
  </svg>
)

export const RadarMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Concentric circles with sweep line */}
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 12L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
)

export const DisputeMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Balance scale — geometric */}
    <rect x="11" y="3" width="2" height="14" rx="1" />
    <rect x="4" y="18" width="16" height="3" rx="1.5" />
    <circle cx="6" cy="10" r="3" />
    <circle cx="18" cy="10" r="3" />
  </svg>
)

export const ApiDocsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Code brackets */}
    <path d="M8 4L3 12l5 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 4l5 8-5 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const TransactionsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Two arrows — exchange */}
    <path d="M4 8h13M13 5l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 16H7M11 19l-4-3 4-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const SettingsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Gear — hexagonal with center hole */}
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

export const InsuranceMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Shield with check — bold */}
    <path d="M12 2L4 6v5c0 5.5 3.4 10.3 8 12 4.6-1.7 8-6.5 8-12V6l-8-4Z" />
    <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--icon-inner, hsl(var(--background)))" }} />
  </svg>
)

export const A2AMark = (p: IconProps) => (
  <svg {...base} {...p}>
    {/* Two connected blobs — agent to agent */}
    <circle cx="7" cy="12" r="5" />
    <circle cx="17" cy="12" r="5" />
    <rect x="10" y="10.5" width="4" height="3" rx="1.5" fill="currentColor" style={{ fill: "var(--icon-inner, hsl(var(--background)))" }} />
  </svg>
)
