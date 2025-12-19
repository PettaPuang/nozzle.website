"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Droplets, Gauge, TrendingUp, HandCoins } from "lucide-react";
import { ProductBadge } from "@/components/reusable/form";
import { TankHistoryTable } from "@/components/gas-stations/tank/tank-history-table";
import { UnloadForm } from "@/components/gas-stations/tank/unload-form";
import { TankReadingForm } from "@/components/gas-stations/tank/tank-reading-form";
import { TitipanFillForm } from "@/components/gas-stations/tank/titipan-fill-form";
import { getTankHistory } from "@/lib/actions/tank-history.actions";
import { formatNumber } from "@/lib/utils/format-client";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  nowUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import { isWithinOperationalHours } from "@/lib/utils/operational-time";
import {
  createUnload,
  hasApprovedPurchaseForTanks,
} from "@/lib/actions/unload.actions";
import { createTitipanFill } from "@/lib/actions/titipan.actions";
import {
  createTankReading,
  hasPendingTankReadingByTank,
  canInputTankReadingToday,
} from "@/lib/actions/tank-reading.actions";
import { toast } from "sonner";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type { TankWithStock } from "@/lib/services/operational.service";
import type {
  TankDailyReportItem,
  TankSummary,
} from "@/lib/services/tank-history.service";

type TankDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank: TankWithStock | null;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  userRole: RoleCode;
};

