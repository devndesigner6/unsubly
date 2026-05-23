import { Navigate } from "react-router-dom"
import { Hero } from "@/components/landing/Hero"
import { ProductMockup } from "@/components/landing/ProductMockup"
import { Stats } from "@/components/landing/Stats"
import { Features } from "@/components/landing/Features"
import { AlgorandShowcase } from "@/components/landing/AlgorandShowcase"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { IndiaSection } from "@/components/landing/IndiaSection"
import { CTA } from "@/components/landing/CTA"
import { KonamiVault } from "@/components/landing/KonamiVault"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <>
      <KonamiVault />
      <Hero />
      <ProductMockup />
      <Features />
      <Stats />
      <AlgorandShowcase />
      <IndiaSection />
      <HowItWorks />
      <CTA />
    </>
  )
}
