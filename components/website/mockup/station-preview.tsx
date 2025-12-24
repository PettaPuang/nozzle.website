"use client";

import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { StationCard } from "@/components/demo/station/station-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { MockDataService } from "@/lib/utils/mock-data";
import { useMemo } from "react";

type StationWithConnections = {
  id: string;
  code: string;
  name: string;
  gasStationId: string;
  tanks: Array<{
    id: string;
    code: string;
    name: string;
    productId: string;
    capacity: number;
    currentStock: number;
    product: {
      name: string;
      sellingPrice: number;
    };
  }>;
  nozzles: Array<{
    id: string;
    code: string;
    name: string;
    tankId: string;
    productId: string;
    product: {
      name: string;
      sellingPrice: number;
    };
  }>;
  tankConnections: Array<{
    id: string;
    tank: {
      code: string;
      product: {
        name: string;
      };
    };
  }>;
};

const GAS_STATION_ID = "spbu-001";

function getStationsData(): (StationWithConnections & {
  activeShift?: any;
  todayShifts?: any[];
})[] {
  const stations = MockDataService.getStations(GAS_STATION_ID);
  const tanks = MockDataService.getTanks(GAS_STATION_ID);
  const nozzles = MockDataService.getNozzles(GAS_STATION_ID);

  return stations.map((s) => {
    const activeShift = MockDataService.getActiveShiftByStationId(s.id);
    const todayShifts = MockDataService.getTodayShiftsByStationId(s.id);
    // Filter out active shift from todayShifts, only show completed ones
    const historyShifts = todayShifts.filter(
      (shift) => shift.status !== "ACTIVE"
    );

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      gasStationId: s.gasStationId,
      tanks: tanks
        .filter((t) => s.tanks.includes(t.id))
        .map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          productId: t.productId,
          capacity: t.capacity,
          currentStock: t.currentStock,
          product: {
            name: t.product.name,
            sellingPrice: t.product.sellingPrice,
          },
        })),
      nozzles: nozzles
        .filter((n) => n.stationId === s.id)
        .map((n) => ({
          id: n.id,
          code: n.code,
          name: n.name,
          tankId: n.tankId,
          productId: n.productId,
          product: {
            name: n.product.name,
            sellingPrice: n.product.sellingPrice,
          },
        })),
      tankConnections: tanks
        .filter((t) => s.tanks.includes(t.id))
        .map((t, index) => ({
          id: `conn-${s.id}-${t.id}`,
          tank: {
            code: t.code,
            product: {
              name: t.product.name,
            },
          },
        })),
      activeShift: activeShift || undefined,
      todayShifts: historyShifts.length > 0 ? historyShifts : undefined,
    };
  });
}

export function StationIphonePreview() {
  const mockStations = useMemo(() => getStationsData(), []);
  const gasStation = useMemo(
    () => MockDataService.getGasStationById(GAS_STATION_ID),
    []
  );

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-2 py-1 shrink-0">
        <div className="flex items-start justify-between mb-0.5">
          <div className="flex items-center gap-1">
            <Avatar className="h-4 w-4">
              <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                {gasStation?.owner.name.substring(0, 2).toUpperCase() || "OD"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[9px] font-medium text-gray-900 dark:text-white">
                Selamat datang, {gasStation?.owner.name || "ownerdemo"}
              </p>
              <p className="text-[8px] text-gray-500">Owner</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <h1 className="text-[9px] font-semibold text-gray-900 dark:text-white">
                {gasStation?.name || "SPBU"}
              </h1>
              <Badge variant="default" className="text-[8px] px-1 py-0 h-3">
                {gasStation?.status || "ACTIVE"}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-0.5">
                <MapPin className="h-2 w-2" />
                <span>{gasStation?.address || ""}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Clock className="h-2 w-2" />
                <span>
                  {gasStation?.openTime || "06:00"} -{" "}
                  {gasStation?.closeTime || "22:00"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-0.5">
          <PertaminaStripes height="h-0.5" />
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        defaultValue="stations"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex justify-center px-1 pt-1 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="w-full h-5 p-0.5">
            <TabsTrigger
              value="tanks"
              className="gap-0.5 text-[8px] px-1 py-0.5"
            >
              <Fuel className="h-2 w-2" />
              Tanks
            </TabsTrigger>
            <TabsTrigger
              value="stations"
              className="gap-0.5 text-[8px] px-1 py-0.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <Building2 className="h-2 w-2" />
              Stations
            </TabsTrigger>
            <TabsTrigger
              value="office"
              className="gap-0.5 text-[8px] px-1 py-0.5"
            >
              <FileText className="h-2 w-2" />
              Office
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="gap-0.5 text-[8px] px-1 py-0.5"
            >
              <FileText className="h-2 w-2" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Stations Content */}
        <TabsContent
          value="stations"
          className="flex-1 overflow-hidden px-1.5 py-1.5 mt-0"
        >
          <div
            className="h-full w-full origin-top-left overflow-y-auto"
            style={{
              transform: "scale(0.75)",
              width: "133.33%",
              height: "133.33%",
            }}
          >
            <div className="space-y-0.5">
              {mockStations.map((station) => (
                <div key={station.id}>
                  <StationCard
                    station={station}
                    canOperate={false}
                    gasStationId="spbu-001"
                    gasStationOpenTime="06:00"
                    gasStationCloseTime="22:00"
                    userRole="OWNER"
                    activeShift={station.activeShift}
                    todayShifts={station.todayShifts}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
