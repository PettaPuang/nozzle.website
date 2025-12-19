"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Fuel, LogIn, LogOut } from "lucide-react";
import { TankBadge, ShiftBadge } from "@/components/reusable/badges";
import { NozzleCard } from "./nozzle-card";
import { CheckInSheetV2 as CheckInSheet } from "@/components/gas-stations/station/check-in-form-v2";
import { CheckOutSheetV2 as CheckOutSheet } from "@/components/gas-stations/station/check-out-form-v2";
import { StationDetailSheet } from "@/components/gas-stations/station/station-detail-sheet";
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
import type { OperationalDataForClient } from "@/lib/services/operational.service";
import { motion, AnimatePresence } from "framer-motion";
import { PERTAMINA_COLORS } from "@/lib/utils/product-colors";
import { getStationShiftsWithSales } from "@/lib/actions/operator.actions";
import type { OperatorShiftHistory } from "@/lib/services/operator.service";
import { startOfDayUTC, endOfDayUTC, nowUTC } from "@/lib/utils/datetime";

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
  userId?: string; // Tambahkan userId untuk validasi check-out
  userActiveShiftInOtherStation?: {
    stationCode: string;
    stationName: string;
    gasStationName: string;
  } | null;
  onCheckInSuccess?: (stationCode: string, stationName: string) => void;
  onCheckOutSuccess?: () => void;
};

