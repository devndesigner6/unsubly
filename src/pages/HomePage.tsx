import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { AlgorandShowcase } from "@/components/landing/AlgorandShowcase"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Stats } from "@/components/landing/Stats"
import { CTA } from "@/components/landing/CTA"

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <AlgorandShowcase />
      <HowItWorks />
      <Stats />
      <CTA />
    </>
  )
}
