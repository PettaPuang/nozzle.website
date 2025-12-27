"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Fuel, LogIn, LogOut } from "lucide-react";
import { TankBadge, ShiftBadge } from "@/components/reusable/badges";
import { NozzleCard } from "./nozzle-card";
// Demo mode: no detail sheet
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { hasPermission } from "@/lib/utils/permissions";
import type { RoleCode } from "@/lib/utils/permissions";
import type { OperationalDataForClient } from "@/lib/types/demo";
import { motion, AnimatePresence } from "framer-motion";
import { PERTAMINA_COLORS } from "@/lib/utils/product-colors";
// Demo mode: view-only, no actions
type OperatorShiftHistory = any;

type StationCardProps = {
  station: OperationalDataForClient["stations"][number];
  canOperate: boolean;
  gasStationId: string;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  userRole: RoleCode;
  activeShift?: {
    id: string;
    operatorId?: string; // Tambahkan operatorId untuk validasi
    shift: string;
    startTime: Date;
    status: string;
    hasOpenReading: boolean;
    hasCloseReading: boolean;
    operator?: {
      name: string;
      avatar?: string | null;
    };
  } | null;
  todayShifts?: Array<{
    id: string;
    shift: string;
    startTime: Date;
    endTime?: Date;
    operator?: {
      name: string;
      avatar?: string | null;
    };
  }>;
  // Demo mode: removed unused props
};

