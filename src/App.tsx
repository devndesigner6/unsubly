import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { initExchangeRates } from "@/lib/currency"
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
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage"
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage"
import AuthCallbackPage from "@/pages/auth/AuthCallbackPage"

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
import TransactionHistoryPage from "@/pages/dashboard/TransactionHistoryPage"
import AIOptimizerPage from "@/pages/dashboard/AIOptimizerPage"
import ServiceRegistryPage from "@/pages/dashboard/ServiceRegistryPage"
import X402DemoPage from "@/pages/dashboard/X402DemoPage"
import ApiDocsPage from "@/pages/dashboard/ApiDocsPage"
import RenewalRadarPage from "@/pages/dashboard/RenewalRadarPage"
import DisputeCenterPage from "@/pages/dashboard/DisputeCenterPage"
import CoSignerApprovalPage from "@/pages/CoSignerApprovalPage"
import NotFoundPage from "@/pages/NotFoundPage"

// Fetch live exchange rates once at startup, fire and forget, falls back to static rates
initExchangeRates()

const AlgorandProviderLazy = lazy(async () => {
  const { AlgorandProvider } = await import("@/lib/algorand/context")

  return {
    default: function AlgorandProviderWrapper({ children }: { children: React.ReactNode }) {
      return <AlgorandProvider>{children}</AlgorandProvider>
    },
  }
})

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullScreenLoader />
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
          <Routes>
            {/* Marketing */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<HomePage />} />
            </Route>

            {/* Public / no-auth routes */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/vault-approve/:vaultId" element={<CoSignerApprovalPage />} />

            {/* Auth */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Dashboard (Protected) */}
            <Route
              element={
                <ProtectedRoute>
                  <Suspense fallback={<FullScreenLoader />}>
                    <AlgorandProviderLazy>
                      <DashboardLayout />
                    </AlgorandProviderLazy>
                  </Suspense>
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
              <Route path="/escrow-vaults/:id" element={<VaultDetailsPage />} />
              <Route path="/ai-optimizer" element={<AIOptimizerPage />} />
              <Route path="/service-registry" element={<ServiceRegistryPage />} />
              <Route path="/x402-demo" element={<X402DemoPage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/renewal-radar" element={<RenewalRadarPage />} />
              <Route path="/dispute-center" element={<DisputeCenterPage />} />
              <Route path="/onchain-resume" element={<OnChainResumePage />} />
              <Route path="/transactions" element={<TransactionHistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

