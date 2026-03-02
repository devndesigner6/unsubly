import { Outlet } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/Sidebar"
import { DashboardSidebar } from "@/components/ui/navigation/DashboardSidebar"
import { Breadcrumbs } from "@/components/ui/navigation/Breadcrumbs"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export default function DashboardLayout() {
  return (
    <div className="h-full min-h-screen bg-gray-50 dark:bg-gray-950">
      <SidebarProvider defaultOpen={true}>
        <DashboardSidebar />
        <div className="w-full">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
            <SidebarTrigger className="-ml-1" />
            <div className="mr-2 h-4 w-px bg-gray-200 dark:bg-gray-800" />
            <Breadcrumbs />
          </header>
          <main className="min-h-[calc(100vh-4rem)]">
            <ErrorBoundary><Outlet /></ErrorBoundary>
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}
