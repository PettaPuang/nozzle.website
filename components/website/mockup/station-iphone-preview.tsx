"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, Fuel, Building2, FileText } from "lucide-react";
import { StationCard } from "@/components/demo/station/station-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

const mockStations: StationWithConnections[] = [
  {
    id: "station-001",
    code: "S01",
    name: "Station 1",
    gasStationId: "spbu-001",
    tanks: [
      {
        id: "tank-001",
        code: "T01",
        name: "Tank Pertalite 1",
        productId: "product-001",
        capacity: 30000,
        currentStock: 12500,
        product: {
          name: "Pertalite",
          sellingPrice: 10000,
        },
      },
      {
        id: "tank-002",
        code: "T02",
        name: "Tank Pertamax 1",
        productId: "product-002",
        capacity: 30000,
        currentStock: 9800,
        product: {
          name: "Pertamax",
          sellingPrice: 12000,
        },
      },
    ],
    nozzles: [
      {
        id: "nozzle-001",
        code: "N01",
        name: "Nozzle 1 - Pertalite",
        tankId: "tank-001",
        productId: "product-001",
        product: {
          name: "Pertalite",
          sellingPrice: 10000,
        },
      },
      {
        id: "nozzle-002",
        code: "N02",
        name: "Nozzle 2 - Pertamax",
        tankId: "tank-002",
        productId: "product-002",
        product: {
          name: "Pertamax",
          sellingPrice: 12000,
        },
      },
    ],
    tankConnections: [
      {
        id: "conn-001",
        tank: {
          code: "T01",
          product: {
            name: "Pertalite",
          },
        },
      },
      {
        id: "conn-002",
        tank: {
          code: "T02",
          product: {
            name: "Pertamax",
          },
        },
      },
    ],
  },
  {
    id: "station-002",
    code: "S02",
    name: "Station 2",
    gasStationId: "spbu-001",
    tanks: [
      {
        id: "tank-003",
        code: "T03",
        name: "Tank Pertamax Turbo",
        productId: "product-003",
        capacity: 20000,
        currentStock: 6500,
        product: {
          name: "Pertamax Turbo",
          sellingPrice: 14000,
        },
      },
    ],
    nozzles: [
      {
        id: "nozzle-003",
        code: "N03",
        name: "Nozzle 3 - Pertamax Turbo",
        tankId: "tank-003",
        productId: "product-003",
        product: {
          name: "Pertamax Turbo",
          sellingPrice: 14000,
        },
      },
    ],
    tankConnections: [
      {
        id: "conn-003",
        tank: {
          code: "T03",
          product: {
            name: "Pertamax Turbo",
          },
        },
      },
    ],
  },
];

export function StationIphonePreview() {
  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[11px] bg-blue-100 text-blue-700">
                OD
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] font-medium text-gray-900 dark:text-white">
                Selamat datang, ownerdemo
              </p>
              <p className="text-[10px] text-gray-500">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* SPBU Info Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5 mb-1">
          <h1 className="text-[11px] font-semibold text-gray-900 dark:text-white">
            SPBU Pertamina 34-12345
          </h1>
          <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
            ACTIVE
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
            <span>Jl. Sudirman No. 123, Jakarta Pusat</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            <span>06:00 - 22:00</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        defaultValue="stations"
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
              className="gap-0.5 text-[10px] px-1.5 py-0.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
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
              className="gap-0.5 text-[10px] px-1.5 py-0.5"
            >
              <FileText className="h-2.5 w-2.5" />
              Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Stations Content */}
        <TabsContent
          value="stations"
          className="flex-1 overflow-y-auto px-2 py-2 mt-0"
        >
          <div className="space-y-1">
            {mockStations.map((station, index) => (
              <motion.div
                key={station.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <StationCard
                  station={station}
                  canOperate={false}
                  gasStationId="spbu-001"
                  gasStationOpenTime="06:00"
                  gasStationCloseTime="22:00"
                  userRole="OWNER"
                  activeShift={null}
                />
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
