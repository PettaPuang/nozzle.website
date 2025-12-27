"use client";

import Image from "next/image";
import { Search, MapPin, Clock, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { MockDataService } from "@/lib/utils/mock-data";
import { useMemo } from "react";

const SpbuMap = dynamic(
  () => import("@/components/demo/welcome/spbu-map").then((mod) => mod.SpbuMap),
  { ssr: false }
);

function getSpbusData() {
  const gasStations = MockDataService.getGasStations();
  return gasStations.map((gs) => ({
    id: gs.id,
    name: gs.name,
    address: gs.address,
    latitude: gs.latitude,
    longitude: gs.longitude,
    status: gs.status,
    openTime: gs.openTime,
    closeTime: gs.closeTime,
    ownerId: gs.owner.id,
  }));
}

function getOwnersData() {
  const gasStations = MockDataService.getGasStations();
  const ownersMap = new Map<
    string,
    { id: string; name: string; spbuCount: number }
  >();

  gasStations.forEach((gs) => {
    if (!ownersMap.has(gs.owner.id)) {
      ownersMap.set(gs.owner.id, {
        id: gs.owner.id,
        name: gs.owner.name,
        spbuCount: 0,
      });
    }
    const owner = ownersMap.get(gs.owner.id)!;
    owner.spbuCount += 1;
  });

  return Array.from(ownersMap.values());
}

export function WelcomeIpadPreview() {
  const mockSpbus = useMemo(() => getSpbusData(), []);
  const mockOwners = useMemo(() => getOwnersData(), []);
  const firstOwner = mockOwners[0];

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex">
      {/* Left Sidebar */}
      <div className="w-[40%] border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-normal">
            Welcome{" "}
            <span className="font-bold">{firstOwner?.name || "ownerdemo"}</span>
            <span className="text-sm text-gray-500">
              , you are an Owner
            </span>
          </h1>
          <div className="mt-3">
            <PertaminaStripes />
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Gas Station..."
              className="pl-10 h-10 text-sm"
            />
          </div>
        </div>

        {/* SPBU List - dengan scale untuk memperkecil */}
        <div className="flex-1 overflow-hidden">
          <div
            className="h-full w-full origin-top-left overflow-y-auto px-6 py-4 space-y-4"
            style={{
              transform: "scale(0.8)",
              width: "125%",
              height: "125%",
            }}
          >
          {mockOwners.map((owner) => (
            <div key={owner.id} className="space-y-2">
              {/* Owner Group Header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <ChevronDown className="h-5 w-5 text-gray-600" />
                <Image
                  src="/logo/NozzlLogomark.svg"
                  alt="Nozzl"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  {owner.name}
                </h2>
                <span className="text-sm text-gray-500">
                  ({owner.spbuCount} SPBU)
                </span>
              </div>

              {/* SPBU Cards */}
              <div className="pl-3 space-y-2">
                {mockSpbus
                  .filter((spbu) => spbu.ownerId === owner.id)
                  .map((spbu) => (
                    <div
                      key={spbu.id}
                      className="border-b border-gray-200 dark:border-gray-700 px-3 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <Image
                          src="/picture/pertaminalogo.png"
                          alt="Pertamina"
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                            {spbu.name}
                          </h3>
                          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{spbu.address}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            {spbu.openTime && spbu.closeTime && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span>
                                  {spbu.openTime} - {spbu.closeTime}
                                </span>
                              </div>
                            )}
                            <Badge
                              variant="default"
                              className="shrink-0 text-sm px-3 py-1 h-7"
                            >
                              {spbu.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="w-[60%] overflow-hidden">
        <div className="h-full w-full">
          <SpbuMap spbus={mockSpbus} />
        </div>
      </div>
    </div>
  );
}

