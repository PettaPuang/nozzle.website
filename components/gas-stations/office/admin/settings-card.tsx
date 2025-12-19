"use client";

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationalDataForClient } from "@/lib/services/operational.service";
import type { ProductForClient } from "@/lib/services/product.service";
import type { ActiveRole } from "@/lib/services/role.service";

type SettingsCardProps = {
  gasStation: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    status: "ACTIVE" | "INACTIVE";
    ownerId: string;
    owner: {
      username: string;
      email: string;
      profile?: {
        name: string;
        phone?: string | null;
      } | null;
    };
    openTime: string | null;
    closeTime: string | null;
    tanks?: OperationalDataForClient["tanks"];
    userActiveShiftInOtherStation?: {
      stationCode: string;
      stationName: string;
      gasStationName: string;
    } | null;
  };
  stations: OperationalDataForClient["stations"];
  staff: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  products: ProductForClient[];
  roles: ActiveRole[];
  selected?: boolean;
  onClick?: () => void;
};

export function SettingsCard({
  gasStation,
  stations,
  staff,
  products,
  roles,
  selected = false,
  onClick,
}: SettingsCardProps) {
  const totalTanks = gasStation.tanks?.length || 0;
  const totalStations = stations.length;
  const totalNozzles = stations.reduce(
    (sum, station) => sum + (station.nozzles?.length || 0),
    0
  );
  const totalInfrastructure = totalTanks + totalStations + totalNozzles;

  // Staff & Users: staff + owner (pastikan owner tidak duplikat)
  const ownerId = gasStation.ownerId;
  const ownerInStaff = staff.some((s) => s.id === ownerId);
  const totalStaff = staff.length + (ownerInStaff ? 0 : 1); // +1 untuk owner jika belum termasuk di staff

  return (
    <div
      className={cn(
        "border rounded-lg bg-card hover:shadow-lg transition-all cursor-pointer",
        selected && "bg-blue-50 border-2 border-blue-500"
      )}
      onClick={onClick}
    >
      <div className="p-2 lg:p-3">
        <div className="flex items-center gap-1.5 lg:gap-2">
          <div className="p-1.5 bg-gray-100 rounded-lg flex items-center justify-center">
            <Settings className="h-4 w-4 text-gray-700" />
          </div>
          <div className="text-sm lg:text-base font-semibold">Admin</div>
        </div>
      </div>
    </div>
  );
}
