"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { TankCard } from "@/components/demo/tank/tank-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import type { TankWithStock } from "@/lib/types/demo";

const mockTanks: TankWithStock[] = [
  {
    id: "tank-001",
    code: "T01",
    name: "Tank Pertalite 1",
    capacity: 30000,
    currentStock: 12500,
    product: {
      id: "product-001",
      name: "Pertalite",
      sellingPrice: 10000,
    },
  },
  {
    id: "tank-002",
    code: "T02",
    name: "Tank Pertamax 1",
    capacity: 30000,
    currentStock: 9800,
    product: {
      id: "product-002",
      name: "Pertamax",
      sellingPrice: 12000,
    },
  },
  {
    id: "tank-003",
    code: "T03",
    name: "Tank Pertamax Turbo",
    capacity: 20000,
    currentStock: 6500,
    product: {
      id: "product-003",
      name: "Pertamax Turbo",
      sellingPrice: 14000,
    },
  },
  {
    id: "tank-004",
    code: "T04",
    name: "Tank Solar",
    capacity: 25000,
    currentStock: 8500,
    product: {
      id: "product-004",
      name: "Solar",
      sellingPrice: 9500,
    },
  },
];

export function TankPreview() {
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
        defaultValue="tanks"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex justify-center px-2 pt-2 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="w-full h-7 p-0.5">
            <TabsTrigger
              value="tanks"
              className="gap-0.5 text-[12px] px-2 py-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
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
              className="gap-0.5 text-[12px] px-2 py-1"
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tanks Content */}
        <TabsContent
          value="tanks"
          className="flex-1 overflow-y-auto px-3 py-3 mt-0"
        >
          <div className="grid grid-cols-3 gap-1.5">
            {mockTanks.map((tank, index) => (
              <motion.div
                key={tank.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <TankCard
                  tank={tank}
                  canUnload={false}
                  gasStationOpenTime="06:00"
                  gasStationCloseTime="22:00"
                  hideName={true}
                  showCodeBadgeOnMobile={true}
                  hideProductBadgeOnMobile={false}
                />
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
