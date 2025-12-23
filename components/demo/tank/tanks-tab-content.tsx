"use client";

import { TankCard } from "@/components/demo/tank/tank-card";
import type { TankWithStock } from "@/lib/types/demo";

type TanksTabContentProps = {
  gasStationId: string;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  tanksWithStock: TankWithStock[];
};

export function TanksTabContent({
  gasStationOpenTime,
  gasStationCloseTime,
  tanksWithStock,
}: TanksTabContentProps) {
  // Demo mode: view-only, no detail sheet
  return (
    <>
      {tanksWithStock.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 lg:gap-4">
          {tanksWithStock.map((tank) => (
            <TankCard
              key={tank.id}
              tank={tank}
              canUnload={false}
              gasStationOpenTime={gasStationOpenTime}
              gasStationCloseTime={gasStationCloseTime}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-8">
          No tanks available
        </div>
      )}
    </>
  );
}
