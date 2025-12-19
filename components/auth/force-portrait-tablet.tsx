"use client";

import { useEffect, useState } from "react";

export function ForcePortraitTablet() {
  const [isTablet, setIsTablet] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkDeviceAndOrientation = () => {
      if (typeof window === "undefined") return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect tablet (768px - 1024px)
      const tablet = width >= 768 && width < 1024;
      const landscape = width > height;

      setIsTablet(tablet);
      setIsLandscape(landscape);
    };

    checkDeviceAndOrientation();
    window.addEventListener("resize", checkDeviceAndOrientation);
    window.addEventListener("orientationchange", checkDeviceAndOrientation);

    return () => {
      window.removeEventListener("resize", checkDeviceAndOrientation);
      window.removeEventListener("orientationchange", checkDeviceAndOrientation);
    };
  }, []);

  // Show warning overlay if tablet is in landscape mode
  if (isTablet && isLandscape) {
    return (
      <div
        className="fixed inset-0 bg-black/95 flex items-center justify-center p-8 z-[9999]"
        style={{ zIndex: 9999 }}
      >
        <div className="text-center space-y-8 max-w-md">
          <div className="flex justify-center">
            <div className="phone-rotate-animation">
              <div className="phone-frame">
                <div className="phone-screen"></div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-white text-xl font-medium">
              Putar tablet ke mode portrait
            </p>
            <p className="text-gray-300 text-sm">
              Halaman login hanya tersedia dalam mode portrait untuk tablet
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

