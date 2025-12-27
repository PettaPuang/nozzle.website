"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { WelcomeIpadPreview } from "./welcome-ipad-preview";
import { StationIpadPreview } from "./station-ipad-preview";
import { TankPreview } from "./tank-preview";
import { ChartPreview } from "./chart-preview";

type HoldingIpadMockupProps = {
  children?: React.ReactNode;
  type?: "tank" | "chart" | "welcome" | "station";
  screenInset?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  aspectRatio?: string;
  maxWidth?: string;
  scale?: number;
};

/**
 * Komponen mockup menggunakan gambar holdingipad.png sebagai frame
 * Menampilkan konten preview di area layar tablet dalam gambar
 *
 * SOLUSI ASPECT RATIO MISMATCH:
 * - Preview content aspect ratio: 16/10 = 1.6 (sangat lebar/landscape)
 * - Screen area (kotak iPad) aspect ratio: berbeda (lebih square)
 *
 * Scale dihitung OTOMATIS berdasarkan:
 * 1. Aspect ratio screen area (dari screenInset)
 * 2. Aspect ratio preview content (16/10)
 * 3. Menggunakan constraint yang lebih ketat (min dari width/height)
 *
 * Hasil: Preview akan fit tanpa overflow, tapi mungkin ada letterboxing
 * jika aspect ratio berbeda.
 */
export function HoldingIpadMockup({
  children,
  type,
  screenInset = {
    top: "10%",
    right: "8%",
    bottom: "18%",
    left: "8%",
  },
  aspectRatio = "16 / 10",
  maxWidth = "1800px",
  scale,
}: HoldingIpadMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenAreaRef = useRef<HTMLDivElement>(null);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [calculatedScale, setCalculatedScale] = useState(scale || 1.0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hitung scale dinamis berdasarkan aspect ratio
  useEffect(() => {
    if (scale !== undefined) {
      // Jika scale sudah diberikan, gunakan itu
      setCalculatedScale(scale);
      return;
    }

    // Kalkulasi aspect ratio screen area
    const top = parseFloat(screenInset.top?.replace("%", "") || "10") / 100;
    const bottom =
      parseFloat(screenInset.bottom?.replace("%", "") || "18") / 100;
    const left = parseFloat(screenInset.left?.replace("%", "") || "8") / 100;
    const right = parseFloat(screenInset.right?.replace("%", "") || "8") / 100;

    // Aspect ratio screen area (kotak iPad)
    const screenWidth = 1 - left - right; // 84% = 0.84
    const screenHeight = 1 - top - bottom; // 72% = 0.72
    const screenAspectRatio = screenWidth / screenHeight; // 0.84 / 0.72 = 1.167

    // Aspect ratio preview content
    const previewAspectRatio = 16 / 10; // 1.6

    // Hitung scale berdasarkan constraint yang lebih ketat
    // Preview content aspect ratio: 16/10 = 1.6
    // Artinya jika width = 1.0, maka height = 1.0 / 1.6 = 0.625

    // Jika kita scale preview dengan scale = s:
    // - previewWidthScaled = 1.0 * s
    // - previewHeightScaled = 0.625 * s

    // Agar preview fit tanpa overflow:
    // - previewWidthScaled <= screenWidth → s <= screenWidth
    // - previewHeightScaled <= screenHeight → s <= screenHeight / 0.625 = screenHeight * 1.6

    // Scale maksimal = min(screenWidth, screenHeight * previewAspectRatio)
    const scaleByWidth = screenWidth; // Constraint dari width
    const scaleByHeight = screenHeight * previewAspectRatio; // Constraint dari height

    // Gunakan scale yang lebih kecil untuk menghindari overflow
    const optimalScale = Math.min(scaleByWidth, scaleByHeight);

    // Perkecil scale preview (90% dari optimal scale)
    const finalScale = optimalScale * 0.9;

    setCalculatedScale(finalScale);
  }, [screenInset, scale]);

  // Deteksi theme yang aktif (dark atau light)
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

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
    <div className="relative block w-full" ref={containerRef}>
      <div
        className="relative w-full mx-auto"
        style={{
          maxWidth: `min(${maxWidth}, 100%)`,
          width: "100%",
        }}
      >
        {/* Frame container - menggunakan aspect ratio gambar holdingipad.png yang sebenarnya */}
        <div
          className="relative"
          style={{
            width: "100%",
            aspectRatio: aspectRatio,
          }}
        >
          {/* Frame Image - gambar holdingipad.png sebagai background */}
          <img
            src="/mockup/holdingipad.png"
            alt="Holding iPad mockup"
            className="absolute inset-0 w-full h-full"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              zIndex: 10,
            }}
            draggable={false}
            onError={(e) => {
              console.error(
                "Failed to load frame image: /mockup/holdingipad.png"
              );
              e.currentTarget.style.border = "2px solid red";
            }}
          />

          {/* Screen Content - area preview di dalam kotak iPad (bukan gambar keseluruhan) */}
          {/* Posisi dihitung berdasarkan proporsi screen area terhadap gambar holdingipad.png */}
          <div
            ref={screenAreaRef}
            className={`absolute ${isDark ? "dark" : ""}`}
            style={{
              // Posisi screen area berdasarkan analisis visual gambar holdingipad.png
              // Screen area berada di tengah-tengah gambar dengan sedikit offset ke atas
              // karena tangan memegang dari bawah
              top: screenInset.top,
              right: screenInset.right,
              bottom: screenInset.bottom,
              left: screenInset.left,
              overflow: "hidden",
              zIndex: 2,
              borderRadius: "clamp(0.5rem, 0.8vw, 1rem)",
              contain: "layout style paint",
            }}
          >
            {/* Content wrapper - scale konten agar fit dalam kotak iPad */}
            {/* Scale dihitung otomatis berdasarkan aspect ratio untuk menghindari overflow */}
            <div
              className={`w-full h-full ${isDark ? "dark" : ""}`}
              style={{
                zoom: calculatedScale,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {renderContent() || (
                <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-900">
                  <div className="text-center space-y-4 p-8">
                    <div className="w-20 h-20 mx-auto bg-linear-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-3xl font-bold text-white">N</span>
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
        </div>
      </div>
    </div>
  );
}
