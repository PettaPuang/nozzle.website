"use client";

import Image from "next/image";
import { MockupShowcase } from "./mockup/mockup-showcase";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import TextType from "@/components/ui/reactbits/TextType";

type MockupView = "welcome" | "tank" | "station" | "chart";

export function HeroSection() {
  const [currentView, setCurrentView] = useState<MockupView>("welcome");
  const [isDesktop, setIsDesktop] = useState(false);

  const textTypeTexts = [
    "SPBU Management System",
    "Easy to Use",
    "Reliable & Realtime Data",
    "Full Control",
  ];

  // Detect desktop breakpoint (lg = 1024px)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Handler untuk sinkronisasi dengan TextType
  const handleTextComplete = (sentence: string, index: number) => {
    if (!isDesktop) return;

    // Map index teks ke view mockup
    // index 0 -> welcome, index 1 -> tank, index 2 -> station, index 3 -> chart
    const viewMap: MockupView[] = ["welcome", "tank", "station", "chart"];
    // Ketika callback dipanggil dengan index, teks berikutnya adalah (index + 1)
    const nextViewIndex = (index + 1) % viewMap.length;
    setCurrentView(viewMap[nextViewIndex]);
  };

  return (
    <section className="relative bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen flex items-start w-full">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-5 dark:opacity-10 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-white/50 dark:from-gray-900/50 z-0" />

      {/* Content - Layout Desktop: Logo/TextType kiri (1/3), Mockup kanan (2/3) */}
      <div className="relative w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-0 z-10 overflow-visible min-h-screen flex flex-col">
        <div className="w-full lg:flex flex-1">
          {/* Kiri - Logo (1/3 di desktop) */}
          <div className="w-full lg:w-1/3 flex flex-col">
            {/* Baris 1 - Logo (Fixed Height) */}
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Image
                  src="/logo/Nozzl.svg"
                  alt="Nozzl"
                  width={200}
                  height={75}
                  priority
                  loading="eager"
                  className="w-auto h-auto max-w-[180px] sm:max-w-[220px] md:max-w-[300px] lg:max-w-[360px]"
                />
              </motion.div>
            </div>
          </div>

          {/* Kanan - Mockup (2/3 di desktop, hidden di non-desktop) */}
          <div className="hidden lg:flex lg:w-2/3 lg:items-start lg:justify-end">
            <MockupShowcase currentView={currentView} />
          </div>
        </div>

        {/* TextType - Di paling bawah (bisa menembus mockup) */}
        <div className="w-full px-4 lg:px-8 lg:absolute lg:left-0 lg:bottom-0 pb-8 lg:pb-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1
                className="font-bold text-gray-900 dark:text-white leading-tight line-clamp-2"
                style={{
                  fontSize: "clamp(1.5rem, 3vw + 1rem, 5rem)",
                  minHeight: "2.2em",
                }}
              >
                <TextType
                  text={textTypeTexts}
                  typingSpeed={100}
                  pauseDuration={3000}
                  deletingSpeed={50}
                  initialDelay={500}
                  loop={true}
                  showCursor={true}
                  cursorCharacter="|"
                  as="span"
                  onSentenceComplete={handleTextComplete}
                />
              </h1>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
