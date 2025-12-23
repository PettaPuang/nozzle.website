"use client";

import Image from "next/image";
import {
  IpadMockup,
  IphoneLandscapeMockup,
  WelcomeIphonePreview,
  TankPreview,
  ChartPreview,
  StationIphonePreview,
} from "./mockup";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TextType from "@/components/ui/reactbits/TextType";

export function HeroSection() {
  const [currentView, setCurrentView] = useState<
    "welcome" | "tank" | "station" | "chart"
  >("welcome");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentView((prev) => {
        // Rotasi: welcome -> tank -> station -> chart -> welcome
        if (prev === "welcome") return "tank";
        if (prev === "tank") return "station";
        if (prev === "station") return "chart";
        return "welcome";
      });
    }, 5000); // Berganti setiap 5 detik

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 overflow-x-hidden overflow-y-auto min-h-screen flex items-center">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-5 dark:opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-white/50 dark:from-gray-900/50" />

      {/* Mockup sebagai Background - iPhone untuk welcome/station, iPad untuk tank/chart */}
      <div className="absolute inset-0 lg:block hidden overflow-hidden z-10">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3/4 h-full flex items-center justify-end pr-8 xl:pr-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className={`w-full max-w-[1400px] ${
                currentView === "tank" || currentView === "chart"
                  ? "translate-y-16"
                  : ""
              }`}
            >
              {currentView === "welcome" ? (
                <IphoneLandscapeMockup>
                  <WelcomeIphonePreview />
                </IphoneLandscapeMockup>
              ) : currentView === "tank" ? (
                <IpadMockup>
                  <TankPreview />
                </IpadMockup>
              ) : currentView === "station" ? (
                <IphoneLandscapeMockup>
                  <StationIphonePreview />
                </IphoneLandscapeMockup>
              ) : (
                <IpadMockup>
                  <ChartPreview />
                </IpadMockup>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* TextType di kiri atas */}
      <div className="absolute top-8 left-4 sm:left-6 lg:left-8 z-30">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-30 overflow-visible"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-white leading-tight whitespace-nowrap overflow-visible block relative z-30 w-max">
            <TextType
              text={[
                "SPBU Management System",
                "Full Control Management",
                "Easy to Use",
                "Reliable & Realtime Data",
              ]}
              typingSpeed={60}
              pauseDuration={2500}
              deletingSpeed={30}
              initialDelay={0}
              loop={true}
              showCursor={true}
              cursorCharacter="|"
              as="span"
              className="whitespace-nowrap relative z-30"
            />
          </h1>
        </motion.div>
      </div>

      {/* Content Overlay */}
      <div className="relative w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32 z-20">
        <div className="lg:w-1/2 w-full relative z-30">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6 lg:space-y-8"
          >
            {/* Logo Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col items-start gap-3 ml-2 md:ml-4 lg:ml-6 mt-32 md:mt-40 lg:mt-48"
            >
              <Image
                src="/logo/Nozzl.svg"
                alt="Nozzl"
                width={200}
                height={75}
                priority
                className="w-auto h-auto max-w-[240px] md:max-w-[300px] lg:max-w-[360px]"
              />
              <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-300 italic font-light">
                Your System Evolve
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Mockup untuk Mobile/Tablet - di bawah content */}
        <div className="lg:hidden mt-12 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              {currentView === "welcome" ? (
                <IphoneLandscapeMockup>
                  <WelcomeIphonePreview />
                </IphoneLandscapeMockup>
              ) : currentView === "tank" ? (
                <IpadMockup>
                  <TankPreview />
                </IpadMockup>
              ) : currentView === "station" ? (
                <IphoneLandscapeMockup>
                  <StationIphonePreview />
                </IphoneLandscapeMockup>
              ) : (
                <IpadMockup>
                  <ChartPreview />
                </IpadMockup>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
