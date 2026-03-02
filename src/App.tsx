import { Routes, Route } from "react-router-dom"
import { AuthProvider } from "./hooks/useAuth"
import { ProtectedRoute } from "./components/ProtectedRoute"
import MarketingLayout from "./layouts/MarketingLayout"
import DashboardLayout from "./layouts/DashboardLayout"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import Subscriptions from "./pages/Subscriptions"
import NewSubscription from "./pages/NewSubscription"
import Calendar from "./pages/Calendar"
import Analytics from "./pages/Analytics"
import Settings from "./pages/Settings"
import Folders from "./pages/Folders"
import Tags from "./pages/Tags"
import PaymentMethods from "./pages/PaymentMethods"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/subscriptions/new" element={<NewSubscription />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/folders" element={<Folders />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
