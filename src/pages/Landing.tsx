import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Stats } from "@/components/landing/Stats"
import { CTA } from "@/components/landing/CTA"

export default function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <CTA />
    </>
  )
}
