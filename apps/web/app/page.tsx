import { LandingHeader } from "@/components/landing/header"
import { LandingHero } from "@/components/landing/hero"
import { LandingFeatures } from "@/components/landing/features"
import { LandingPricing } from "@/components/landing/pricing"
import { LandingTestimonials } from "@/components/landing/testimonials"
import { LandingFooter } from "@/components/landing/footer"

export default function Page() {
  return (
    <>
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingPricing />
        <LandingTestimonials />
      </main>
      <LandingFooter />
    </>
  )
}
