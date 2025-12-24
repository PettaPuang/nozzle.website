import { WebsiteHeader } from "@/components/website/header";
import { WebsiteFooter } from "@/components/website/footer";
import { HeroSection } from "@/components/website/hero-section";
import { FeaturesSection } from "@/components/website/features-section";
import { BenefitsSection } from "@/components/website/benefits-section";
import { HowItWorksSection } from "@/components/website/how-it-works-section";
import { CTASection } from "@/components/website/cta-section";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Landing page untuk website perkenalan Nozzl
  return (
    <div className="min-h-screen flex flex-col">
      <WebsiteHeader />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <BenefitsSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <WebsiteFooter />
    </div>
  );
}
