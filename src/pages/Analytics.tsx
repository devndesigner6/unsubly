import { RiPieChartLine } from "@remixicon/react"

export default function Analytics() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="text-center">
        <RiPieChartLine className="mx-auto size-12 text-gray-300" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Analytics</h2>
        <p className="mt-2 text-gray-500">Coming soon — spending insights & trends</p>
      </div>
    </div>
  )
}
