"use client";

import { Badge } from "@/components/ui/badge";
import { ProductBadge } from "@/components/reusable/badges";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OperationalDataForClient } from "@/lib/types/demo";

type NozzleCardProps = {
  nozzle: OperationalDataForClient["stations"][number]["nozzles"][number];
  latestReading?: {
    id: string;
    reading: number;
    createdAt: Date;
  } | null;
  isActive: boolean;
  index: number;
};

export function NozzleCard({
  nozzle,
  latestReading,
  isActive,
  index,
}: NozzleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-lg border p-1 lg:p-2 flex flex-col items-center justify-center gap-1 lg:gap-2 bg-white",
        isActive && "border-blue-500 bg-blue-50/50"
      )}
    >
      {/* Nozzle Code Badge */}
      <Badge
        variant="secondary"
        className="text-[8px] lg:text-xs w-full justify-center"
      >
        {nozzle.code}
      </Badge>

      {/* Product Badge */}
      <ProductBadge
        productName={nozzle.product.name}
        className="text-[8px] lg:text-xs w-full justify-center"
      />

      {/* Latest Reading */}
      {latestReading && (
        <div className="text-[8px] lg:text-xs text-gray-600 text-center">
          {latestReading.reading.toLocaleString("id-ID")} L
        </div>
      )}
    </motion.div>
  );
}
