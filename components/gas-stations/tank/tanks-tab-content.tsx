"use client";

import { useState, useEffect } from "react";
import { TankCard } from "@/components/gas-stations/tank/tank-card";
import { TankDetailSheet } from "@/components/gas-stations/tank/tank-detail-sheet";
import { hasApprovedPurchaseForTanks } from "@/lib/actions/unload.actions";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type { TankWithStock } from "@/lib/services/operational.service";

type TanksTabContentProps = {
  gasStationId: string;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  tanksWithStock: TankWithStock[];
  userRole: RoleCode;
};

export function TanksTabContent({
  gasStationId,
  gasStationOpenTime,
  gasStationCloseTime,
  tanksWithStock,
  userRole,
}: TanksTabContentProps) {
  const canUnload = hasPermission(userRole, ["UNLOADER", "ADMINISTRATOR", "DEVELOPER"]);
  const [selectedTank, setSelectedTank] = useState<TankWithStock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tankCanUnloadMap, setTankCanUnloadMap] = useState<Record<string, boolean>>({});

  // Batch check purchase approved for all tanks at once
  useEffect(() => {
    const checkPurchases = async () => {
      if (!canUnload || tanksWithStock.length === 0) {
        // Initialize all to false if can't unload
        const map: Record<string, boolean> = {};
        tanksWithStock.forEach((tank) => {
          map[tank.id] = false;
        });
        setTankCanUnloadMap(map);
        return;
      }

      // Batch fetch for all tanks at once
      const tankIds = tanksWithStock.map((tank) => tank.id);
      const map = await hasApprovedPurchaseForTanks(tankIds, gasStationId);
      setTankCanUnloadMap(map);
    };

    if (tanksWithStock.length > 0) {
      checkPurchases();
    }
  }, [tanksWithStock, gasStationId, canUnload]);

  const handleTankClick = (tank: TankWithStock) => {
    setSelectedTank(tank);
    setSheetOpen(true);
  };

  return (
    <>
      {tanksWithStock.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 lg:gap-4">
          {tanksWithStock.map((tank) => (
            <TankCard
              key={tank.id}
              tank={tank}
              canUnload={tankCanUnloadMap[tank.id] ?? false}
              gasStationOpenTime={gasStationOpenTime}
              gasStationCloseTime={gasStationCloseTime}
              onClick={() => handleTankClick(tank)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-8">
          No tanks available
        </div>
      )}

      <TankDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tank={selectedTank}
        gasStationOpenTime={gasStationOpenTime}
        gasStationCloseTime={gasStationCloseTime}
        userRole={userRole}
      />
    </>
  );
}
