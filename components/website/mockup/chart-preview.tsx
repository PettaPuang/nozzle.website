"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SalesAreaChart } from "@/components/demo/report/sales-area-chart";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { useMemo } from "react";

const mockChartData = [
  {
    date: "2024-01-01",
    Pertalite: 200,
    Pertamax: 150,
    "Pertamax Turbo": 50,
    Solar: 20,
  },
  {
    date: "2024-01-02",
    Pertalite: 220,
    Pertamax: 160,
    "Pertamax Turbo": 55,
    Solar: 15,
  },
  {
    date: "2024-01-03",
    Pertalite: 240,
    Pertamax: 170,
    "Pertamax Turbo": 60,
    Solar: 10,
  },
  {
    date: "2024-01-04",
    Pertalite: 200,
    Pertamax: 150,
    "Pertamax Turbo": 50,
    Solar: 0,
  },
  {
    date: "2024-01-05",
    Pertalite: 260,
    Pertamax: 180,
    "Pertamax Turbo": 65,
    Solar: 15,
  },
];

const mockProducts = [
  { id: "product-001", name: "Pertalite" },
  { id: "product-002", name: "Pertamax" },
  { id: "product-003", name: "Pertamax Turbo" },
  { id: "product-004", name: "Solar" },
];

export function ChartPreview() {
  const chartData = useMemo(() => mockChartData, []);
  const products = useMemo(() => mockProducts, []);

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-3 shrink-0">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-[15px] bg-blue-100 text-blue-700">
                OD
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[15px] font-medium text-gray-900 dark:text-white">
                Selamat datang, ownerdemo
              </p>
              <p className="text-[13px] text-gray-500">Owner</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                SPBU Pertamina 34-12345
              </h1>
              <Badge variant="default" className="text-[13px] px-2.5 py-0 h-6">
                ACTIVE
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-0.5">
                <MapPin className="h-4.5 w-4.5" />
                <span>Jl. Sudirman No. 123, Jakarta Pusat</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Clock className="h-4.5 w-4.5" />
                <span>06:00 - 22:00</span>
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="h-full w-full"
          >
            <SalesAreaChart
              data={chartData}
              products={products}
              isLoading={false}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
