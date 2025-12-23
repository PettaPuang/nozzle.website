"use client";

import { StationCard } from "@/components/demo/station/station-card";
import type { OperationalDataForClient } from "@/lib/types/demo";
import type { RoleCode } from "@/lib/utils/permissions";

type StationsTabContentProps = {
  stations: OperationalDataForClient["stations"];
  gasStationId: string;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  userRole: RoleCode;
};

export function StationsTabContent({
  stations,
  gasStationId,
  gasStationOpenTime,
  gasStationCloseTime,
  userRole,
}: StationsTabContentProps) {
  // Demo mode: view-only, no detail sheet, no actions
  return (
    <>
      {stations.length > 0 ? (
        <div className="space-y-2 lg:space-y-3">
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              canOperate={false}
              gasStationId={gasStationId}
              activeShift={station.activeShift}
              gasStationOpenTime={gasStationOpenTime}
              gasStationCloseTime={gasStationCloseTime}
              userRole={userRole}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium">Belum ada station</p>
        </div>
      )}
    </>
  );
}
