"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IphoneMockup } from "./iphone-mockup";
import { IpadMockup } from "./ipad-mockup";

type MockupView = "welcome" | "tank" | "station" | "chart";

type MockupShowcaseProps = {
  currentView?: MockupView;
};

export function MockupShowcase({
  currentView = "welcome",
}: MockupShowcaseProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop breakpoint (lg = 1024px)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const renderMockup = () => {
    // Desktop: tampilkan mockup sesuai view
    if (isDesktop) {
      if (currentView === "welcome" || currentView === "station") {
        const iphoneType = currentView === "welcome" ? "welcome" : "station";
        return <IphoneMockup type={iphoneType} />;
      }
      if (currentView === "tank" || currentView === "chart") {
        const ipadType = currentView === "tank" ? "tank" : "chart";
        return <IpadMockup type={ipadType} />;
      }
    }

    // Tablet/Mobile: hanya tampilkan IphoneMockup dengan type welcome
    return <IphoneMockup type="welcome" />;
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Mockup Layer */}
      <div className="relative flex-1 w-full flex items-start justify-start">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: 0.6,
              delay: 0.4,
            }}
            className={`w-full ${
              currentView === "tank" || currentView === "chart"
                ? "lg:translate-y-6 lg:translate-x-2 xl:translate-y-10 xl:translate-x-4"
                : ""
            }`}
            style={{
              maxWidth: "min(1400px, 100%)",
              width: "100%",
            }}
          >
            {renderMockup()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
