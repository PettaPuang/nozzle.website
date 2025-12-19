"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getProductColor } from "@/lib/utils/product-colors";
import { formatNumber } from "@/lib/utils/format-client";
import type { OperationalDataForClient } from "@/lib/services/operational.service";

type NozzleCardProps = {
  nozzle: OperationalDataForClient["stations"][number]["nozzles"][number];
  latestReading?: {
    shift: string;
    open: number | null;
    close: number | null;
    operator: string;
  };
  isActive?: boolean;
  index?: number;
};

export function NozzleCard({
  nozzle,
  latestReading,
  isActive = false,
  index = 0,
}: NozzleCardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Check if desktop size (>= 1024px)
    // App hanya menggunakan 2 ukuran: tablet kebawah (mobile + tablet) dan desktop
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const productColor = getProductColor(nozzle.product?.name || "");

  // Untuk Pertalite, border menggunakan warna lebih gelap (hijau gelap)
  // Untuk product lain, border menggunakan warna yang sama dengan background
  const borderColor = nozzle.product?.name?.toLowerCase().includes("pertalite")
    ? "#166534" // green-800 - hijau gelap untuk Pertalite
    : productColor.hex.bg;

  // Get latest reading value (close if exists, otherwise open)
  const latestValue = latestReading?.close ?? latestReading?.open;

  // Determine if this nozzle should have animation (variasi: tidak semua nozzle bergerak)
  const shouldAnimate = useMemo(() => {
    // Semua nozzle punya animasi untuk efek yang lebih hidup
    return true;
  }, [index]);

  // Generate random positions for bubbles animation (hanya jika shouldAnimate dan mounted)
  const bubbleAnimations = useMemo(() => {
    if (!isMounted || !shouldAnimate) return [];

    // Jumlah bola dikurangi untuk performa lebih baik
    const bubbleCount = 6;

    return Array.from({ length: bubbleCount }, (_, i) => {
      // Generate start position yang menghindari area tengah (35-65%)
      let startX, startY;
      do {
        startX = Math.random() * 60 + 20; // 20-80%
        startY = Math.random() * 60 + 20; // 20-80%
      } while (startX >= 35 && startX <= 65 && startY >= 35 && startY <= 65);

      // Safety check: pastikan startX dan startY valid
      if (
        typeof startX !== "number" ||
        isNaN(startX) ||
        typeof startY !== "number" ||
        isNaN(startY)
      ) {
        startX = 50; // Fallback ke tengah
        startY = 50;
      }

      // Generate smooth bouncing path dengan gerakan naik turun yang natural
      // Menghindari area tengah di mana angka totaliser berada
      const generateBouncingPath = () => {
        const path = [];
        let currentX = startX;
        let currentY = startY;

        // Area terlarang untuk angka totaliser (tengah container)
        const centerXMin = 35; // Batas kiri area tengah
        const centerXMax = 65; // Batas kanan area tengah
        const centerYMin = 35; // Batas atas area tengah
        const centerYMax = 65; // Batas bawah area tengah
        const avoidRadius = 8; // Radius tambahan untuk menghindari area

        // Velocity dengan gerakan sangat vertikal dan cepat
        let vx = (Math.random() - 0.5) * 10; // Velocity x sangat kecil untuk gerakan vertikal
        let vy = (Math.random() - 0.5) * 120 + (Math.random() > 0.5 ? 50 : -50); // Velocity y sangat besar, bias naik/turun

        // Generate titik untuk gerakan yang lebih panjang dan cepat
        const pointCount = 15 + Math.floor(Math.random() * 8); // 15-23 titik untuk gerakan lebih panjang
        const stepSize = 1.0; // Ukuran langkah lebih besar untuk gerakan lebih cepat

        for (let j = 0; j < pointCount; j++) {
          // Update posisi dengan step kecil
          currentX += vx * stepSize;
          currentY += vy * stepSize;

          // Cek apakah mendekati area tengah (zona terlarang untuk angka totaliser)
          const isNearCenter =
            currentX >= centerXMin - avoidRadius &&
            currentX <= centerXMax + avoidRadius &&
            currentY >= centerYMin - avoidRadius &&
            currentY <= centerYMax + avoidRadius;

          if (isNearCenter) {
            // Defleksi: ubah arah velocity untuk menghindari area tengah
            const centerX = 50; // Posisi tengah X
            const centerY = 50; // Posisi tengah Y
            const dx = currentX - centerX;
            const dy = currentY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
              // Normalize direction away from center
              const repelX = dx / distance;
              const repelY = dy / distance;

              // Apply repulsion force (lebih kecil pada X untuk gerakan vertikal)
              vx += repelX * 5; // Repulsion kecil untuk horizontal
              vy += repelY * 20; // Repulsion besar untuk vertikal
            }

            // Pastikan posisi tidak masuk ke area tengah
            if (currentX >= centerXMin && currentX <= centerXMax) {
              if (currentX < centerX) {
                currentX = centerXMin - avoidRadius;
                vx = Math.abs(vx) * 0.9; // Arahkan ke kiri
              } else {
                currentX = centerXMax + avoidRadius;
                vx = -Math.abs(vx) * 0.9; // Arahkan ke kanan
              }
            }

            if (currentY >= centerYMin && currentY <= centerYMax) {
              if (currentY < centerY) {
                currentY = centerYMin - avoidRadius;
                vy = Math.abs(vy) * 0.9; // Arahkan ke atas
              } else {
                currentY = centerYMax + avoidRadius;
                vy = -Math.abs(vy) * 0.9; // Arahkan ke bawah
              }
            }
          }

          // Bounce off edges dengan efek bouncing
          if (currentX < 10) {
            currentX = 10;
            vx = -vx * 0.85; // Bounce dengan sedikit kehilangan energi
          } else if (currentX > 90) {
            currentX = 90;
            vx = -vx * 0.85;
          }

          if (currentY < 10) {
            currentY = 10;
            vy = -vy * 0.85; // Bounce dengan efek pantulan
          } else if (currentY > 90) {
            currentY = 90;
            vy = -vy * 0.85;
          }

          // Tambahkan randomness untuk variasi yang lebih vertikal
          vx += (Math.random() - 0.5) * 2; // Randomness sangat kecil untuk gerakan vertikal
          vy += (Math.random() - 0.5) * 15; // Randomness lebih besar untuk variasi vertikal

          // Batasi velocity untuk gerakan vertikal yang cepat
          vx = Math.max(-15, Math.min(15, vx)); // Batas sangat kecil untuk horizontal
          vy = Math.max(-130, Math.min(130, vy)); // Batas besar untuk vertikal cepat

          // Safety check: pastikan currentX dan currentY valid sebelum push
          if (
            typeof currentX === "number" &&
            !isNaN(currentX) &&
            typeof currentY === "number" &&
            !isNaN(currentY)
          ) {
            path.push({ x: currentX, y: currentY });
          }
        }

        // Safety check: pastikan path memiliki minimal 1 titik valid
        if (path.length === 0) {
          path.push({ x: startX, y: startY });
        }

        return path;
      };

      const bouncingPath = generateBouncingPath();
      // Timing: langsung bergerak cepat (5 detik), tidak ada muncul dan hilang
      const fastMoveDuration = 5;
      const totalDuration = 5;

      // Variasi ukuran bola untuk 6 bola
      // App hanya menggunakan 2 ukuran: tablet kebawah (mobile + tablet) dan desktop
      // Ukuran lebih kecil untuk mobile dan tablet (< 1024px)
      const sizes = isDesktop
        ? [10, 9, 8, 7, 6, 5] // Ukuran normal untuk desktop (>= 1024px)
        : [7, 6, 5, 4, 3, 2.5]; // Ukuran lebih kecil untuk mobile dan tablet (< 1024px)

      // Delay yang lebih tersebar agar tidak muncul/hilang bersamaan
      // Total duration 8 detik, delay tersebar dalam range 0-8 detik
      const baseDelay = (i * totalDuration) / bubbleCount; // Distribusi merata dalam total duration
      const randomOffset = Math.random() * 1.5; // Random offset untuk variasi
      const delay = baseDelay + randomOffset;

      return {
        key: i,
        size: sizes[i] || 8,
        initialX: startX,
        initialY: startY,
        path: bouncingPath,
        totalDuration,
        delay,
      };
    });
  }, [nozzle.id, index, shouldAnimate, isMounted, isDesktop]);

  return (
    <div className="relative rounded-lg border-2 border-gray-200 overflow-hidden bg-white h-full w-full min-w-0 flex flex-col">
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div
          className="flex flex-col items-center justify-center p-1.5 lg:p-2.5 flex-3 min-h-0 gap-0.5 lg:gap-1 border-b"
          style={{
            backgroundColor: productColor.hex.bg,
            color: productColor.hex.text,
          }}
        >
          <div className="flex flex-col items-center gap-0.5 lg:gap-1 min-w-0 w-full">
            <div
              className="text-[10px] lg:text-xs text-center opacity-90"
              style={{ color: productColor.hex.text }}
            >
              Nozzle
            </div>
            <div
              className="text-xs lg:text-sm text-center font-medium opacity-90"
              style={{ color: productColor.hex.text }}
            >
              {nozzle.code}
            </div>
            <div
              className="text-[10px] lg:text-sm text-center font-medium opacity-80"
              style={{ color: productColor.hex.text }}
            >
              {nozzle.product.name}
            </div>
          </div>
        </div>

        {/* Reading Info */}
        <div className="p-1 lg:p-2 flex-1 flex items-center justify-center min-h-0 relative overflow-hidden">
          {/* Animated bubbles/balls - hanya muncul saat check in (isActive) dan setelah mounted */}
          {isMounted && isActive && bubbleAnimations.length > 0 && (
            <>
              {bubbleAnimations.map((bubble) => {
                if (!bubble.path || bubble.path.length === 0) return null;

                const validPath = bubble.path.filter(
                  (p) => p && typeof p.x === "number" && typeof p.y === "number"
                );
                if (validPath.length === 0) return null;

                // Sample path untuk animasi
                const sampled = [validPath[0]];
                const step = Math.max(1, Math.floor(validPath.length / 5));
                for (let i = step; i < validPath.length; i += step) {
                  if (
                    validPath[i] &&
                    typeof validPath[i].x === "number" &&
                    typeof validPath[i].y === "number"
                  ) {
                    sampled.push(validPath[i]);
                  }
                }
                if (validPath.length > 1 && validPath[validPath.length - 1]) {
                  sampled.push(validPath[validPath.length - 1]);
                }

                if (sampled.length === 0) return null;

                const startPoint = sampled[0];
                const endPoint = sampled[sampled.length - 1];
                if (
                  !startPoint ||
                  typeof startPoint.x !== "number" ||
                  typeof startPoint.y !== "number" ||
                  !endPoint ||
                  typeof endPoint.x !== "number" ||
                  typeof endPoint.y !== "number"
                )
                  return null;

                // Gunakan semua path untuk fast movement (tidak ada slow)
                const fastPath = sampled;
                const fastKeyframeCount = fastPath.length - 1;

                // Timing: langsung bergerak cepat (5 detik), tidak ada muncul dan hilang
                const totalDuration = 5;

                // Keyframes posisi: langsung bergerak dari start ke end, lalu loop kembali ke start
                const leftKeyframes = [
                  `${startPoint.x}%`, // Start
                  ...fastPath.slice(1).map((p) => `${p.x}%`), // Fast movement (semua titik)
                  `${startPoint.x}%`, // Loop kembali ke start tanpa jeda
                ];

                const topKeyframes = [
                  `${startPoint.y}%`, // Start
                  ...fastPath.slice(1).map((p) => `${p.y}%`), // Fast movement (semua titik)
                  `${startPoint.y}%`, // Loop kembali ke start tanpa jeda
                ];

                // Times array: distribusi benar-benar merata dari 0 sampai 1, langsung loop
                // Harus sama jumlahnya dengan leftKeyframes
                const times = [
                  0, // Start
                  // Fast movement: distribusi benar-benar merata tanpa pause
                  ...Array.from({ length: fastKeyframeCount }, (_, i) => {
                    // Distribusi merata dari 0 sampai 1, setiap keyframe mendapat waktu yang sama
                    return (i + 1) / (fastKeyframeCount + 1);
                  }),
                  1, // End, langsung loop kembali ke start
                ];

                // Opacity: tetap visible sepanjang waktu (tidak ada disappear)
                // Jumlah harus sama dengan times array
                const opacityKeyframes = [
                  1, // Start - langsung visible
                  ...Array(fastKeyframeCount).fill(1), // Fast movement - visible
                  1, // End - tetap visible, langsung loop
                ];

                return (
                  <motion.div
                    key={bubble.key}
                    className="absolute rounded-full opacity-50 border"
                    style={{
                      backgroundColor: productColor.hex.bg,
                      borderColor: borderColor,
                      width: `${bubble.size}px`,
                      height: `${bubble.size}px`,
                    }}
                    initial={{
                      left: `${startPoint.x}%`,
                      top: `${startPoint.y}%`,
                      opacity: 1,
                    }}
                    animate={{
                      left: leftKeyframes,
                      top: topKeyframes,
                      opacity: opacityKeyframes,
                    }}
                    transition={{
                      duration: bubble.totalDuration,
                      repeat: Infinity,
                      ease: "linear", // Linear untuk gerakan smooth tanpa pause
                      delay: bubble.delay,
                      times: times,
                    }}
                  />
                );
              })}
            </>
          )}
          {latestReading &&
          latestValue !== null &&
          latestValue !== undefined ? (
            <div className="text-center w-full relative z-10">
              <span className="font-mono font-semibold text-sm lg:text-lg block truncate">
                {formatNumber(latestValue)}
              </span>
            </div>
          ) : (
            <div className="text-xs lg:text-sm text-gray-400 text-center">
              No reading
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
