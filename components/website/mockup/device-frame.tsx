"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

type DeviceFrameProps = {
  children: React.ReactNode;
  device: "iphone" | "ipad";
  flat?: boolean;
};

/**
 * Component untuk menampilkan konten dalam frame device yang realistis
 * Menggunakan CSS positioning dengan overlay frame image
 *
 * Perbaikan:
 * - Menggunakan CSS containment untuk mencegah overflow
 * - Object-fit untuk konten agar selalu fit dalam frame
 * - Perbaikan scaling dengan aspect ratio preservation
 * - Better handling untuk konten kompleks (chart, map, dll)
 */
export function DeviceFrame({
  children,
  device,
  flat = false,
}: DeviceFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Fixed scale untuk preview agar konsisten meskipun ukuran mockup diubah
    // iPad menggunakan skala lebih kecil karena ukurannya lebih besar
    const previewScale = device === "ipad" ? 0.25 : 0.35;
    setScale(previewScale);
  }, [device]);

  // Deteksi theme yang aktif (dark atau light)
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  // Device-specific configurations
  // Berdasarkan dimensi resmi dari Apple:
  // iPhone 17 Pro: 2622 x 1206 px (landscape) = 2.174:1 aspect ratio
  // iPad Pro 13 M4: 2752 x 2064 px (landscape) = 4:3 aspect ratio
  const deviceConfig = {
    iphone: {
      maxWidth: "650px",
      aspectRatio: "2.174 / 1", // iPhone 17 Pro landscape (2622/1206)
      frameImage: "/mockup/iPhone 17 Pro - Cosmic Orange - Landscape.png",
      // Screen inset - disesuaikan dengan area layar di gambar frame Apple
      // Nilai ini menentukan area layar yang terlihat di dalam frame
      screenInset: {
        top: "6%", // Dikurangi untuk menghilangkan celah di bagian atas
        right: "5%", // Dikurangi untuk menghilangkan celah di sisi kanan
        bottom: "6%", // Dikurangi untuk menghilangkan celah di bagian bawah
        left: "5.5%", // Dikurangi lebih banyak untuk menghilangkan celah di sisi kiri
      },
      // Border radius untuk matching dengan area layar di frame
      borderRadius: "clamp(0.5rem, 1.25vw, 1.125rem)",
    },
    ipad: {
      maxWidth: "1300px",
      aspectRatio: "4 / 3", // iPad Pro 13 M4 landscape (2752/2064 = 4:3)
      frameImage: "/mockup/iPad Pro 13 - M4 - Silver - Landscape.png",
      // Screen inset untuk iPad - disesuaikan untuk menghilangkan celah di semua sisi
      screenInset: {
        top: "5%",
        right: "5%",
        bottom: "5%",
        left: "5%",
      },
      // Border radius untuk matching dengan area layar di frame
      borderRadius: "clamp(0.5rem, 0.71vw, 1rem)",
    },
  };

  const config = deviceConfig[device];

  return (
    <div className="relative block w-full">
      <div
        ref={containerRef}
        className="relative w-full mx-auto"
        style={{
          maxWidth: `min(${config.maxWidth}, 100%)`,
          width: "100%",
          perspective: "2000px",
        }}
      >
        {/* Device Container with 3D Transform */}
        <div
          className="relative z-10"
          style={{
            transformStyle: flat ? "flat" : "preserve-3d",
            transform: flat
              ? "none"
              : device === "iphone"
              ? "rotateY(-25deg) rotateX(5deg)"
              : "rotateY(-15deg) rotateX(5deg)",
            transformOrigin: "center center",
            width: "100%",
          }}
        >
          {/* Device Frame Container - hanya menggunakan gambar PNG */}
          <div
            className="relative"
            style={{
              width: "100%",
              aspectRatio: config.aspectRatio,
            }}
          >
            {/* Screen Content - konten preview di area layar (harus di bawah frame) */}
            <div
              ref={screenRef}
              className={`absolute ${isDark ? "dark" : ""}`}
              style={{
                top: config.screenInset.top,
                right: config.screenInset.right,
                bottom: config.screenInset.bottom,
                left: config.screenInset.left,
                overflow: "hidden",
                contain: "layout style paint strict",
                isolation: "isolate",
                zIndex: 1,
                borderRadius: config.borderRadius,
                clipPath: "inset(0 round 0)",
                WebkitClipPath: "inset(0 round 0)",
                willChange: "transform",
                transform: "translateZ(0)",
                WebkitTransform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              {/* Content Wrapper dengan scaling */}
              <div
                className="h-full w-full origin-top-left"
                style={{
                  transform: `scale(${scale}) translateZ(0)`,
                  transformOrigin: "top left",
                  width: `${100 / scale}%`,
                  height: `${100 / scale}%`,
                  contain: "layout style paint size strict",
                  overflow: "hidden",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  perspective: "1000px",
                  WebkitPerspective: "1000px",
                }}
              >
                {/* Content Container dengan object-fit behavior */}
                <div
                  className={`h-full w-full ${isDark ? "dark" : ""}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    minHeight: 0,
                    contain: "layout style paint strict",
                    overflow: "hidden",
                    imageRendering: "crisp-edges",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  {children}
                </div>
              </div>
            </div>

            {/* Device Frame Image - gambar frame asli dari Apple (harus di atas konten) */}
            <img
              src={encodeURI(config.frameImage)}
              alt={`${device} frame`}
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
                console.error("Failed to load frame image:", config.frameImage);
                e.currentTarget.style.border = "2px solid red";
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
