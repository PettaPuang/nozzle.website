"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/format-client";
import { formatNumber } from "@/lib/utils/format-client";
import { DatePickerOwner } from "@/components/reusable/date-picker-owner";
import type { DateRange } from "react-day-picker";
import {
  startOfDayUTC,
  endOfDayUTC,
  startOfYearUTC,
  nowUTC,
} from "@/lib/utils/datetime";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ExpenseReportTable } from "@/components/gas-stations/report/expense-table";
import { FinancialReportTable } from "@/components/gas-stations/report/income-table";
import { cn } from "@/lib/utils";

type OwnerReportSummaryProps = {
  ownerId: string;
};

type GasStationReport = {
  id: string;
  name: string;
  totalSales: number;
  hpp: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  contribution: number;
};

type OwnerReportData = {
  gasStations: GasStationReport[];
  totals: {
    totalSales: number;
    totalHpp: number;
    totalGrossProfit: number;
    totalExpenses: number;
    totalNetProfit: number;
  };
};

export function OwnerReportSummary({ ownerId }: OwnerReportSummaryProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  });

  const dateRange = useMemo<DateRange>(() => {
    return {
      from: selectedDate,
      to: selectedDate,
    } as DateRange;
  }, [selectedDate]);

  const [reportData, setReportData] = useState<OwnerReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ownerName, setOwnerName] = useState<string>("");
  const [expandedDetail, setExpandedDetail] = useState<{
    gasStationId: string;
    type: "sales" | "expense" | "grossProfit";
  } | null>(null);
  const [financialReportData, setFinancialReportData] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Memoize date range values untuk dependency yang stabil
  const dateFrom = useMemo(
    () => selectedDate?.toISOString(),
    [selectedDate]
  );
  const dateTo = useMemo(() => selectedDate?.toISOString(), [selectedDate]);

  useEffect(() => {
    // Fetch owner name
    const fetchOwnerName = async () => {
      try {
        const response = await fetch(
          `/api/ownergroup/owner-name?ownerId=${ownerId}`
        );
        const result = await response.json();
        if (result.success && result.data) {
          setOwnerName(result.data.name || "");
        }
      } catch (error) {
        console.error("Error fetching owner name:", error);
      }
    };

    fetchOwnerName();
  }, [ownerId]);

  useEffect(() => {
    if (selectedDate) {
      fetchReport();
      // Reset expanded detail ketika date berubah
      setExpandedDetail(null);
      setFinancialReportData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, dateFrom, dateTo]);

  const fetchReport = async () => {
    if (!selectedDate) return;

    setIsLoading(true);
    try {
      const startDateUTC = startOfDayUTC(selectedDate);
      const endDateUTC = endOfDayUTC(selectedDate);
      const params = new URLSearchParams({
        ownerId,
        startDate: startDateUTC.toISOString(),
        endDate: endDateUTC.toISOString(),
      });
      const response = await fetch(`/api/reports/owner?${params}`);
      const result = await response.json();
      if (result.success) {
        setReportData(result.data);
      } else {
        toast.error("Gagal memuat data rekap");
        setReportData(null);
      }
    } catch (error) {
      console.error("Error fetching owner report:", error);
      toast.error("Gagal memuat data rekap");
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Format date untuk judul
  const formatDateRange = () => {
    if (!selectedDate) return "";
    return format(selectedDate, "dd MMM yyyy", { locale: id });
  };

  // Handle cell click untuk show detail
  const handleCellClick = async (
    gasStationId: string,
    type: "sales" | "expense" | "grossProfit"
  ) => {
    // Toggle jika sudah expanded dengan gasStationId dan type yang sama
    if (
      expandedDetail?.gasStationId === gasStationId &&
      expandedDetail?.type === type
    ) {
      setExpandedDetail(null);
      setFinancialReportData(null);
      return;
    }

    // Set expanded state
    setExpandedDetail({ gasStationId, type });

    // Untuk sales, grossProfit dan expense, fetch financial report data
    // Karena sekarang sales juga menampilkan income-table.tsx
    if (type === "expense" || type === "grossProfit" || type === "sales") {
      if (
        !financialReportData ||
        financialReportData.gasStationId !== gasStationId
      ) {
        setIsLoadingDetail(true);
        try {
          if (!selectedDate) return;

          const startDateUTC = startOfDayUTC(selectedDate);
          const endDateUTC = endOfDayUTC(selectedDate);
          const params = new URLSearchParams({
            gasStationId,
            startDate: startDateUTC.toISOString(),
            endDate: endDateUTC.toISOString(),
          });

          // Fetch kedua API secara parallel (income dan financial)
          const [incomeResponse, financialResponse] = await Promise.all([
            fetch(`/api/reports/income?${params}`),
            fetch(`/api/reports/financial?${params}`),
          ]);

          const [incomeResult, financialResult] = await Promise.all([
            incomeResponse.json(),
            financialResponse.json(),
          ]);

          if (incomeResult.success && financialResult.success) {
            setFinancialReportData({
              incomeData: incomeResult.data,
              financialData: financialResult.data,
              expenses: financialResult.data.expenses,
              gasStationId,
            });
          } else {
            toast.error("Gagal memuat detail data");
            setExpandedDetail(null);
          }
        } catch (error) {
          console.error("Error fetching financial report:", error);
          toast.error("Gagal memuat detail data");
          setExpandedDetail(null);
        } finally {
          setIsLoadingDetail(false);
        }
      }
    }
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base lg:text-lg font-semibold">
          Summary Laporan
          {ownerName && ` (${ownerName})`}
          {formatDateRange() && ` Periode: ${formatDateRange()}`}
        </h2>
        <DatePickerOwner
          date={selectedDate}
          onSelect={(date) => {
            if (date) {
              setSelectedDate(date);
            }
          }}
          size="sm"
        />
      </div>

      {/* Summary Table */}
      {isLoading ? (
        <div className="h-[300px] lg:h-[400px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 lg:h-8 lg:w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !reportData ? (
        <div className="h-[300px] lg:h-[400px] flex items-center justify-center">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Pilih rentang tanggal untuk melihat rekap
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Gas Station
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Total Penjualan
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Laba Kotor
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Pengeluaran
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Laba Bersih
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Margin (%)
                </TableHead>
                <TableHead className="text-right text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  Kontribusi (%)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.gasStations.map((gasStation) => {
                const isSalesExpanded =
                  expandedDetail?.gasStationId === gasStation.id &&
                  expandedDetail?.type === "sales";
                const isGrossProfitExpanded =
                  expandedDetail?.gasStationId === gasStation.id &&
                  expandedDetail?.type === "grossProfit";
                const isExpenseExpanded =
                  expandedDetail?.gasStationId === gasStation.id &&
                  expandedDetail?.type === "expense";
                const showDetail =
                  isSalesExpanded ||
                  isGrossProfitExpanded ||
                  isExpenseExpanded;

                return (
                  <React.Fragment key={gasStation.id}>
                    <TableRow>
                      <TableCell className="font-medium text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                        {gasStation.name}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2 cursor-pointer hover:bg-gray-50",
                          isSalesExpanded && "bg-blue-50"
                        )}
                        onClick={() => handleCellClick(gasStation.id, "sales")}
                      >
                        {formatCurrency(gasStation.totalSales)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2 cursor-pointer hover:bg-gray-50",
                          isGrossProfitExpanded && "bg-blue-50",
                          gasStation.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                        )}
                        onClick={() => handleCellClick(gasStation.id, "grossProfit")}
                      >
                        {formatCurrency(gasStation.grossProfit)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2 cursor-pointer hover:bg-gray-50",
                          isExpenseExpanded && "bg-blue-50"
                        )}
                        onClick={() =>
                          handleCellClick(gasStation.id, "expense")
                        }
                      >
                        {formatCurrency(gasStation.totalExpenses)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono font-semibold text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2",
                          gasStation.netProfit >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {formatCurrency(gasStation.netProfit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                        {formatNumber(gasStation.margin, { decimals: 2 })}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                        {formatNumber(gasStation.contribution, {
                          decimals: 2,
                        })}
                        %
                      </TableCell>
                    </TableRow>
                    {/* Detail Table */}
                    {showDetail && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="p-0 bg-gray-50 border-t-2"
                        >
                          {isSalesExpanded && (
                            <div className="p-2 lg:p-4">
                              {isLoadingDetail ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : financialReportData &&
                                financialReportData.gasStationId === gasStation.id ? (
                                <FinancialReportTable
                                  isLoading={false}
                                  gasStationId={gasStation.id}
                                  dateRange={dateRange}
                                  incomeData={financialReportData.incomeData || null}
                                  financialData={financialReportData.financialData || null}
                                />
                              ) : null}
                            </div>
                          )}
                          {isGrossProfitExpanded && (
                            <div className="p-2 lg:p-4">
                              {isLoadingDetail ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : financialReportData &&
                                financialReportData.gasStationId === gasStation.id ? (
                                <FinancialReportTable
                                  isLoading={false}
                                  gasStationId={gasStation.id}
                                  dateRange={dateRange}
                                  incomeData={financialReportData.incomeData || null}
                                  financialData={financialReportData.financialData || null}
                                />
                              ) : null}
                            </div>
                          )}
                          {isExpenseExpanded && (
                            <div className="p-2 lg:p-4">
                              {isLoadingDetail ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : financialReportData &&
                                financialReportData.gasStationId ===
                                  gasStation.id ? (
                                <ExpenseReportTable
                                  report={financialReportData.expenses}
                                  isLoading={false}
                                />
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              <TableRow className="border-t-2 bg-gray-50 font-bold">
                <TableCell className="text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  TOTAL
                </TableCell>
                <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  {formatCurrency(reportData.totals.totalSales)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2 ${
                    reportData.totals.totalGrossProfit >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(reportData.totals.totalGrossProfit)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  {formatCurrency(reportData.totals.totalExpenses)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2 ${
                    reportData.totals.totalNetProfit >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(reportData.totals.totalNetProfit)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  {reportData.totals.totalSales > 0
                    ? formatNumber(
                        (reportData.totals.totalNetProfit /
                          reportData.totals.totalSales) *
                          100,
                        { decimals: 2 }
                      )
                    : "0.00"}
                  %
                </TableCell>
                <TableCell className="text-right font-mono text-xs lg:text-sm px-2 lg:px-4 py-1.5 lg:py-2">
                  100.00%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
