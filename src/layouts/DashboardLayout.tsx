import { Outlet } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/Sidebar"
import { DashboardSidebar } from "@/components/ui/navigation/DashboardSidebar"
import { Breadcrumbs } from "@/components/ui/navigation/Breadcrumbs"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"

export default function DashboardLayout() {
  return (
    <div className="h-full min-h-screen bg-background">
      <SidebarProvider defaultOpen={false}>
        <DashboardSidebar />
        <div className="w-full">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger className="-ml-1" data-tour="sidebar-trigger" />
            <div className="mr-2 h-4 w-px bg-border" />
            <Breadcrumbs />
          </header>
          <main className="min-h-[calc(100vh-4rem)]">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <OnboardingTour />
      </SidebarProvider>
    </div>
  )
}