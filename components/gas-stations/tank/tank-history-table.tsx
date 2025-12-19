"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Info, Loader2, History } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { TankDailyReportItem } from "@/lib/services/tank-history.service";

type TankHistoryTableProps = {
  dailyReport: TankDailyReportItem[];
  isLoading?: boolean;
};

export function TankHistoryTable({
  dailyReport,
  isLoading = false,
}: TankHistoryTableProps) {
  // Backend sudah menghitung openingStock berdasarkan dateRange yang diberikan
  // Filter hanya record yang tidak punya data (semua 0/null) untuk tidak ditampilkan
  // Ini aman karena tidak merusak perhitungan openingStock, hanya menghilangkan record kosong
  const sortedReport = useMemo(() => {
    // Filter record yang punya data (ada reading, unload, sales, pumpTest, atau stockByCalculation > 0)
    const filtered = dailyReport.filter((record) => {
      return (
        record.tankReading !== null ||
        record.unloads > 0 ||
        record.sales > 0 ||
        record.pumpTest > 0 ||
        record.stockByCalculation > 0
      );
    });

    // Sort untuk display (newest first)
    return filtered.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [dailyReport]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (dailyReport.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="h-12 w-12 mb-3 opacity-20" />
        <p>Belum ada data untuk tank ini</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table */}
      {sortedReport.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mb-3 opacity-20" />
          <p>Tidak ada data untuk periode ini</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px] lg:w-[110px] text-[10px] lg:text-xs">
                  Tanggal
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Stock Awal
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stock di awal hari</p>
                        <p className="text-xs text-muted-foreground">
                          Stock closing dari hari sebelumnya
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Total IN
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total liter yang masuk ke tank</p>
                        <p className="text-xs text-muted-foreground">
                          Total IN = Unload
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Total OUT
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total liter yang keluar dari tank</p>
                        <p className="text-xs text-muted-foreground">
                          Total OUT = Sales + Pump Test
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Stock Realtime
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stock berdasarkan calculation</p>
                        <p className="text-xs text-muted-foreground">
                          Stock Realtime = Stock Kemarin + Total IN - Total OUT
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Tank Reading
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reading fisik dari tank</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right text-[10px] lg:text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-0.5 lg:gap-1 ml-auto">
                        Variance
                        <Info className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Selisih antara Tank Reading dan Stock Realtime</p>
                        <p className="text-xs text-muted-foreground">
                          Variance = Tank Reading - Stock Realtime
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedReport.map((record) => {
                const hasLoss =
                  record.estimatedLoss !== null && record.estimatedLoss > 0;

                return (
                  <TableRow
                    key={record.date}
                    className={cn(hasLoss && "bg-red-50 hover:bg-red-100")}
                  >
                    {/* Date */}
                    <TableCell className="font-medium text-xs">
                      {format(new Date(record.date), "dd MMM yyyy", {
                        locale: localeId,
                      })}
                    </TableCell>

                    {/* Opening Stock */}
                    <TableCell className="text-right text-xs font-semibold font-mono text-blue-600">
                      {formatNumber(record.openingStock)}
                    </TableCell>

                    {/* Total IN */}
                    <TableCell className="text-right text-xs font-semibold text-green-600 font-mono">
                      {record.unloads > 0
                        ? `+${formatNumber(record.unloads)}`
                        : "-"}
                    </TableCell>

                    {/* Total OUT */}
                    <TableCell className="text-right text-xs font-semibold text-red-600 font-mono">
                      {record.sales > 0 || record.pumpTest > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              -{formatNumber(record.sales + record.pumpTest)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <div className="text-xs font-mono">
                                  Sales: {formatNumber(record.sales)} L
                                </div>
                                {record.pumpTest > 0 && (
                                  <div className="text-xs font-mono">
                                    Pump Test: {formatNumber(record.pumpTest)} L
                                  </div>
                                )}
                                {record.salesDetails.length > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <p className="text-xs font-semibold mb-1">
                                      Detail Sales:
                                    </p>
                                    {record.salesDetails.map((detail, idx) => (
                                      <div
                                        key={idx}
                                        className="text-xs font-mono"
                                      >
                                        {detail.station} - {detail.nozzle}:{" "}
                                        {formatNumber(detail.amount)} L
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    {/* Stock Realtime */}
                    <TableCell className="text-right text-xs font-semibold font-mono">
                      {formatNumber(record.stockByCalculation)}
                    </TableCell>

                    {/* Tank Reading */}
                    <TableCell className="text-right text-xs font-semibold text-orange-600 font-mono">
                      {record.tankReading !== null
                        ? formatNumber(record.tankReading)
                        : "-"}
                    </TableCell>

                    {/* Variance */}
                    <TableCell className="text-right text-xs font-mono">
                      {record.variance !== null ? (
                        <span
                          className={cn(
                            "font-bold flex items-center justify-end gap-1",
                            record.variance < 0
                              ? "text-red-600"
                              : record.variance > 0
                              ? "text-green-600"
                              : "text-gray-600"
                          )}
                        >
                          {Math.abs(record.variance) > 100 && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {record.variance > 0 && "+"}
                          {formatNumber(record.variance)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
