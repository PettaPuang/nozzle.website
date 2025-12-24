"use client";

import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SalesAreaChart } from "@/components/demo/report/sales-area-chart";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { MockDataService } from "@/lib/utils/mock-data";
import { useMemo } from "react";

const GAS_STATION_ID = "spbu-001";

export function ChartIphonePreview() {
  const salesReport = MockDataService.getSalesReport(GAS_STATION_ID);
  const products = MockDataService.getProducts(GAS_STATION_ID);
  const gasStation = useMemo(() => MockDataService.getGasStationById(GAS_STATION_ID), []);

  const chartData = useMemo(() => {
    return MockDataService.getChartData(GAS_STATION_ID);
  }, []);

  const productsList = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    [products]
  );

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-1.5 shrink-0">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[11px] bg-blue-100 text-blue-700">
                {gasStation?.owner.name.substring(0, 2).toUpperCase() || "OD"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] font-medium text-gray-900 dark:text-white">
                Selamat datang, {gasStation?.owner.name || "ownerdemo"}
              </p>
              <p className="text-[10px] text-gray-500">Owner</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[11px] font-semibold text-gray-900 dark:text-white">
                {gasStation?.name || "SPBU"}
              </h1>
              <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                {gasStation?.status || "ACTIVE"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />
                <span>{gasStation?.address || ""}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                <span>{gasStation?.openTime || "06:00"} - {gasStation?.closeTime || "22:00"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-1">
          <PertaminaStripes height="h-1" />
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        defaultValue="report"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex justify-center px-1.5 pt-1.5 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="w-full h-6 p-0.5">
            <TabsTrigger
              value="tanks"
              className="gap-0.5 text-[10px] px-1.5 py-0.5"
            >
              <Fuel className="h-2.5 w-2.5" />
              Tanks
            </TabsTrigger>
            <TabsTrigger
              value="stations"
              className="gap-0.5 text-[10px] px-1.5 py-0.5"
            >
              <Building2 className="h-2.5 w-2.5" />
              Stations
            </TabsTrigger>
            <TabsTrigger
              value="office"
              className="gap-0.5 text-[10px] px-1.5 py-0.5"
            >
              <FileText className="h-2.5 w-2.5" />
              Office
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="gap-0.5 text-[10px] px-1.5 py-0.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <FileText className="h-2.5 w-2.5" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Report Content */}
        <TabsContent
          value="report"
          className="flex-1 overflow-hidden px-1 py-1 mt-0"
        >
          <div
            className="h-full w-full origin-top-left"
            style={{
              transform: "scale(0.6)",
              width: "166.67%",
              height: "166.67%",
            }}
          >
            <div className="h-full w-full">
              <SalesAreaChart
                data={chartData}
                products={productsList}
                isLoading={false}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

