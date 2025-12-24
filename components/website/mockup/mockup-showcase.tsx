"use client";

import { useEffect, useState } from "react";
import CardSwap, { Card } from "@/components/ui/reactbits/CardSwap";
import { IphoneMockup } from "./iphone-mockup";

type MockupView = "welcome" | "tank" | "station" | "chart";

type MockupShowcaseProps = {
  autoRotate?: boolean;
  rotationInterval?: number;
};

const VIEWS: MockupView[] = ["welcome", "tank", "station", "chart"];

export function MockupShowcase({
  autoRotate = true,
  rotationInterval = 5000,
}: MockupShowcaseProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop breakpoint
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Mobile/Tablet: CardSwap dengan ukuran lebih kecil
  if (!isDesktop) {
    return (
      <div className="relative w-full flex flex-col items-center justify-center">
        <div
          className="relative w-full flex items-center justify-center"
          style={{
            minHeight: "500px",
            height: "500px",
            perspective: "1500px",
          }}
        >
          <div
            className="relative"
            style={{
              width: "100%",
              height: "450px",
              maxWidth: "400px",
            }}
          >
            <style jsx global>{`
              .cardswap-mobile-override > div {
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                bottom: auto !important;
                right: auto !important;
              }
              .cardswap-mobile-override > div[class*="rounded-xl"] {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
              }
            `}</style>
            <div className="cardswap-mobile-override">
              <CardSwap
                width={400}
                height={450}
                cardDistance={40}
                verticalDistance={30}
                delay={rotationInterval}
                pauseOnHover={false}
                skewAmount={0}
                easing="elastic"
              >
                {VIEWS.map((view) => (
                  <Card
                    key={view}
                    customClass="bg-transparent border-0 shadow-none"
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <IphoneMockup type={view} flat={false} />
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: CardSwap dengan ukuran besar
  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        className="relative flex-1 w-full flex items-start justify-center"
        style={{ minHeight: "800px", height: "800px" }}
      >
        <div
          className="relative w-full h-full flex items-start justify-center"
          style={{ perspective: "2000px" }}
        >
          <div
            className="relative"
            style={{
              width: "100%",
              height: "700px",
              maxWidth: "900px",
            }}
          >
            <style jsx global>{`
              .cardswap-center-override > div {
                position: absolute !important;
                top: 35% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                bottom: auto !important;
                right: auto !important;
              }
              .cardswap-center-override > div[class*="rounded-xl"] {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
              }
            `}</style>
            <div className="cardswap-center-override">
              <CardSwap
                width={900}
                height={650}
                cardDistance={75}
                verticalDistance={50}
                delay={rotationInterval}
                pauseOnHover={false}
                skewAmount={0}
                easing="elastic"
              >
                {VIEWS.map((view) => (
                  <Card
                    key={view}
                    customClass="bg-transparent border-0 shadow-none"
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <IphoneMockup type={view} flat={false} />
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