export function StationCard({
  station,
  canOperate,
  gasStationId,
  gasStationOpenTime,
  gasStationCloseTime,
  userRole,
  activeShift,
  todayShifts = [],
}: StationCardProps) {
  // Demo mode: no detail sheet
  // Use activeShift as shiftData if available
  const shiftData = activeShift || null;

  // Demo mode: no check-in validation needed
  const getInitialCheckInValidation = () => {
    if (!gasStationOpenTime || !gasStationCloseTime) {
      return {
        canCheckIn: true,
        reason: "Jam operational belum diatur",
      };
    }

    const now = new Date(); // Waktu local browser
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = gasStationOpenTime.split(":").map(Number);
    const [closeHour, closeMinute] = gasStationCloseTime.split(":").map(Number);
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    let isOperational: boolean;
    // Handle case closeTime melewati midnight
    if (closeTimeInMinutes < openTimeInMinutes) {
      isOperational =
        currentTime >= openTimeInMinutes || currentTime <= closeTimeInMinutes;
    } else {
      // Normal case
      isOperational =
        currentTime >= openTimeInMinutes && currentTime <= closeTimeInMinutes;
    }

    // Check in hanya bisa dilakukan antara jam operasional
    if (!isOperational) {
      return {
        canCheckIn: false,
        reason: `Check in hanya bisa dilakukan antara jam operasional (${gasStationOpenTime} - ${gasStationCloseTime})`,
      };
    }

    return {
      canCheckIn: true,
      reason: "OK",
    };
  };

  // Demo mode: no validation needed
  const router = useRouter();

  // Demo mode: no check-in/check-out functionality
  const showCheckInButton = false;
  const showCheckOutButton = false;

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user can view station detail (manager, owner, ownergroup, admin only)
  const canViewDetail = hasPermission(userRole, [
    "MANAGER",
    "OWNER",
    "OWNER_GROUP",
    "ADMINISTRATOR",
    "DEVELOPER",
  ]);

  return (
    <>
      <div className="rounded-lg border-2 border-gray-200 dark:border-gray-700 p-1.5 lg:p-4 hover:shadow-sm hover:border-blue-500 dark:hover:border-blue-400 hover:border-2px active:border-blue-500 dark:active:border-blue-400 active:border-2px transition-all bg-white dark:bg-gray-800">
        <div className="grid grid-cols-[20%_20%_60%] gap-1 lg:gap-2 items-stretch">
          {/* Section 1: Station Info - 20% */}
          <div className="space-y-1 lg:space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-sm lg:text-base mb-0 lg:mb-1 text-gray-900 dark:text-white">
                {station.name}
              </h3>
              <Badge variant="secondary">{station.code}</Badge>
            </div>
            <div>
              <div className="text-[10px] lg:text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5 lg:mb-2">
                Connected Tanks:
              </div>
              <div className="flex flex-wrap gap-0.5 lg:gap-1">
                {station.tankConnections.map((conn) => (
                  <TankBadge
                    key={conn.id}
                    tankCode={conn.tank.code}
                    productName={conn.tank.product.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Shift Status & Actions - 20% */}
          <div className="flex flex-col justify-between border-l border-r border-gray-200 dark:border-gray-700 px-1.5 lg:px-4">
            {/* Shift Card */}
            <motion.div
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-1 lg:p-3 flex-1 bg-card dark:bg-gray-900 overflow-hidden"
              animate={
                shiftData
                  ? {
                      backgroundColor: [
                        "rgba(0, 115, 178, 0.15)", // biru Pertamina dengan opacity 15%
                        "rgba(248,250,252,1)", // tidak ada bg (default)
                        "rgba(253, 0, 23, 0.15)", // merah Pertamina dengan opacity 15%
                        "rgba(248,250,252,1)", // tidak ada bg (default)
                        "rgba(159, 228, 0, 0.15)", // hijau Pertamina dengan opacity 15%
                        "rgba(248,250,252,1)", // tidak ada bg (default)
                        "rgba(0, 115, 178, 0.15)", // kembali ke biru
                      ],
                    }
                  : {
                      backgroundColor: "rgba(248,250,252,1)", // bg-card default
                    }
              }
              transition={
                shiftData
                  ? {
                      duration: 8,
                      repeat: Infinity,
                      repeatType: "loop",
                      ease: "easeInOut",
                    }
                  : {
                      duration: 0.25,
                      ease: "easeOut",
                    }
              }
            >
              <AnimatePresence mode="wait">
                {shiftData ? (
                  <motion.div
                    key="shift-active"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col h-full"
                  >
                    {/* Row 1 (75%): Foto | Badge + Jam */}
                    <div className="flex items-center gap-1.5 lg:gap-3 h-[75%] pb-0.5 lg:pb-1">
                      {/* Kolom 1: Avatar */}
                      <div className="flex items-center justify-center">
                        <Avatar className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl">
                          <AvatarImage
                            src={shiftData.operator?.avatar || undefined}
                            className="rounded-xl"
                          />
                          <AvatarFallback className="bg-primary text-white text-xs lg:text-base rounded-xl">
                            {shiftData.operator
                              ? getInitials(shiftData.operator.name)
                              : ""}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Kolom 2: Badge + Jam Check In - Rata Tengah */}
                      <div className="flex flex-col gap-0.5 lg:gap-1 items-center justify-center min-w-0 flex-1">
                        {shiftData.shift && (
                          <ShiftBadge
                            shift={shiftData.shift}
                            className="text-[10px] lg:text-xs w-fit mx-auto"
                          />
                        )}
                        {shiftData.startTime && (
                          <>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center whitespace-nowrap lg:hidden">
                              {new Date(shiftData.startTime).toLocaleTimeString(
                                "id-ID",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <span className="hidden lg:block text-sm text-gray-500 dark:text-gray-400 text-center whitespace-nowrap">
                              Check In:{" "}
                              {new Date(shiftData.startTime).toLocaleTimeString(
                                "id-ID",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Row 2 (25%): Nama */}
                    <div className="h-[25%] pt-0.5 lg:pt-1 border-t border-gray-200 dark:border-gray-700 flex items-center">
                      <p className="text-xs lg:text-base font-semibold text-gray-900 dark:text-white truncate w-full text-center">
                        {shiftData.operator?.name}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  todayShifts.length > 0 && (
                    <motion.div
                      key="shift-empty"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col h-full"
                    >
                      {/* Histori Check In Hari Ini */}
                      <div className="flex flex-col gap-1 lg:gap-1.5 h-full overflow-y-auto">
                        {todayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="flex items-center gap-1 lg:gap-1.5 justify-start flex-wrap"
                          >
                            {shift.shift && (
                              <ShiftBadge
                                shift={shift.shift}
                                className="text-[8px] lg:text-[10px] w-fit"
                              />
                            )}
                            {shift.startTime && (
                              <span className="hidden lg:inline text-[8px] lg:text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {new Date(shift.startTime).toLocaleTimeString(
                                  "id-ID",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                                {shift.endTime && (
                                  <>
                                    <span className="mx-0.5">s/d</span>
                                    {new Date(shift.endTime).toLocaleTimeString(
                                      "id-ID",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </>
                                )}
                              </span>
                            )}
                            <span className="text-[8px] lg:text-[10px] font-medium text-gray-900 dark:text-white truncate">
                              {shift.operator?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </motion.div>

            {/* Action Buttons */}
            <div className="mt-0.5 lg:mt-3 space-y-0.5 lg:space-y-2">
              {showCheckInButton && (
                <Button
                  size="sm"
                  onClick={() => setCheckInOpen(true)}
                  className="w-full text-[9px] lg:text-sm h-6 lg:h-9"
                >
                  <LogIn className="mr-0.5 lg:mr-2 h-2.5 w-2.5 lg:h-4 lg:w-4" />
                  Check In
                </Button>
              )}

              {showCheckOutButton && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setCheckOutOpen(true)}
                  className="w-full text-[9px] lg:text-sm h-6 lg:h-9"
                >
                  <LogOut className="mr-0.5 lg:mr-2 h-2.5 w-2.5 lg:h-4 lg:w-4" />
                  Check Out
                </Button>
              )}
            </div>
          </div>

          {/* Section 3: Nozzles - 60% */}
          <div className="min-w-0 flex flex-col pr-1.5 lg:pr-2">
            <div
              className={cn(
                "grid gap-0.5 lg:gap-2 flex-1 auto-rows-fr",
                station.nozzles.length <= 4 ? "grid-cols-4" : "grid-cols-6"
              )}
            >
              {station.nozzles.map((nozzle, index) => (
                <NozzleCard
                  key={nozzle.id}
                  nozzle={nozzle}
                  latestReading={nozzle.latestReading}
                  isActive={!!shiftData}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Demo mode: no detail sheet */}
    </>
  );
}