export function StationCard({
  station,
  canOperate,
  gasStationId,
  gasStationOpenTime,
  gasStationCloseTime,
  userRole,
  activeShift,
  userActiveShiftInOtherStation,
  userId,
  onCheckInSuccess,
  onCheckOutSuccess,
}: StationCardProps) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [shiftData, setShiftData] = useState(activeShift);
  const [todayShifts, setTodayShifts] = useState<
    Array<
      OperatorShiftHistory & {
        operator: { id: string; name: string; avatar?: string | null };
        status: string;
      }
    >
  >([]);

  // Initial check in validation (menggunakan waktu local browser)
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

  const [checkInValidation, setCheckInValidation] = useState(
    getInitialCheckInValidation()
  );
  const router = useRouter();

  useEffect(() => {
    // Jika station occupied oleh user lain, buat shiftData dari occupiedByOperator
    if (!activeShift && station.isOccupied && station.occupiedByOperator) {
      setShiftData({
        id: "",
        operatorId: station.occupiedBy ?? undefined,
        shift: station.occupiedByOperator.shift || "",
        startTime: station.occupiedByOperator.startTime || new Date(),
        status: "STARTED",
        hasOpenReading: false,
        hasCloseReading: false,
        operator: {
          name:
            station.occupiedByOperator.name ||
            station.occupiedByOperator.username,
          avatar: station.occupiedByOperator.avatar || null,
        },
      });
    } else {
      setShiftData(activeShift);
    }
  }, [
    activeShift,
    station.code,
    station.isOccupied,
    station.occupiedBy,
    station.occupiedByOperator,
  ]);

  // Fetch today's shift history when no active shift
  useEffect(() => {
    const fetchTodayShifts = async () => {
      if (!shiftData && station.id) {
        try {
          const today = nowUTC();
          const result = await getStationShiftsWithSales(
            station.id,
            startOfDayUTC(today),
            endOfDayUTC(today)
          );
          if (result.success && result.data) {
            const sortedData = [...(result.data as any[])].sort((a, b) => {
              const shiftOrder: Record<string, number> = {
                MORNING: 1,
                AFTERNOON: 2,
                NIGHT: 3,
              };
              const orderA = shiftOrder[a.shift] || 999;
              const orderB = shiftOrder[b.shift] || 999;
              return orderA - orderB;
            });
            setTodayShifts(
              sortedData as Array<
                OperatorShiftHistory & {
                  operator: {
                    id: string;
                    name: string;
                    avatar?: string | null;
                  };
                  status: string;
                }
              >
            );
          }
        } catch (error) {
          console.error("Failed to fetch today shifts:", error);
        }
      } else {
        setTodayShifts([]);
      }
    };

    fetchTodayShifts();
  }, [shiftData, station.id]);

  // Update check in validation periodically to reflect current time (menggunakan waktu local browser)
  useEffect(() => {
    const updateValidation = () => {
      if (!gasStationOpenTime || !gasStationCloseTime) {
        setCheckInValidation({
          canCheckIn: true,
          reason: "Jam operational belum diatur",
        });
        return;
      }

      // Gunakan waktu local browser untuk visibility button
      const now = new Date(); // Waktu local browser
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [openHour, openMinute] = gasStationOpenTime.split(":").map(Number);
      const [closeHour, closeMinute] = gasStationCloseTime
        .split(":")
        .map(Number);
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
        setCheckInValidation({
          canCheckIn: false,
          reason: `Check in hanya bisa dilakukan antara jam operasional (${gasStationOpenTime} - ${gasStationCloseTime})`,
        });
      } else {
        setCheckInValidation({
          canCheckIn: true,
          reason: "OK",
        });
      }
    };

    // Update immediately
    updateValidation();

    // Update every 10 seconds to reflect time changes (more responsive)
    const interval = setInterval(updateValidation, 10000);

    return () => clearInterval(interval);
  }, [gasStationOpenTime, gasStationCloseTime]);

  const handleCheckInSuccess = () => {
    onCheckInSuccess?.(station.code, station.name);
  };

  const handleCheckOutSuccess = () => {
    onCheckOutSuccess?.();
  };

  // Satu fungsi untuk menentukan apakah bisa check in/out
  const canPerformCheckIn = hasPermission(userRole, [
    "OPERATOR",
    "ADMINISTRATOR",
    "DEVELOPER",
  ]);

  // User tidak bisa check-in jika sudah check-in di station lain
  // Cek apakah active shift di station lain adalah station yang berbeda dari station ini
  const hasActiveShiftInOtherStation =
    !!userActiveShiftInOtherStation &&
    userActiveShiftInOtherStation.stationCode !== station.code;
  // Station sudah digunakan oleh user lain atau user ini sudah check-in di station lain
  const isStationOccupiedByOther =
    station.isOccupied && station.occupiedBy !== userId;
  const showCheckInButton =
    canPerformCheckIn &&
    !shiftData &&
    !hasActiveShiftInOtherStation &&
    !isStationOccupiedByOther &&
    checkInValidation.canCheckIn;
  // Hanya user yang check-in di station ini yang bisa check-out
  // Cek session: userId harus sama dengan shiftData.operatorId
  const isMyShift = shiftData && userId && shiftData.operatorId === userId;
  const showCheckOutButton =
    canPerformCheckIn &&
    shiftData &&
    shiftData.status === "STARTED" &&
    isMyShift;

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
      <div className="rounded-lg border-2 p-1.5 lg:p-4 hover:shadow-sm hover:border-blue-500 hover:border-2px active:border-blue-500 active:border-2px transition-all bg-white">
        <div className="grid grid-cols-[20%_20%_60%] gap-1 lg:gap-2 items-stretch">
          {/* Section 1: Station Info - 20% */}
          <div className="space-y-1 lg:space-y-3 flex flex-col justify-between">
            <div>
              <h3
                className={cn(
                  "font-semibold text-sm lg:text-base mb-0 lg:mb-1",
                  canViewDetail &&
                    "cursor-pointer hover:text-blue-600 transition-colors"
                )}
                onClick={(e) => {
                  if (canViewDetail) {
                    e.stopPropagation();
                    setDetailSheetOpen(true);
                  }
                }}
              >
                {station.name}
              </h3>
              <Badge variant="secondary">{station.code}</Badge>
            </div>
            <div>
              <div className="text-[10px] lg:text-xs font-medium text-gray-600 mb-0.5 lg:mb-2">
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
          <div className="flex flex-col justify-between border-l border-r px-1.5 lg:px-4">
            {/* Shift Card */}
            <motion.div
              className="rounded-lg border border-gray-200 p-1 lg:p-3 flex-1 bg-card overflow-hidden"
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
                            <span className="text-[10px] text-gray-500 text-center whitespace-nowrap lg:hidden">
                              {new Date(shiftData.startTime).toLocaleTimeString(
                                "id-ID",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <span className="hidden lg:block text-sm text-gray-500 text-center whitespace-nowrap">
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
                    <div className="h-[25%] pt-0.5 lg:pt-1 border-t border-gray-200 flex items-center">
                      <p className="text-xs lg:text-base font-semibold text-gray-900 truncate w-full text-center">
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
                              <span className="hidden lg:inline text-[8px] lg:text-[10px] text-gray-500 whitespace-nowrap">
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
                            <span className="text-[8px] lg:text-[10px] font-medium text-gray-900 truncate">
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

      {/* Dialogs */}
      <CheckInSheet
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        stationId={station.id}
        gasStationId={gasStationId}
        nozzles={station.nozzles}
        gasStationOpenTime={gasStationOpenTime}
        gasStationCloseTime={gasStationCloseTime}
        onSuccess={handleCheckInSuccess}
      />

      <CheckOutSheet
        open={checkOutOpen}
        onOpenChange={setCheckOutOpen}
        operatorShiftId={shiftData?.id || ""}
        nozzles={station.nozzles}
        onSuccess={handleCheckOutSuccess}
      />

      {canViewDetail && (
        <StationDetailSheet
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          stationId={station.id}
          stationName={station.name}
          stationCode={station.code}
        />
      )}
    </>
  );
}
