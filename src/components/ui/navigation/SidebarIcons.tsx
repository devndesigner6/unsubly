import * as React from "react"

type IconProps = React.SVGProps<SVGSVGElement>

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  xmlns: "http://www.w3.org/2000/svg",
}

export const DashboardMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="10" width="8" height="11" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
  </svg>
)

export const SubscriptionsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 4v2h10V8H7Zm0 4v2h10v-2H7Zm0 4v2h6v-2H7Z" />
  </svg>
)

export const CalendarMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 2v2H5a2 2 0 0 0-2 2v3h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm14 9H3v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9Zm-9 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
  </svg>
)

export const AnalyticsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3a9 9 0 0 1 9 9h-9V3Z" />
  </svg>
)

export const FoldersMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
  </svg>
)

export const TagsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12.6 2H5a3 3 0 0 0-3 3v7.6a2 2 0 0 0 .59 1.42l8.4 8.4a2 2 0 0 0 2.83 0l7.6-7.6a2 2 0 0 0 0-2.83l-8.4-8.4A2 2 0 0 0 12.6 2Zm-5.6 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
  </svg>
)

export const PaymentMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V6Zm0 4h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Zm3 5h5v2H6v-2Z" />
  </svg>
)

export const VaultsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      fillRule="evenodd"
      d="M12 2 4 5v6c0 5 3.5 9.4 8 11 4.5-1.6 8-6 8-11V5l-8-3Zm-1.06 13.31 5.3-5.3-1.41-1.41-3.89 3.88-1.77-1.77-1.41 1.41 3.18 3.19Z"
      clipRule="evenodd"
    />
  </svg>
)

export const OptimizerMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
)

export const RegistryMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 7h18l-1.4 4H4.4L3 7Z" />
    <path
      fillRule="evenodd"
      d="M5 13h14v8H5v-8Zm4 2.5v5.5h6v-5.5H9Z"
      clipRule="evenodd"
    />
  </svg>
)

export const X402Mark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      fillRule="evenodd"
      d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-3 3v-3H6a2 2 0 0 1-2-2V5Zm4.6 4.2 1.4-1.6 1.4 1.6 1.2-1-1.6-1.4 1.6-1.4-1.2-1L10 6l-1.4-1.6-1.2 1L9 6.8 7.4 8.2l1.2 1Zm6 0 1.4-1.6 1.4 1.6 1.2-1-1.6-1.4 1.6-1.4-1.2-1L16 6l-1.4-1.6-1.2 1 1.6 1.4-1.6 1.4 1.2 1ZM7 13h10v-1.5H7V13Z"
      clipRule="evenodd"
    />
  </svg>
)

export const ResumeMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      fillRule="evenodd"
      d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H6Zm6 8.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm-4.5 5.6a4.5 4.5 0 0 1 9 0v.5h-9v-.5Z"
      clipRule="evenodd"
    />
  </svg>
)

export const TransactionsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M4 8h13l-3-3M20 16H7l3 3"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
)

export const SettingsMark = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      fillRule="evenodd"
      d="M12 2.5 14 5l3.2-.6 1.4 3-1.6 2.6L19 13l-2 2.4.6 3.2-3 1.4-2.6-1.6L9.4 19l-2.4-2-3.2.6-1.4-3 1.6-2.6L3 9.4l2-2.4-.6-3.2 3-1.4 2.6 1.6L12 2.5Zm0 6.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      clipRule="evenodd"
    />
  </svg>
)
