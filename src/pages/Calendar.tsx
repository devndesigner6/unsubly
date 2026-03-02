import { RiCalendarLine } from "@remixicon/react"

export default function Calendar() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="text-center">
        <RiCalendarLine className="mx-auto size-12 text-gray-300" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Calendar View</h2>
        <p className="mt-2 text-gray-500">Coming soon — visualize your payment schedule</p>
      </div>
    </div>
  )
}