export function TankDetailSheet({
  open,
  onOpenChange,
  tank,
  gasStationOpenTime,
  gasStationCloseTime,
  userRole,
}: TankDetailSheetProps) {
  const router = useRouter();
  const [dailyReport, setDailyReport] = useState<TankDailyReportItem[]>([]);
  const [summary, setSummary] = useState<TankSummary>({
    currentStock: 0,
    totalUnloadThisMonth: 0,
    totalTitipanThisMonth: 0,
    totalSalesThisMonth: 0,
    totalPumpTestThisMonth: 0,
    totalVariance: 0,
    latestReading: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [unloadFormOpen, setUnloadFormOpen] = useState(false);
  const [titipanFillFormOpen, setTitipanFillFormOpen] = useState(false);
  const [tankReadingFormOpen, setTankReadingFormOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasLO, setHasLO] = useState(false);
  const [hasPendingTankReading, setHasPendingTankReading] = useState(false);
  const [hasTankReadingToday, setHasTankReadingToday] = useState(false);
  const [previousTankId, setPreviousTankId] = useState<string | null>(null);

  // Close forms ketika tank berubah
  useEffect(() => {
    if (tank?.id && previousTankId && tank.id !== previousTankId) {
      setUnloadFormOpen(false);
      setTitipanFillFormOpen(false);
      setTankReadingFormOpen(false);
    }
    if (tank?.id) {
      setPreviousTankId(tank.id);
    }
  }, [tank?.id, previousTankId]);

  // Reset state saat sheet ditutup
  useEffect(() => {
    if (!open) {
      setHasPendingTankReading(false);
      setHasTankReadingToday(false);
    }
  }, [open]);

  // Check pending tank reading and reading today when tank changes or sheet opens
  useEffect(() => {
    const checkTankReadingStatus = async () => {
      if (!tank?.id || !open) {
        return;
      }

      try {
        const [pendingResult, todayResult] = await Promise.all([
          hasPendingTankReadingByTank(tank.id),
          canInputTankReadingToday(tank.id),
        ]);

        if (pendingResult.success && pendingResult.data) {
          setHasPendingTankReading(
            (pendingResult.data as { hasPending: boolean }).hasPending
          );
        } else {
          setHasPendingTankReading(false);
        }

        if (todayResult.success && todayResult.data) {
          const data = todayResult.data as {
            canInput: boolean;
            hasReadingToday: boolean;
          };
          setHasTankReadingToday(data.hasReadingToday);
        } else {
          setHasTankReadingToday(false);
        }
      } catch (error) {
        console.error("Error checking tank reading status:", error);
        setHasPendingTankReading(false);
        setHasTankReadingToday(false);
      }
    };

    checkTankReadingStatus();
  }, [tank?.id, refreshTrigger, open]);

  // Fetch data when tank changes or refresh triggered
  useEffect(() => {
    const fetchData = async () => {
      if (!tank) return;

      // Default: last 30 days
      // Gunakan tanggal local hari ini untuk endDate agar data hari ini muncul
      const todayLocalUTC = getTodayLocalAsUTC();

      const dateRange = {
        from: startOfDayUTC(addDaysUTC(todayLocalUTC, -29)),
        to: endOfDayUTC(todayLocalUTC),
      };

      setIsLoading(true);
      try {
        const [historyResult, loResult] = await Promise.all([
          getTankHistory(tank.id, dateRange.from, dateRange.to),
          hasApprovedPurchaseForTanks([tank.id], tank.gasStationId),
        ]);

        if (historyResult.success && historyResult.data) {
          setDailyReport((historyResult.data as any).dailyReport);
          setSummary((historyResult.data as any).summary);
        }

        // Check if tank has LO
        setHasLO(loResult[tank.id] || false);
      } catch (error) {
        console.error("Failed to fetch tank data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && tank) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tank?.id, refreshTrigger]);

  const handleUnloadSubmit = async (data: any) => {
    // Validasi: Pastikan tankId yang dikirim sesuai dengan tank yang sedang dibuka
    if (!tank || data.tankId !== tank.id) {
      toast.error(
        "Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi."
      );
      setUnloadFormOpen(false);
      return;
    }

    // Force update tankId dari tank prop untuk memastikan konsistensi
    const validatedData = {
      ...data,
      tankId: tank.id,
    };

    const result = await createUnload(validatedData);
    if (result.success) {
      toast.success("Unload BBM berhasil disimpan!");
      setUnloadFormOpen(false);
      router.refresh(); // Refresh server component data
      setRefreshTrigger((prev) => prev + 1); // Refetch sheet data
      // Refresh LO status
      if (tank) {
        const loResult = await hasApprovedPurchaseForTanks(
          [tank.id],
          tank.gasStationId
        );
        setHasLO(loResult[tank.id] || false);
      }
    } else {
      toast.error(result.message || "Gagal menyimpan unload BBM");
    }
  };

  const handleTankReadingSubmit = async (data: any) => {
    const result = await createTankReading(data);

    if (result.success) {
      toast.success("Tank reading berhasil disimpan!");
      setTankReadingFormOpen(false);
      router.refresh(); // Refresh server component data
      setRefreshTrigger((prev) => prev + 1); // Refetch sheet data (termasuk cek pending)
    } else {
      toast.error(result.message || "Gagal menyimpan tank reading");
    }
  };

  const handleTitipanFillSubmit = async (data: any) => {
    // Validasi: Pastikan tankId yang dikirim sesuai dengan tank yang sedang dibuka
    if (!tank || data.tankId !== tank.id) {
      toast.error(
        "Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi."
      );
      setTitipanFillFormOpen(false);
      return;
    }

    // Force update tankId dari tank prop untuk memastikan konsistensi
    const validatedData = {
      ...data,
      tankId: tank.id,
    };

    const result = await createTitipanFill(validatedData);
    if (result.success) {
      toast.success("Isi titipan berhasil disimpan!");
      setTitipanFillFormOpen(false);
      router.refresh(); // Refresh server component data
      setRefreshTrigger((prev) => prev + 1); // Refetch sheet data
    } else {
      toast.error(result.message || "Gagal menyimpan isi titipan");
    }
  };

  if (!tank) return null;

  const currentStock = tank.currentStock || 0;

  const canPerformUnload = hasPermission(userRole, [
    "UNLOADER",
    "ADMINISTRATOR",
    "DEVELOPER",
  ]);
  const canPerformTankReading = hasPermission(userRole, [
    "UNLOADER",
    "ADMINISTRATOR",
    "DEVELOPER",
  ]);

  // Cek apakah dalam jam operasional (menggunakan waktu local browser untuk visibility button)
  // Karena openTime/closeTime diinput sebagai waktu local, kita perlu cek menggunakan waktu local juga
  const isOperational = (() => {
    if (!gasStationOpenTime || !gasStationCloseTime) return false;

    const now = new Date(); // Waktu local browser
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = gasStationOpenTime.split(":").map(Number);
    const [closeHour, closeMinute] = gasStationCloseTime.split(":").map(Number);
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    // Handle case closeTime melewati midnight
    if (closeTimeInMinutes < openTimeInMinutes) {
      return (
        currentTime >= openTimeInMinutes || currentTime <= closeTimeInMinutes
      );
    }

    // Normal case
    return (
      currentTime >= openTimeInMinutes && currentTime <= closeTimeInMinutes
    );
  })();

  // Button visible jika:
  // 1. User punya permission (ADMINISTRATOR, DEVELOPER, UNLOADER)
  // 2. Di luar jam operasional (tank reading dilakukan di luar jam operasional)
  // 3. Tidak ada reading PENDING
  // 4. Tidak ada reading APPROVED/PENDING untuk tanggal operasional hari ini
  const showTankReadingButton =
    canPerformTankReading &&
    !isOperational &&
    !hasPendingTankReading &&
    !hasTankReadingToday;

  // Button Unload/Titipan visible jika:
  // 1. User punya permission
  // 2. Belum ada tank reading untuk operational date hari ini
  // Reason: Setelah tank reading (closing), tidak boleh ada IN/OUT lagi untuk hari itu
  // Jika sudah ada tank reading hari ini, tunggu sampai jam 00:01 (besok) untuk unload/titipan masuk ke tanggal berikutnya
  const showUnloadTitipanButton = canPerformUnload && !hasTankReadingToday;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto p-2 lg:p-4">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <SheetTitle className="text-base lg:text-2xl">
                {tank.name}
              </SheetTitle>
              <div className="mt-1 lg:mt-2">
                <ProductBadge
                  productName={tank.product.name}
                  ron={tank.product.ron}
                  showRON={true}
                  className="text-[10px] lg:text-xs"
                />
              </div>
            </div>
          </SheetHeader>

          {/* Stats Cards - 3 Columns */}
          <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mt-1.5 lg:mt-2">
            {/* Total In (Unload + Titipan) */}
            <div className="bg-green-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 text-green-600" />
                <span className="text-[10px] lg:text-xs text-muted-foreground">
                  Total In (bulan ini)
                </span>
              </div>
              <p className="text-base lg:text-xl font-bold text-green-600 font-mono mb-1">
                {formatNumber(
                  summary.totalUnloadThisMonth +
                    (summary.totalTitipanThisMonth || 0)
                )}{" "}
                L
              </p>
              <div className="grid grid-cols-2 gap-1 text-[9px] lg:text-xs text-muted-foreground">
                <div>
                  Unload: {formatNumber(summary.totalUnloadThisMonth)} L
                </div>
                <div>
                  Titipan: {formatNumber(summary.totalTitipanThisMonth || 0)} L
                </div>
              </div>
            </div>

            {/* Total Out (Sales + Pump Test) */}
            <div className="bg-orange-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <Gauge className="h-3 w-3 lg:h-4 lg:w-4 text-orange-600" />
                <span className="text-[10px] lg:text-xs text-muted-foreground">
                  Total Out (bulan ini)
                </span>
              </div>
              <p className="text-base lg:text-xl font-bold text-orange-600 font-mono mb-1">
                {formatNumber(
                  summary.totalSalesThisMonth +
                    (summary.totalPumpTestThisMonth || 0)
                )}{" "}
                L
              </p>
              <div className="grid grid-cols-2 gap-1 text-[9px] lg:text-xs text-muted-foreground">
                <div>Sales: {formatNumber(summary.totalSalesThisMonth)} L</div>
                <div>
                  Test: {formatNumber(summary.totalPumpTestThisMonth || 0)} L
                </div>
              </div>
            </div>

            {/* Variance */}
            <div className="bg-purple-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 text-purple-600" />
                <span className="text-[10px] lg:text-xs text-muted-foreground">
                  Variance (bulan ini)
                </span>
              </div>
              <p
                className={`text-base lg:text-xl font-bold font-mono ${
                  summary.totalVariance < 0 ? "text-red-600" : "text-purple-600"
                }`}
              >
                {summary.totalVariance < 0 ? "-" : "+"}
                {formatNumber(Math.abs(summary.totalVariance))} L
              </p>
              <p className="text-[9px] lg:text-xs text-muted-foreground">
                {summary.totalVariance < 0 ? "Loss" : "Gain"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky top-0 bg-white border-y py-1.5 lg:py-2 flex gap-1.5 lg:gap-2 z-10 justify-between mt-1.5 lg:mt-2">
            <div className="text-sm lg:text-lg font-semibold flex items-center">
              Daily Reconciliation Report
            </div>
            <div className="flex gap-1 lg:gap-2">
              {showUnloadTitipanButton && hasLO && (
                <Button
                  onClick={() => setUnloadFormOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1 lg:gap-2 text-xs lg:text-sm"
                >
                  <Droplets className="h-3 w-3 lg:h-4 lg:w-4" />
                  Unload BBM
                </Button>
              )}
              {showUnloadTitipanButton &&
                tank.hasTitipan === true &&
                Array.isArray(tank.titipanNames) &&
                tank.titipanNames.length > 0 && (
                  <Button
                    onClick={() => setTitipanFillFormOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1 lg:gap-2 text-xs lg:text-sm"
                  >
                    <HandCoins className="h-3 w-3 lg:h-4 lg:w-4" />
                    Isi Titipan
                  </Button>
                )}
              {showTankReadingButton && (
                <Button
                  onClick={() => setTankReadingFormOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1 lg:gap-2 text-xs lg:text-sm"
                >
                  <Gauge className="h-3 w-3 lg:h-4 lg:w-4" />
                  Tank Reading
                </Button>
              )}
            </div>
          </div>

          {/* History Table */}
          <div className="mt-1.5 lg:mt-2">
            <TankHistoryTable dailyReport={dailyReport} isLoading={isLoading} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Forms */}
      {showUnloadTitipanButton && hasLO && (
        <UnloadForm
          key={tank.id}
          open={unloadFormOpen}
          onOpenChange={setUnloadFormOpen}
          tankId={tank.id}
          tankName={tank.name}
          tankCapacity={tank.capacity}
          currentStock={currentStock}
          productName={tank.product.name}
          productRon={tank.product.ron}
          gasStationId={tank.gasStationId}
          userRole={userRole}
          onSubmit={handleUnloadSubmit}
        />
      )}
      {showUnloadTitipanButton &&
        tank.hasTitipan === true &&
        Array.isArray(tank.titipanNames) &&
        tank.titipanNames.length > 0 && (
          <TitipanFillForm
            key={`titipan-${tank.id}`}
            open={titipanFillFormOpen}
            onOpenChange={setTitipanFillFormOpen}
            tankId={tank.id}
            tankName={tank.name}
            tankCapacity={tank.capacity}
            currentStock={currentStock}
            productName={tank.product.name}
            productRon={tank.product.ron}
            gasStationId={tank.gasStationId}
            onSubmit={handleTitipanFillSubmit}
          />
        )}
      {canPerformTankReading && (
        <TankReadingForm
          open={tankReadingFormOpen}
          onOpenChange={setTankReadingFormOpen}
          tankId={tank.id}
          tankName={tank.name}
          tankCapacity={tank.capacity}
          currentStock={currentStock}
          productName={tank.product.name}
          productRon={tank.product.ron}
          gasStationOpenTime={gasStationOpenTime}
          gasStationCloseTime={gasStationCloseTime}
          onSubmit={handleTankReadingSubmit}
        />
      )}
    </>
  );
}
