"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { WelcomeIphonePreview } from "./welcome-preview";
import { StationIphonePreview } from "./station-preview";

type IphoneMockupProps = {
  children?: React.ReactNode;
  type?: "welcome" | "station";
};

export function IphoneMockup({ children, type }: IphoneMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;

      // Reference width untuk scale 1.0 (100%)
      // iPhone: 900px (landscape mockup)
      const referenceWidth = 900;

      // Calculate scale berdasarkan container width
      // Min scale: 0.5 untuk iPhone
      // Max scale: 1.0
      const minScale = 0.5;
      const calculatedScale = containerWidth / referenceWidth;
      const finalScale = Math.max(minScale, Math.min(1, calculatedScale));

      setScale(finalScale);
    };

    // Initial calculation
    updateScale();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Render preview berdasarkan type
  const renderContent = () => {
    if (type === "welcome") {
      return <WelcomeIphonePreview />;
    }
    if (type === "station") {
      return <StationIphonePreview />;
    }
    return children;
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0 }}
      className="relative hidden lg:block mt-8 sm:mt-12 md:mt-16 lg:mt-20 xl:mt-24 2xl:mt-28"
    >
      <div
        ref={containerRef}
        className="relative w-full mx-auto"
        style={{
          maxWidth: "min(900px, 100%)",
          width: "100%",
          perspective: "2000px",
        }}
      >
        {/* iPhone Frame - Landscape - Modern Realistic Design dengan kemiringan 3D */}
        <div
          className="relative z-10"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateY(-30deg) rotateX(8deg)",
            transformOrigin: "right center",
            width: "100%",
          }}
        >
          {/* Outer Frame dengan shadow dan gradient realistis */}
          <div
            className="relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black"
            style={{
              borderRadius: "clamp(1.5rem, 3.3vw, 3rem)",
              padding: "clamp(0.375rem, 0.89vw, 0.5rem)", // 6px to 8px
              boxShadow: `
                0 clamp(1.25rem, 2.78vw, 1.563rem) clamp(2.5rem, 5.56vw, 3.125rem) clamp(-0.625rem, -1.33vw, -0.75rem) rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.1) inset,
                0 clamp(0.125rem, 0.22vw, 0.125rem) clamp(0.25rem, 0.44vw, 0.25rem) rgba(0, 0, 0, 0.3) inset,
                0 clamp(2.5rem, 5.56vw, 3.125rem) clamp(5rem, 11.11vw, 6.25rem) clamp(-1rem, -2.22vw, -1.25rem) rgba(0, 0, 0, 0.4)
              `,
            }}
          >
            {/* Screen Bezel */}
            <div
              className="relative bg-black"
              style={{
                borderRadius: "clamp(1.25rem, 2.8vw, 2.5rem)",
                padding: "clamp(0.25rem, 0.44vw, 0.25rem)", // 4px fixed
              }}
            >
              {/* Dynamic Island - positioned at left side in landscape */}
              <div
                className="absolute top-1/2 -translate-y-1/2 bg-black rounded-full z-20"
                style={{
                  left: "clamp(0.5rem, 1.33vw, 0.75rem)", // 8px to 12px
                  width: "clamp(1.25rem, 1.94vw, 1.75rem)", // 20px to 28px
                  height: "clamp(6rem, 14.22vw, 8rem)", // 96px to 128px
                  boxShadow:
                    "inset 0 0 clamp(0.5rem, 1.33vw, 0.75rem) rgba(0, 0, 0, 0.8)",
                }}
              >
                {/* Camera & Sensors */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bg-gray-900 rounded-full border border-gray-700"
                  style={{
                    top: "clamp(1rem, 2.67vw, 1.5rem)", // 16px to 24px
                    width: "clamp(0.375rem, 0.89vw, 0.5rem)", // 6px to 8px
                    height: "clamp(0.375rem, 0.89vw, 0.5rem)", // 6px to 8px
                  }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 bg-gray-900 rounded-full"
                  style={{
                    bottom: "clamp(1rem, 2.67vw, 1.5rem)", // 16px to 24px
                    width: "clamp(0.3125rem, 0.67vw, 0.375rem)", // 5px to 6px
                    height: "clamp(0.3125rem, 0.67vw, 0.375rem)", // 5px to 6px
                  }}
                />
              </div>

              {/* Screen Content */}
              <div
                className="relative bg-white dark:bg-gray-950 overflow-hidden"
                style={{
                  aspectRatio: "2.16 / 1", // iPhone 16 landscape ratio (19.5:9)
                  borderRadius: "clamp(1rem, 2.5vw, 2.25rem)",
                  boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* Realistic Screen Glass Effect */}
                <div className="absolute inset-0 pointer-events-none z-20">
                  {/* Top reflection */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1/3 bg-linear-to-b from-white/10 via-white/5 to-transparent"
                    style={{
                      borderTopLeftRadius: "clamp(1rem, 2.5vw, 2.25rem)",
                      borderTopRightRadius: "clamp(1rem, 2.5vw, 2.25rem)",
                    }}
                  />
                  {/* Side light */}
                  <div
                    className="absolute top-0 left-0 h-full bg-linear-to-r from-white/5 to-transparent"
                    style={{ width: "25%" }}
                  />
                  {/* Corner glow */}
                  <div
                    className="absolute top-0 right-0 bg-gradient-radial from-white/5 to-transparent rounded-full"
                    style={{
                      width: "clamp(5rem, 8.89vw, 8rem)", // 80px to 128px
                      height: "clamp(5rem, 8.89vw, 8rem)", // 80px to 128px
                      filter: `blur(clamp(1.5rem, 2.67vw, 2rem))`, // 24px to 32px blur
                    }}
                  />
                </div>

                {/* Content Area dengan scaling */}
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="origin-top-left h-full w-full"
                    style={{
                      transform: `scale(${scale})`,
                      width: `${100 / scale}%`,
                      height: `${100 / scale}%`,
                    }}
                  >
                    {renderContent() || (
                      <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
                        <div className="text-center space-y-4 p-8">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              delay: 0.6,
                              type: "spring",
                              stiffness: 200,
                            }}
                            className="w-20 h-20 mx-auto bg-linear-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-xl"
                          >
                            <span className="text-3xl font-bold text-white">
                              N
                            </span>
                          </motion.div>
                          <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="text-2xl font-bold text-gray-900 dark:text-white"
                          >
                            Welcome to Nozzl
                          </motion.h2>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Frame Highlights - untuk efek realistis */}
            <div
              className="absolute top-0 left-0 right-0 h-1/2 bg-linear-to-b from-white/5 to-transparent pointer-events-none"
              style={{
                borderTopLeftRadius: "clamp(1.5rem, 3.3vw, 3rem)",
                borderTopRightRadius: "clamp(1.5rem, 3.3vw, 3rem)",
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-black/10 to-transparent pointer-events-none"
              style={{
                borderBottomLeftRadius: "clamp(1.5rem, 3.3vw, 3rem)",
                borderBottomRightRadius: "clamp(1.5rem, 3.3vw, 3rem)",
              }}
            />

            {/* Volume buttons - horizontal di bawah frame, sisi kiri */}
            <div
              className="absolute bottom-0 bg-linear-to-r from-gray-600 to-gray-700 rounded-b-sm"
              style={{
                left: "12%",
                width: "clamp(2rem, 5.33vw, 3rem)", // 32px to 48px
                height: "clamp(0.125rem, 0.22vw, 0.125rem)", // 2px fixed
              }}
            />
            <div
              className="absolute bottom-0 bg-linear-to-r from-gray-600 to-gray-700 rounded-b-sm"
              style={{
                left: "12%",
                width: "clamp(1.75rem, 4.44vw, 2.5rem)", // 28px to 40px
                height: "clamp(0.125rem, 0.22vw, 0.125rem)", // 2px fixed
                transform: "translateX(clamp(2.5rem, 5.78vw, 3.25rem))", // 40px to 52px
              }}
            />
          </div>

          {/* Enhanced 3D Shadow Effect - mengikuti kemiringan iPhone */}
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            style={{
              borderRadius: "clamp(1.5rem, 3.3vw, 3rem)",
              background:
                "radial-gradient(ellipse 95% 65% at 58% 48%, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.1) 60%, transparent 75%)",
              transform:
                "translateY(clamp(1.5rem, 3.89vw, 2.188rem)) translateX(clamp(0.25rem, 0.56vw, 0.313rem)) scale(1.08) rotateZ(2deg)",
              filter: `blur(clamp(1.25rem, 3.33vw, 1.875rem))`, // 20px to 30px
            }}
          />

          {/* Subtle ambient light */}
          <div
            className="absolute inset-0 pointer-events-none -z-20"
            style={{
              borderRadius: "clamp(1.5rem, 3.3vw, 3rem)",
              background:
                "radial-gradient(ellipse 100% 60% at 50% 40%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)",
              transform:
                "translateY(clamp(-0.5rem, -1.11vw, -0.625rem)) scale(1.1)",
              filter: `blur(clamp(1.25rem, 3.33vw, 1.875rem))`, // 20px to 30px
            }}
          />
        </div>

        {/* Floating particles effect (optional - for premium look) */}
        <div className="absolute inset-0 pointer-events-none -z-30">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute bg-blue-400/20 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
                width: "clamp(0.25rem, 0.44vw, 0.25rem)", // 4px fixed
                height: "clamp(0.25rem, 0.44vw, 0.25rem)", // 4px fixed
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Alias for backward compatibility
export const IphoneLandscapeMockup = IphoneMockup;
