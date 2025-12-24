"use client";

import { useEffect, useRef, useState } from "react";
import { TankPreview } from "./tank-preview";
import { ChartPreview } from "./chart-preview";
import { WelcomeIpadPreview } from "./welcome-ipad-preview";
import { StationIpadPreview } from "./station-ipad-preview";

type IpadMockupProps = {
  children?: React.ReactNode;
  type?: "tank" | "chart" | "welcome" | "station";
};

export function IpadMockup({ children, type }: IpadMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;

      // Reference width untuk scale 1.0 (100%)
      // iPad: 1400px (landscape mockup) - sama dengan maxWidth untuk konsistensi dengan iPhone
      const referenceWidth = 1400;

      // Calculate scale berdasarkan container width
      // Min scale: sama proporsi dengan iPhone untuk konsistensi di semua breakpoint
      // iPhone: 900px reference, 0.5 min scale
      // Untuk konsistensi yang sama, iPad juga menggunakan minScale 0.5
      // Ini memastikan preview scalable dengan proporsi yang sama di semua breakpoint
      // Max scale: 1.0
      const minScale = 0.5;
      const calculatedScale = containerWidth / referenceWidth;
      const finalScale = Math.max(minScale, Math.min(1, calculatedScale));

      setScale(finalScale);
    };

    // Initial calculation
    updateScale();

    // Update on resize - gunakan window resize untuk memastikan update di semua breakpoint
    const handleResize = () => {
      updateScale();
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Render preview berdasarkan type
  const renderContent = () => {
    if (type === "tank") {
      return <TankPreview />;
    }
    if (type === "chart") {
      return <ChartPreview />;
    }
    if (type === "welcome") {
      return <WelcomeIpadPreview />;
    }
    if (type === "station") {
      return <StationIpadPreview />;
    }
    return children;
  };
  return (
    <div className="relative hidden lg:block">
      <div
        ref={containerRef}
        className="relative w-full mx-auto"
        style={{
          maxWidth: "min(1400px, 100%)",
          width: "100%",
          perspective: "2000px",
        }}
      >
        {/* iPad Container with 3D Transform - Fixed untuk semua device */}
        <div
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateY(-15deg) rotateX(5deg)",
            transformOrigin: "center center",
            width: "100%",
          }}
        >
          {/* iPad Front with Screen */}
          <div
            className="relative bg-linear-to-br from-gray-700 via-gray-600 to-gray-700"
            style={{
              borderRadius: "clamp(1.5rem, 2.14vw, 3rem)",
              padding: "clamp(0.375rem, 0.57vw, 0.5rem)", // 6px to 8px
              boxShadow: `0 clamp(0.5rem, 0.71vw, 0.625rem) clamp(1.5rem, 2.14vw, 1.875rem) clamp(-0.25rem, -0.36vw, -0.313rem) rgba(0, 0, 0, 0.2), 
                 0 clamp(0.25rem, 0.29vw, 0.25rem) clamp(0.625rem, 0.86vw, 0.75rem) clamp(-0.125rem, -0.14vw, -0.125rem) rgba(0, 0, 0, 0.15), 
                 0 0 0 1px rgba(255, 255, 255, 0.05) inset`,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Screen Bezel (Black Border) */}
            <div
              className="relative bg-black shadow-inner"
              style={{
                borderRadius: "clamp(1.25rem, 1.79vw, 2.5rem)",
                padding: "clamp(0.375rem, 0.57vw, 0.5rem)", // 6px to 8px
              }}
            >
              {/* Screen Content */}
              <div
                className="relative bg-white dark:bg-gray-900 overflow-hidden w-full"
                style={{
                  aspectRatio: "3 / 2", // iPad Mini aspect ratio (2266 x 1488)
                  minHeight: 0,
                  borderRadius: "clamp(1rem, 1.43vw, 2rem)",
                }}
              >
                {/* Content dengan scaling */}
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
                      <div className="h-full w-full flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800">
                        <div className="text-center space-y-4 p-8">
                          <div className="w-20 h-20 mx-auto bg-linear-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl font-bold text-white">
                              N
                            </span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Welcome to Nozzl
                          </h2>
                          <p className="text-gray-600 dark:text-gray-400">
                            SPBU Management System
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Screen Glare Effect */}
                <div
                  className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent pointer-events-none"
                  style={{
                    borderRadius: "clamp(1rem, 1.43vw, 2rem)",
                  }}
                />
              </div>
            </div>

            {/* Reflection on Front Glass */}
            <div
              className="absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent pointer-events-none"
              style={{
                borderRadius: "clamp(1.5rem, 2.14vw, 3rem)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
