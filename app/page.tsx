import {
  WebsiteHeader,
  WebsiteFooter,
  HeroSection,
  FeaturesSection,
  BenefitsSection,
  HowItWorksSection,
  CTASection,
} from "@/components/website";

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
