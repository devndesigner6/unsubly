import { Navigate } from "react-router-dom"
import { Hero } from "@/components/landing/Hero"
import { Stats } from "@/components/landing/Stats"
import { Features } from "@/components/landing/Features"
import { AlgorandShowcase } from "@/components/landing/AlgorandShowcase"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { CTA } from "@/components/landing/CTA"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const { user, loading } = useAuth()

  // If a returning user has a valid Supabase session, send them straight to the
  // dashboard instead of forcing them to click "Sign in" from the landing page.
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <>
      <Hero />
      <Features />
      <Stats />
      <AlgorandShowcase />
      <HowItWorks />
      <CTA />
    </>
  )
}
