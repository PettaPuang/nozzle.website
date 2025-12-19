"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DatePicker } from "@/components/reusable/date-picker";
import { ShiftBadge, ProductBadge } from "@/components/reusable/badges";
import { formatNumber, formatCurrency } from "@/lib/utils/format-client";
import { getStationShiftsWithSales } from "@/lib/actions/operator.actions";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Clock, TrendingUp, DollarSign, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OperatorShiftHistory } from "@/lib/services/operator.service";

type StationShift = OperatorShiftHistory & {
  operator: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  status: string;
};

type StationDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationId: string;
  stationName: string;
  stationCode: string;
};

export function StationDetailSheet({
  open,
  onOpenChange,
  stationId,
  stationName,
  stationCode,
}: StationDetailSheetProps) {
  const [shifts, setShifts] = useState<StationShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Default: Last 7 Days (same logic as date picker)
  const getDefaultDateRange = () => {
    const today = new Date(); // Local time
    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 6);

    return {
      from: new Date(
        Date.UTC(
          last7.getFullYear(),
          last7.getMonth(),
          last7.getDate(),
          0,
          0,
          0,
          0
        )
      ),
      to: new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0
        )
      ),
    };
  };

  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());

  useEffect(() => {
    const fetchShifts = async () => {
      if (!stationId) return;

      setIsLoading(true);
      try {
        const result = await getStationShiftsWithSales(
          stationId,
          dateRange.from,
          dateRange.to
        );

        if (result.success && result.data) {
          setShifts(result.data as StationShift[]);
        }
      } catch (error) {
        console.error("Failed to fetch station shifts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && stationId) {
      fetchShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stationId, dateRange.from, dateRange.to]);

  // Calculate summary statistics
  const totalShifts = shifts.length;
  const completedShifts = shifts.filter((s) => s.status === "COMPLETED").length;

  // Calculate total sales volume (in liters) and revenue (in rupiah)
  let totalSalesVolume = 0;
  let totalRevenue = 0;

  // Collect all unique nozzles from all shifts
  const nozzleMap = new Map<
    string,
    { code: string; name: string; productName: string }
  >();

  shifts.forEach((shift) => {
    if (shift.nozzleDetails && Array.isArray(shift.nozzleDetails)) {
      shift.nozzleDetails.forEach((nozzle: any) => {
        if (!nozzleMap.has(nozzle.nozzleId)) {
          nozzleMap.set(nozzle.nozzleId, {
            code: nozzle.nozzleCode,
            name: nozzle.nozzleName,
            productName: nozzle.productName,
          });
        }
        if (nozzle.salesVolume && nozzle.salesVolume > 0) {
          totalSalesVolume += nozzle.salesVolume;
        }
        if (nozzle.totalAmount && nozzle.totalAmount > 0) {
          totalRevenue += nozzle.totalAmount;
        }
      });
    }
  });

  // Convert map to sorted array
  const nozzles = Array.from(nozzleMap.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => a.code.localeCompare(b.code));

  // Group shifts by date
  const groupedShifts = shifts.reduce((acc, shift) => {
    if (!shift.date) return acc;

    const dateKey = format(new Date(shift.date), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(shift);
    return acc;
  }, {} as Record<string, StationShift[]>);

  // Sort dates descending (newest first)
  const sortedDates = Object.keys(groupedShifts).sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-3 lg:p-6">
        <SheetHeader className="">
          <SheetTitle className="text-sm lg:text-lg">
            History Check-In - {stationName}
          </SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            Riwayat check-in dan check-out di station {stationCode}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 lg:space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 lg:gap-3">
            <div className="rounded-lg border bg-muted/30 p-2 lg:p-3">
              <div className="text-[10px] lg:text-xs font-medium text-muted-foreground mb-2">
                Shift
              </div>
              <div className="space-y-1">
                <div className="text-sm lg:text-lg font-bold">
                  Total {totalShifts} shift
                </div>
                <div className="text-xs lg:text-sm font-mono">
                  Average{" "}
                  {completedShifts > 0
                    ? formatNumber(
                        Math.round(totalSalesVolume / completedShifts)
                      )
                    : 0}{" "}
                  L/shift
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2 lg:p-3">
              <div className="text-[10px] lg:text-xs font-medium text-muted-foreground mb-2">
                Sales
              </div>
              <div className="space-y-1">
                <div className="text-sm lg:text-lg font-bold font-mono">
                  {formatNumber(Math.round(totalSalesVolume))} L
                </div>
                <div className="text-xs lg:text-sm font-mono">
                  {formatCurrency(totalRevenue)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <DatePicker
              date={dateRange}
              onSelect={(range) => range && setDateRange(range)}
              size="sm"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 lg:py-16">
              <div className="text-xs lg:text-sm text-muted-foreground">
                Memuat data...
              </div>
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 lg:py-16 text-center">
              <Clock className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mb-3 lg:mb-4" />
              <p className="text-xs lg:text-sm text-foreground font-medium mb-1">
                Belum ada history check-in
              </p>
              <p className="text-[10px] lg:text-xs text-muted-foreground">
                History check-in akan muncul di sini
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table className="w-full min-w-[640px] lg:min-w-0">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs lg:text-sm font-semibold w-[80px] lg:w-[90px] min-w-[80px] lg:min-w-[90px]">
                      Tanggal
                    </TableHead>
                    <TableHead className="text-xs lg:text-sm font-semibold w-[90px] lg:w-[100px] min-w-[90px] lg:min-w-[100px]">
                      Shift
                    </TableHead>
                    <TableHead className="text-xs lg:text-sm font-semibold w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                      Nozzle
                    </TableHead>
                    <TableHead className="text-xs lg:text-sm font-semibold w-[70px] lg:w-[85px] min-w-[70px] lg:min-w-[85px] text-right">
                      Pumptest
                    </TableHead>
                    <TableHead className="text-xs lg:text-sm font-semibold w-[70px] lg:w-[85px] min-w-[70px] lg:min-w-[85px] text-right">
                      Sales
                    </TableHead>
                    <TableHead className="text-xs lg:text-sm font-semibold w-[70px] lg:w-[85px] min-w-[70px] lg:min-w-[85px] text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDates.map((dateKey) => {
                    const dateShifts = groupedShifts[dateKey];
                    const dateDisplay = format(new Date(dateKey), "dd/MM/yyyy");

                    // Calculate total for this date
                    let dateTotalPumpTest = 0;
                    let dateTotalSalesVolume = 0;
                    dateShifts.forEach((shift: StationShift) => {
                      if (
                        shift.nozzleDetails &&
                        Array.isArray(shift.nozzleDetails)
                      ) {
                        shift.nozzleDetails.forEach((nozzle: any) => {
                          dateTotalPumpTest += nozzle.pumpTest || 0;
                          dateTotalSalesVolume += nozzle.salesVolume || 0;
                        });
                      }
                    });

                    return (
                      <Fragment key={dateKey}>
                        {dateShifts.map(
                          (shift: StationShift, index: number) => {
                            const nozzleDataMap = new Map<string, any>();
                            if (
                              shift.nozzleDetails &&
                              Array.isArray(shift.nozzleDetails)
                            ) {
                              shift.nozzleDetails.forEach((nozzle: any) => {
                                nozzleDataMap.set(nozzle.nozzleId, nozzle);
                              });
                            }

                            let totalPumpTest = 0;
                            let totalSalesVolume = 0;
                            let totalTotaliserOpen = 0;
                            let totalTotaliserClose = 0;

                            nozzleDataMap.forEach((nozzle: any) => {
                              totalPumpTest += nozzle.pumpTest || 0;
                              totalSalesVolume += nozzle.salesVolume || 0;
                              totalTotaliserOpen += nozzle.openReading || 0;
                              totalTotaliserClose += nozzle.closeReading || 0;
                            });

                            // Get nozzle details sorted by code
                            const nozzleDetails = Array.from(
                              nozzleDataMap.entries()
                            )
                              .map(([id, data]: [string, any]) => {
                                const nozzleInfo = nozzles.find(
                                  (n) => n.id === id
                                );
                                return {
                                  ...data,
                                  code: nozzleInfo?.code || id,
                                  name: nozzleInfo?.name || "",
                                  productName: nozzleInfo?.productName || "",
                                  pumpTest: data.pumpTest || 0,
                                  salesVolume: data.salesVolume || 0,
                                };
                              })
                              .sort((a, b) => a.code.localeCompare(b.code));

                            return (
                              <TableRow
                                key={shift.id}
                                className="hover:bg-muted/30"
                              >
                                {index === 0 ? (
                                  <TableCell
                                    rowSpan={dateShifts.length + 1}
                                    className="text-xs lg:text-sm py-1.5 align-top"
                                  >
                                    {dateDisplay}
                                  </TableCell>
                                ) : null}
                                <TableCell className="py-1.5 align-top">
                                  <div className="space-y-0.5">
                                    <ShiftBadge
                                      shift={shift.shift}
                                      className="text-[10px] lg:text-xs font-medium"
                                    />
                                    {shift.startTime ? (
                                      <div className="text-[9px] lg:text-[10px] text-muted-foreground">
                                        {format(
                                          new Date(shift.startTime),
                                          "HH:mm"
                                        )}
                                        {shift.endTime && (
                                          <>
                                            <span className="mx-1">s/d</span>
                                            {format(
                                              new Date(shift.endTime),
                                              "HH:mm"
                                            )}
                                          </>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs lg:text-sm py-1.5">
                                  {nozzleDetails.length > 0 ? (
                                    <div className="text-xs lg:text-sm space-y-0.5">
                                      {nozzleDetails.map((nozzle: any) => {
                                        const hasSales =
                                          (nozzle.salesVolume || 0) > 0 ||
                                          (nozzle.pumpTest || 0) > 0;
                                        return (
                                          <div
                                            key={nozzle.nozzleId}
                                            className={
                                              hasSales
                                                ? ""
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {nozzle.name || nozzle.code}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-xs lg:text-sm font-mono py-1.5 text-right">
                                  {nozzleDetails.length > 0 ? (
                                    <div className="text-xs lg:text-sm space-y-0.5">
                                      {nozzleDetails.map((nozzle: any) => {
                                        const hasSales =
                                          (nozzle.salesVolume || 0) > 0 ||
                                          (nozzle.pumpTest || 0) > 0;
                                        return (
                                          <div
                                            key={nozzle.nozzleId}
                                            className={
                                              hasSales
                                                ? ""
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {formatNumber(
                                              Math.round(nozzle.pumpTest || 0)
                                            )}{" "}
                                            L
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-xs lg:text-sm font-mono py-1.5 text-right">
                                  {nozzleDetails.length > 0 ? (
                                    <div className="text-xs lg:text-sm space-y-0.5">
                                      {nozzleDetails.map((nozzle: any) => {
                                        const hasSales =
                                          (nozzle.salesVolume || 0) > 0 ||
                                          (nozzle.pumpTest || 0) > 0;
                                        const hasSalesVolume =
                                          (nozzle.salesVolume || 0) > 0;
                                        return (
                                          <div
                                            key={nozzle.nozzleId}
                                            className={
                                              hasSalesVolume
                                                ? "text-green-600 font-semibold"
                                                : hasSales
                                                ? ""
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {formatNumber(
                                              Math.round(
                                                nozzle.salesVolume || 0
                                              )
                                            )}{" "}
                                            L
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-xs lg:text-sm font-mono py-1.5 text-right">
                                  {nozzleDetails.length > 0 ? (
                                    <div className="text-xs lg:text-sm space-y-0.5">
                                      {nozzleDetails.map((nozzle: any) => {
                                        const totalLiter =
                                          (nozzle.pumpTest || 0) +
                                          (nozzle.salesVolume || 0);
                                        const hasSales = totalLiter > 0;
                                        return (
                                          <div
                                            key={nozzle.nozzleId}
                                            className={
                                              hasSales
                                                ? ""
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {formatNumber(
                                              Math.round(totalLiter)
                                            )}{" "}
                                            L
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )}
                        {/* Total row for this date */}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell className="text-xs lg:text-sm"></TableCell>
                          <TableCell className="text-xs lg:text-sm">
                            Total
                          </TableCell>
                          <TableCell className="text-xs lg:text-sm font-mono text-right">
                            {dateTotalPumpTest > 0 ? (
                              <div className="text-xs lg:text-sm">
                                {formatNumber(Math.round(dateTotalPumpTest))} L
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs lg:text-sm font-mono text-right">
                            {dateTotalSalesVolume > 0 ? (
                              <div className="text-xs lg:text-sm">
                                {formatNumber(Math.round(dateTotalSalesVolume))}{" "}
                                L
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs lg:text-sm font-mono text-right">
                            {dateTotalPumpTest > 0 ||
                            dateTotalSalesVolume > 0 ? (
                              <div className="text-xs lg:text-sm">
                                {formatNumber(
                                  Math.round(
                                    dateTotalPumpTest + dateTotalSalesVolume
                                  )
                                )}{" "}
                                L
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
