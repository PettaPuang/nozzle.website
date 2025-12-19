"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils/format-client";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";
import type { DepositWithDetails } from "@/lib/services/finance.service";
import { ShiftBadge, StatusBadge } from "@/components/reusable/badges";
import { DatePicker } from "@/components/reusable/date-picker";
import type { DateRange } from "react-day-picker";

type DepositHistoryTableProps = {
  deposits: DepositWithDetails[];
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  onViewDetail: (deposit: DepositWithDetails) => void;
  includePending?: boolean; // Jika true, include PENDING status juga
  hideTitle?: boolean; // Jika true, hide title
  title?: string; // Custom title, default "History"
  hideDatePicker?: boolean; // Jika true, hide date picker
  hideActionColumn?: boolean; // Jika true, hide kolom action dan buat row clickable
};

export function DepositHistoryTable({
  deposits,
  dateRange,
  onDateRangeChange,
  onViewDetail,
  includePending = false,
  hideTitle = false,
  title = "History",
  hideDatePicker = false,
  hideActionColumn = false,
}: DepositHistoryTableProps) {
  // Filter dan sort berdasarkan tanggal
  // Exclude status PENDING dari history (PENDING tetap di table input deposit)
  // Kecuali jika includePending = true
  const filteredAndSortedDeposits = useMemo(() => {
    const filtered = deposits.filter(
      (deposit) => {
        if (!includePending && deposit.status === "PENDING") return false;
        if (!dateRange.from || !dateRange.to) return false;
        
        const depositDate = new Date(deposit.operatorShift.date);
        return (
          depositDate >= startOfDayUTC(dateRange.from) &&
          depositDate <= endOfDayUTC(dateRange.to)
        );
      }
    );

    // Sort by date descending (terbaru dulu)
    return filtered.sort((a, b) => {
      return (
        new Date(b.operatorShift.date).getTime() -
        new Date(a.operatorShift.date).getTime()
      );
    });
  }, [deposits, dateRange, includePending]);

  // Group by tanggal, kemudian by station
  const groupedByDateAndStation = useMemo(() => {
    const dateGroups = new Map<string, Map<string, DepositWithDetails[]>>();
    filteredAndSortedDeposits.forEach((deposit) => {
      const dateKey = format(
        new Date(deposit.operatorShift.date),
        "yyyy-MM-dd"
      );
      const stationName = deposit.operatorShift.station.name;

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, new Map());
      }
      const stationGroups = dateGroups.get(dateKey)!;

      if (!stationGroups.has(stationName)) {
        stationGroups.set(stationName, []);
      }
      stationGroups.get(stationName)!.push(deposit);
    });
    return dateGroups;
  }, [filteredAndSortedDeposits]);

  // Get sorted dates (descending - terbaru dulu)
  const sortedDates = useMemo(() => {
    return Array.from(groupedByDateAndStation.keys()).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedByDateAndStation]);

  // Helper function to calculate total setoran, free fuel, coupon, and titipan
  const getTotalSetoran = (deposit: DepositWithDetails) => {
    const totalPayment = deposit.depositDetails
      ? deposit.depositDetails.reduce(
          (sum, detail) => sum + detail.operatorAmount,
          0
        )
      : 0;

    // Parse free fuel, coupon, dan titipan products dari notes
    const notes = deposit.notes || "";
    let freeFuelAmount = 0;
    let couponAmount = 0;
    let titipanTotal = 0;

    const freeFuelMatch = notes.match(/Free Fuel \(Rp ([\d.,]+)\): (.+)/);
    if (freeFuelMatch) {
      freeFuelAmount = parseFloat(
        freeFuelMatch[1].replace(/\./g, "").replace(",", ".")
      );
    }

    const couponMatch = notes.match(/Coupon\/Tip \(Rp ([\d.,]+)\)/);
    if (couponMatch) {
      couponAmount = parseFloat(
        couponMatch[1].replace(/\./g, "").replace(",", ".")
      );
    }

    // Parse titipanProducts dari notes (format: TITIPAN_PRODUCTS_JSON:...)
    const titipanProductsMatch = notes.match(
      /TITIPAN_PRODUCTS_JSON:(.+?)(?:\n\n|$)/
    );
    if (titipanProductsMatch) {
      try {
        const titipanProducts: Array<{ coaId: string; amount: number }> =
          JSON.parse(titipanProductsMatch[1]);
        titipanTotal = titipanProducts.reduce(
          (sum, t) => sum + (t.amount || 0),
          0
        );
      } catch (error) {
        console.error("Error parsing titipanProducts from notes:", error);
      }
    }

    return { totalPayment, freeFuelAmount, couponAmount, titipanTotal };
  };

  if (filteredAndSortedDeposits.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between mb-1.5 lg:mb-3">
          {!hideTitle && (
            <h3 className="text-xs lg:text-sm font-semibold">{title}</h3>
          )}
          {!hideDatePicker && (
            <DatePicker
              date={dateRange}
              onSelect={(date) => {
                if (date?.from && date?.to) {
                  onDateRangeChange(date);
                }
              }}
              size="sm"
            />
          )}
        </div>
        <div className="rounded-lg border p-3 lg:p-6 text-center">
          <p className="text-xs lg:text-sm text-muted-foreground">
            Belum ada riwayat deposit
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1.5 lg:mb-3">
        {!hideTitle && (
          <h3 className="text-xs lg:text-sm font-semibold">{title}</h3>
        )}
        {!hideDatePicker && (
          <DatePicker
            date={dateRange}
            onSelect={(date) => {
              if (date?.from && date?.to) {
                onDateRangeChange(date);
              }
            }}
            size="sm"
          />
        )}
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                Tanggal
              </TableHead>
              <TableHead className="w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                Station
              </TableHead>
              <TableHead className="w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                Shift
              </TableHead>
              <TableHead className="w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                Operator
              </TableHead>
              <TableHead className="text-right w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                Sales
              </TableHead>
              <TableHead className="text-right w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                Total Setoran
              </TableHead>
              <TableHead className="text-center w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                Status
              </TableHead>
              {!hideActionColumn && (
                <TableHead className="w-[60px] lg:w-[80px] min-w-[60px] lg:min-w-[80px]"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={hideActionColumn ? 7 : 8}
                  className="text-center text-xs lg:text-sm text-muted-foreground py-4"
                >
                  Tidak ada history deposit
                </TableCell>
              </TableRow>
            ) : (
              sortedDates.flatMap((dateKey) => {
                const stationGroups = groupedByDateAndStation.get(dateKey)!;
                const sortedStations = Array.from(stationGroups.keys()).sort();
                const displayDate = format(new Date(dateKey), "dd MMM yyyy", {
                  locale: localeId,
                });

                // Calculate total rows for this date (for tanggal rowSpan)
                const totalDateRows = Array.from(stationGroups.values()).reduce(
                  (sum, deposits) => sum + deposits.length,
                  0
                );
                let dateRowIndex = 0;

                return sortedStations.flatMap((stationName) => {
                  const deposits = stationGroups.get(stationName)!;
                  // Sort deposits by shift: MORNING (1) -> AFTERNOON (2) -> NIGHT (3)
                  const sortedDeposits = [...deposits].sort((a, b) => {
                    const shiftOrder: Record<string, number> = {
                      MORNING: 1,
                      AFTERNOON: 2,
                      NIGHT: 3,
                    };
                    return (
                      (shiftOrder[a.operatorShift.shift] || 999) -
                      (shiftOrder[b.operatorShift.shift] || 999)
                    );
                  });
                  const totalStationRows = sortedDeposits.length;
                  const isFirstStation = dateRowIndex === 0;
                  const currentDateRowIndex = dateRowIndex;
                  dateRowIndex += totalStationRows;

                  return sortedDeposits.map((deposit, depositIdx) => {
                    const isFirstRow = depositIdx === 0;
                    const {
                      totalPayment,
                      freeFuelAmount,
                      couponAmount,
                      titipanTotal,
                    } = getTotalSetoran(deposit);

                    return (
                      <TableRow
                        key={deposit.id}
                        className={
                          hideActionColumn
                            ? "cursor-pointer hover:bg-muted/50"
                            : ""
                        }
                        onClick={
                          hideActionColumn
                            ? () => onViewDetail(deposit)
                            : undefined
                        }
                      >
                        {isFirstStation && isFirstRow && (
                          <TableCell
                            rowSpan={totalDateRows}
                            className="text-xs lg:text-sm font-medium align-top w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]"
                          >
                            {displayDate}
                          </TableCell>
                        )}
                        {isFirstRow && (
                          <TableCell
                            rowSpan={totalStationRows}
                            className="text-xs lg:text-sm font-medium align-top w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]"
                          >
                            {stationName}
                          </TableCell>
                        )}
                        <TableCell className="w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                          <div className="flex flex-col gap-0.5">
                            <ShiftBadge shift={deposit.operatorShift.shift} />
                            <div className="text-[10px] lg:text-xs text-muted-foreground whitespace-nowrap">
                              {deposit.operatorShift.startTime
                                ? format(
                                    new Date(deposit.operatorShift.startTime),
                                    "HH:mm"
                                  )
                                : "-"}{" "}
                              -{" "}
                              {deposit.operatorShift.endTime
                                ? format(
                                    new Date(deposit.operatorShift.endTime),
                                    "HH:mm"
                                  )
                                : "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                          {deposit.operatorShift.operator.profile?.name ||
                            deposit.operatorShift.operator.username}
                        </TableCell>
                        <TableCell className="text-right font-mono w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                          {formatCurrency(deposit.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-mono font-semibold text-xs lg:text-sm">
                              {formatCurrency(totalPayment)}
                            </div>
                            {freeFuelAmount > 0 && (
                              <div className="font-mono text-orange-600 text-[10px] lg:text-xs">
                                Free Fuel: {formatCurrency(freeFuelAmount)}
                              </div>
                            )}
                            {titipanTotal > 0 && (
                              <div className="font-mono text-blue-600 text-[10px] lg:text-xs">
                                Titipan: {formatCurrency(titipanTotal)}
                              </div>
                            )}
                            {couponAmount > 0 && (
                              <div className="font-mono text-red-600 text-[10px] lg:text-xs">
                                Coupon: -{formatCurrency(couponAmount)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                          <StatusBadge status={deposit.status} />
                        </TableCell>
                        {!hideActionColumn && (
                          <TableCell className="text-center w-[60px] lg:w-[80px] min-w-[60px] lg:min-w-[80px]">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewDetail(deposit)}
                              className="h-6 w-6 lg:h-7 lg:w-7 p-0 mx-auto flex items-center justify-center"
                            >
                              <Eye className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  });
                });
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
