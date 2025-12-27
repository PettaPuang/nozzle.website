"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getProductColor } from "@/lib/utils/product-colors";
import { formatNumber } from "@/lib/utils/format-client";
// Demo mode: simple calculation
const calculateFillPercentage = (current: number, capacity: number) => {
  if (capacity === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / capacity) * 100)));
};
import { ProductBadge } from "@/components/reusable/badges";
import type { TankWithStock } from "@/lib/types/demo";

type TankCardProps = {
  tank: TankWithStock;
  canUnload: boolean;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  onClick?: () => void;
  hideNameOnMobile?: boolean;
  hideName?: boolean;
  showCodeBadgeOnMobile?: boolean;
  hideProductBadgeOnMobile?: boolean;
};

export function TankCard({
  tank,
  canUnload,
  gasStationOpenTime,
  gasStationCloseTime,
  onClick,
  hideNameOnMobile = false,
  hideName = false,
  showCodeBadgeOnMobile = false,
  hideProductBadgeOnMobile = false,
}: TankCardProps) {
  // Null checks untuk mencegah error
  if (!tank || !tank.product) {
    return null;
  }

  const currentStock = tank.currentStock ?? 0;
  const capacity = tank.capacity ?? 0;
  const fillPercentage = calculateFillPercentage(currentStock, capacity);
  const productColor = getProductColor(tank.product.name || "");
  const liquid = productColor.liquid;
  const fillGradient = `linear-gradient(to bottom, ${liquid.light}, ${liquid.dark})`;
  // Warna text kontras berdasarkan product color
  const textColor = productColor.text || "#1f2937";
  const textMutedColor = "#6b7280";

  // Demo mode: no click handler

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-1.5 lg:p-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-1 lg:gap-2 mb-1.5 lg:mb-3 px-0.5 lg:px-1">
        {!hideName && (
          <span
            className={cn(
              "font-semibold text-xs lg:text-sm text-gray-900 dark:text-white",
              hideNameOnMobile ? "hidden lg:inline" : ""
            )}
          >
            {tank.name || "N/A"}
          </span>
        )}
        <Badge className={cn(productColor.badge, showCodeBadgeOnMobile ? "inline-flex" : "hidden lg:inline-flex", hideName && "ml-auto")}>{tank.code || "N/A"}</Badge>
      </div>

      {/* Tank Vertical - Expanded */}
      <div className="relative flex-1 min-h-[120px] lg:min-h-[150px] mb-1.5 lg:mb-3">
        {/* Tank Container - More Rounded */}
        <div className="absolute inset-0 rounded-4xl border-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {/* Liquid Fill - from bottom */}
          {fillPercentage > 0 && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${fillPercentage}%` }}
              transition={{
                duration: 1.5,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.2,
              }}
              className="absolute left-0 right-0 bottom-0"
            >
              {/* Liquid color with gradient */}
              <div
                className="absolute inset-0"
                style={{ background: fillGradient }}
              ></div>

              {/* Wave effect */}
              <motion.div
                className="absolute left-0 right-0 top-0 h-8"
                style={{
                  background: liquid.wave,
                  opacity: 0.4,
                }}
                animate={{
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <svg
                  className="absolute w-full h-full"
                  viewBox="0 0 1000 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,50 Q250,0 500,50 T1000,50 L1000,100 L0,100 Z"
                    fill="rgba(255,255,255,0.25)"
                  />
                </svg>
              </motion.div>

              {/* Shimmer with motion */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                }}
                animate={{
                  y: ["100%", "-100%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              {/* Bubbles */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${20 + i * 30}%`,
                    bottom: 0,
                    background: liquid.bubble,
                  }}
                  animate={{
                    y: [-20, -fillPercentage * 2],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2 + i,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          )}

          {/* Product Badge */}
          <div className={cn("absolute inset-0 items-start justify-center z-10 pt-2 lg:pt-3", hideProductBadgeOnMobile ? "hidden lg:flex" : "flex")}>
            <ProductBadge
              productName={tank.product.name || ""}
              ron={tank.product.ron || undefined}
              showRON={true}
              className="text-[8px] lg:text-[10px]"
            />
          </div>

          {/* Stock/Kapasitas dan Percentage Label */}
          <div className="absolute inset-0 flex items-end justify-center z-10 pb-2 lg:pb-4">
            <div className="flex flex-col items-center">
              {fillPercentage > 0 && (
                <span
                  className={cn(
                    "text-[10px] lg:text-xs mb-0.5",
                    "drop-shadow-[0_1px_4px_rgba(255,255,255,1),0_0_6px_rgba(255,255,255,0.8)]",
                    "dark:drop-shadow-none",
                    productColor.text
                  )}
                >
                  <span className="font-extrabold">
                    {formatNumber(currentStock)}
                  </span>
                  <span className="font-bold opacity-85">
                    /{formatNumber(capacity)} L
                  </span>
                </span>
              )}
              <span
                className={cn(
                  "text-sm lg:text-base font-extrabold",
                  "drop-shadow-[0_2px_6px_rgba(255,255,255,1),0_0_8px_rgba(255,255,255,0.8)]",
                  "dark:drop-shadow-none",
                  fillPercentage > 0 ? productColor.text : "text-gray-400"
                )}
              >
                {fillPercentage > 0 ? `${fillPercentage.toFixed(0)}%` : "Empty"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
