import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { AlgorandProvider } from "@/lib/algorand/context"
import { Toaster } from "@/components/ui/toaster"

// Layouts
import MarketingLayout from "@/layouts/MarketingLayout"
import DashboardLayout from "@/layouts/DashboardLayout"
import AuthLayout from "@/layouts/AuthLayout"

// Marketing pages
import HomePage from "@/pages/HomePage"

// Auth pages
import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"

// Dashboard pages
import DashboardPage from "@/pages/dashboard/DashboardPage"
import SubscriptionsPage from "@/pages/dashboard/SubscriptionsPage"
import NewSubscriptionPage from "@/pages/dashboard/NewSubscriptionPage"
import EditSubscriptionPage from "@/pages/dashboard/EditSubscriptionPage"
import CalendarPage from "@/pages/dashboard/CalendarPage"
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage"
import FoldersPage from "@/pages/dashboard/FoldersPage"
import TagsPage from "@/pages/dashboard/TagsPage"
import PaymentMethodsPage from "@/pages/dashboard/PaymentMethodsPage"
import SettingsPage from "@/pages/dashboard/SettingsPage"
import EscrowVaultsPage from "@/pages/dashboard/EscrowVaultsPage"
import VaultDetailsPage from "@/pages/dashboard/VaultDetailsPage"
import OnChainResumePage from "@/pages/dashboard/OnChainResumePage"
import NotFoundPage from "@/pages/NotFoundPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" disableTransitionOnChange attribute="class">
        <AuthProvider>
          <AlgorandProvider>
            <Routes>
              {/* Marketing */}
              <Route element={<MarketingLayout />}>
                <Route path="/" element={<HomePage />} />
              </Route>

              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Dashboard (Protected) */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/subscriptions" element={<SubscriptionsPage />} />
                <Route path="/subscriptions/new" element={<NewSubscriptionPage />} />
                <Route path="/subscriptions/:id" element={<EditSubscriptionPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/folders" element={<FoldersPage />} />
                <Route path="/tags" element={<TagsPage />} />
                <Route path="/payment-methods" element={<PaymentMethodsPage />} />
                <Route path="/escrow-vaults" element={<EscrowVaultsPage />} />
                <Route path="/onchain-resume" element={<OnChainResumePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AlgorandProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
