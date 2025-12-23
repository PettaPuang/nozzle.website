"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Search, MapPin, Clock, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";

const SpbuMap = dynamic(
  () => import("@/components/demo/welcome/spbu-map").then((mod) => mod.SpbuMap),
  { ssr: false }
);

const mockSpbus = [
  {
    id: "spbu-001",
    name: "SPBU Pertamina 34-12345",
    address: "Jl. Sudirman No. 123, Jakarta Pusat",
    latitude: -6.2088,
    longitude: 106.8456,
    status: "ACTIVE",
    openTime: "06:00",
    closeTime: "22:00",
  },
  {
    id: "spbu-002",
    name: "SPBU Pertamina 34-12346",
    address: "Jl. Gatot Subroto No. 456, Jakarta Selatan",
    latitude: -6.2297,
    longitude: 106.8003,
    status: "ACTIVE",
    openTime: "05:00",
    closeTime: "23:00",
  },
  {
    id: "spbu-003",
    name: "SPBU Pertamina 34-12347",
    address: "Jl. Thamrin No. 789, Jakarta Pusat",
    latitude: -6.1944,
    longitude: 106.8229,
    status: "INACTIVE",
    openTime: "06:00",
    closeTime: "22:00",
  },
];

const mockOwners = [
  { id: "owner-001", name: "PT. Energi Nusantara", spbuCount: 2 },
  { id: "owner-002", name: "CV. Bumi Sejahtera", spbuCount: 1 },
];

export function WelcomePreview() {
  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 overflow-hidden flex">
      {/* Left Sidebar */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-sm font-normal">
            Welcome <span className="font-bold">ownerdemo</span>
            <span className="text-xs text-gray-500">, you are an Owner</span>
          </h1>
          <div className="mt-2">
            <PertaminaStripes />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
            <Input
              placeholder="Search Gas Station..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* SPBU List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {mockOwners.map((owner, ownerIndex) => (
            <motion.div
              key={owner.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + ownerIndex * 0.1 }}
              className="space-y-1"
            >
              {/* Owner Group Header */}
              <div className="flex items-center gap-1.5 px-1.5 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <ChevronDown className="h-3 w-3 text-gray-600" />
                <Image
                  src="/logo/NozzlLogomark.svg"
                  alt="Nozzl"
                  width={12}
                  height={12}
                  className="h-3 w-3"
                />
                <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {owner.name}
                </h2>
                <span className="text-[10px] text-gray-500">
                  ({owner.spbuCount} SPBU)
                </span>
              </div>

              {/* SPBU Cards */}
              <div className="pl-2 space-y-1">
                {mockSpbus
                  .filter((spbu) =>
                    ownerIndex === 0
                      ? spbu.id === "spbu-001" || spbu.id === "spbu-002"
                      : spbu.id === "spbu-003"
                  )
                  .map((spbu, index) => (
                    <motion.div
                      key={spbu.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.3 + ownerIndex * 0.1 + index * 0.05,
                      }}
                      className="border-b border-gray-200 dark:border-gray-700 px-2 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <Image
                          src="/picture/pertaminalogo.png"
                          alt="Pertamina"
                          width={12}
                          height={12}
                          className="h-3 w-3 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {spbu.name}
                          </h3>
                          <div className="flex items-start gap-1 text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{spbu.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {spbu.openTime && spbu.closeTime && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                <span>
                                  {spbu.openTime} - {spbu.closeTime}
                                </span>
                              </div>
                            )}
                            <Badge
                              variant="default"
                              className="shrink-0 text-[10px] px-1.5 py-0 h-4"
                            >
                              {spbu.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="h-full w-full"
        >
          <SpbuMap spbus={mockSpbus} />
        </motion.div>
      </div>
    </div>
  );
}
