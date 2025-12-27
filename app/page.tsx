import { WebsiteHeader } from "@/components/website/header";
import { WebsiteFooter } from "@/components/website/footer";
import HeroSatu from "@/components/website/herosatu";
import { FeaturesSection } from "@/components/website/features-section";
import { BenefitsSection } from "@/components/website/benefits-section";
import { HowItWorksSection } from "@/components/website/how-it-works-section";
import { CTASection } from "@/components/website/cta-section";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Landing page untuk website perkenalan Nozzl
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden w-full">
      <WebsiteHeader />
      <main className="flex-1 overflow-x-hidden w-full">
        <HeroSatu />
        <FeaturesSection />
        <BenefitsSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <WebsiteFooter />
    </div>
  );
}
