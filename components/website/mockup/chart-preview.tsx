"use client";

import Image from "next/image";
import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SalesAreaChart } from "@/components/demo/report/sales-area-chart";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { MockDataService } from "@/lib/utils/mock-data";
import { useMemo } from "react";

const GAS_STATION_ID = "spbu-001";

export function ChartPreview() {
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
      <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-3 shrink-0">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-[15px] bg-blue-100 text-blue-700">
                {gasStation?.owner.name.substring(0, 2).toUpperCase() || "OD"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[15px] font-medium text-gray-900 dark:text-white">
                Selamat datang, {gasStation?.owner.name || "ownerdemo"}
              </p>
              <p className="text-[13px] text-gray-500">Owner</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {gasStation?.name || "SPBU"}
              </h1>
              <Badge variant="default" className="text-[13px] px-2.5 py-0 h-6">
                {gasStation?.status || "ACTIVE"}
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-0.5">
                <MapPin className="h-4.5 w-4.5" />
                <span>{gasStation?.address || ""}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Clock className="h-4.5 w-4.5" />
                <span>{gasStation?.openTime || "06:00"} - {gasStation?.closeTime || "22:00"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <PertaminaStripes height="h-2.5" />
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        defaultValue="report"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex justify-center px-2 pt-2 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="w-full h-7 p-0.5">
            <TabsTrigger
              value="tanks"
              className="gap-0.5 text-[12px] px-2 py-1"
            >
              <Fuel className="h-3.5 w-3.5" />
              Tanks
            </TabsTrigger>
            <TabsTrigger
              value="stations"
              className="gap-0.5 text-[12px] px-2 py-1"
            >
              <Building2 className="h-3.5 w-3.5" />
              Stations
            </TabsTrigger>
            <TabsTrigger
              value="office"
              className="gap-0.5 text-[12px] px-2 py-1"
            >
              <FileText className="h-3.5 w-3.5" />
              Office
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="gap-0.5 text-[12px] px-2 py-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Report Content */}
        <TabsContent
          value="report"
          className="flex-1 overflow-y-auto px-3 py-3 mt-0"
        >
          <div className="h-full w-full">
            <SalesAreaChart
              data={chartData}
              products={productsList}
              isLoading={false}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
