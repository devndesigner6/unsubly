import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { initExchangeRates } from "@/lib/currency"
import { Toaster } from "@/components/ui/toaster"

// Layouts (always needed, kept eager)
import MarketingLayout from "@/layouts/MarketingLayout"
import DashboardLayout from "@/layouts/DashboardLayout"
import AuthLayout from "@/layouts/AuthLayout"

// Marketing landing — kept eager so first paint has no spinner
import HomePage from "@/pages/HomePage"

// Auth pages — lazy (only loaded when not signed in)
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"))
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"))
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"))
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"))
const AuthCallbackPage = lazy(() => import("@/pages/auth/AuthCallbackPage"))

// Dashboard pages — all lazy. Each route ships in its own JS chunk so the
// initial dashboard load only pays for the page the user actually requested.
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"))
const SubscriptionsPage = lazy(() => import("@/pages/dashboard/SubscriptionsPage"))
const NewSubscriptionPage = lazy(() => import("@/pages/dashboard/NewSubscriptionPage"))
const EditSubscriptionPage = lazy(() => import("@/pages/dashboard/EditSubscriptionPage"))
const CalendarPage = lazy(() => import("@/pages/dashboard/CalendarPage"))
const AnalyticsPage = lazy(() => import("@/pages/dashboard/AnalyticsPage"))
const FoldersPage = lazy(() => import("@/pages/dashboard/FoldersPage"))
const TagsPage = lazy(() => import("@/pages/dashboard/TagsPage"))
const PaymentMethodsPage = lazy(() => import("@/pages/dashboard/PaymentMethodsPage"))
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"))
const EscrowVaultsPage = lazy(() => import("@/pages/dashboard/EscrowVaultsPage"))
const VaultDetailsPage = lazy(() => import("@/pages/dashboard/VaultDetailsPage"))
const OnChainResumePage = lazy(() => import("@/pages/dashboard/OnChainResumePage"))
const ChatPage = lazy(() => import("@/pages/dashboard/ChatPage"))
const ServiceRegistryPage = lazy(() => import("@/pages/dashboard/ServiceRegistryPage"))
const X402DemoPage = lazy(() => import("@/pages/dashboard/X402DemoPage"))
const ConnectAgentPage = lazy(() => import("@/pages/dashboard/ConnectAgentPage"))
const CoSignerApprovalPage = lazy(() => import("@/pages/CoSignerApprovalPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"))
const TermsPage = lazy(() => import("@/pages/TermsPage"))
const DocsPage = lazy(() => import("@/pages/DocsPage"))
const TelegramAppPage = lazy(() => import("@/pages/TelegramAppPage"))

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
      <ThemeProvider defaultTheme="dark" disableTransitionOnChange attribute="class">
        <AuthProvider>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              {/* Marketing */}
              <Route element={<MarketingLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/docs" element={<DocsPage />} />
              </Route>

              {/* Public / no-auth routes */}
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/vault-approve/:vaultId" element={<CoSignerApprovalPage />} />
              <Route path="/telegram-app" element={<TelegramAppPage />} />

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
                <Route path="/ai-optimizer" element={<ChatPage />} />
                <Route path="/service-registry" element={<ServiceRegistryPage />} />
                <Route path="/x402-demo" element={<X402DemoPage />} />
                <Route path="/connect-agent" element={<ConnectAgentPage />} />
                <Route path="/onchain-resume" element={<OnChainResumePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
