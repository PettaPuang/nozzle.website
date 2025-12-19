"use client";

import React, { useState, useEffect } from "react";
import { format as formatDate } from "date-fns";
import { id } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

/**
 * Format UTC date to local date string for display
 * Uses UTC methods to ensure date doesn't shift due to timezone
 */
function formatUTCDate(date: Date, formatStr: string): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return formatDate(localDate, formatStr, { locale: id });
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { DatePicker } from "@/components/reusable/date-picker";
import { formatNumber } from "@/lib/utils/format-client";
import {
  nowUTC,
  startOfDayUTC,
  endOfDayUTC,
  startOfMonthUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";

type TankStockData = {
  tankId: string;
  tankName: string;
  productName: string;
  capacity: number;
  openingStock: number;
  totalUnload: number;
  totalSales: number;
  totalPumpTest: number;
  totalOut: number;
  closingStock: number;
  totalVariance: number;
  fillPercentage: number;
};

type StockReportData = {
  tanks: TankStockData[];
  summary: {
    totalCapacity: number;
    totalOpeningStock: number;
    totalUnload: number;
    totalSales: number;
    totalPumpTest: number;
    totalOut: number;
    totalClosingStock: number;
    totalVariance: number;
  };
};

type StockReportTableProps = {
  gasStationId: string;
  isLoading?: boolean;
  onReportChange?: (report: StockReportData | null) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (dateRange: DateRange) => void;
};

export function StockReportTable({
  gasStationId,
  isLoading = false,
  onReportChange,
  dateRange: externalDateRange,
  onDateRangeChange,
}: StockReportTableProps) {
  const [report, setReport] = useState<StockReportData | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Default: bulan ini (tanggal 1 sampai hari ini)
  const [internalDateRange, setInternalDateRange] = useState<DateRange>(() => {
    const todayLocalAsUTC = getTodayLocalAsUTC();
    const monthStart = startOfMonthUTC(todayLocalAsUTC);
    
    return {
      from: startOfDayUTC(monthStart),
      to: endOfDayUTC(todayLocalAsUTC),
    } as DateRange;
  });

  const dateRange = externalDateRange ?? internalDateRange;
  const setDateRange = onDateRangeChange ?? setInternalDateRange;

  // Fetch stock data when date range changes
  useEffect(() => {
    const fetchStockData = async () => {
      console.log('[Stock Table] dateRange:', dateRange);
      console.log('[Stock Table] dateRange.from:', dateRange.from);
      console.log('[Stock Table] dateRange.to:', dateRange.to);
      
      if (!dateRange.from || !dateRange.to) {
        console.log('[Stock Table] Missing date range, skipping fetch');
        return;
      }

      setIsFetching(true);
      try {
        // Normalize date range untuk memastikan konsistensi UTC
        const normalizedFrom = startOfDayUTC(dateRange.from);
        const normalizedTo = endOfDayUTC(dateRange.to);
        
        const params = new URLSearchParams({
          gasStationId,
          startDate: normalizedFrom.toISOString(),
          endDate: normalizedTo.toISOString(),
        });
        console.log('[Stock Table] Fetching with params:', params.toString());
        
        const response = await fetch(`/api/reports/stock?${params}`);
        const result = await response.json();
        
        console.log('[Stock Table] Response:', result);
        
        if (result.success) {
          setReport(result.data);
          onReportChange?.(result.data);
        } else {
          console.error('[Stock Table] Fetch failed:', result.message);
          setReport(null);
          onReportChange?.(null);
        }
      } catch (error) {
        console.error("Error fetching stock data:", error);
        setReport(null);
        onReportChange?.(null);
      } finally {
        setIsFetching(false);
      }
    };

    fetchStockData();
  }, [gasStationId, dateRange, onReportChange]);

  const getDateRangeLabel = () => {
    if (!dateRange.from) return "";

    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      // Single date
      return formatUTCDate(dateRange.from, "d MMMM yyyy");
    }

    // Date range
    const fromDate = dateRange.from.getUTCDate();
    const toDate = dateRange.to.getUTCDate();
    const fromMonth = dateRange.from.getUTCMonth();
    const toMonth = dateRange.to.getUTCMonth();
    const fromYear = dateRange.from.getUTCFullYear();
    const toYear = dateRange.to.getUTCFullYear();

    if (fromYear === toYear && fromMonth === toMonth) {
      // Same month: "1 s/d 31 Desember 2024"
      return `${fromDate} s/d ${toDate} ${formatUTCDate(dateRange.from, "MMMM yyyy")}`;
    }

    if (fromYear === toYear) {
      // Different months, same year: "1 Desember s/d 15 Januari 2025"
      return `${formatUTCDate(dateRange.from, "d MMMM")} s/d ${formatUTCDate(dateRange.to, "d MMMM yyyy")}`;
    }

    // Different years: "1 Desember 2024 s/d 15 Januari 2025"
    return `${formatUTCDate(dateRange.from, "d MMMM yyyy")} s/d ${formatUTCDate(dateRange.to, "d MMMM yyyy")}`;
  };
  if (isFetching || isLoading) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Laporan Stock
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Memuat data...
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Laporan Stock
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Pilih rentang tanggal untuk melihat laporan stock
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3">
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4 mb-2">
          <div className="flex-1">
            <div className="text-base lg:text-lg font-semibold">
              Laporan Stock{getDateRangeLabel() ? ` - ${getDateRangeLabel()}` : ""}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Ringkasan stok per tangki dengan unload, penjualan, dan variance
            </div>
          </div>
          {!externalDateRange && (
            <div className="flex gap-1.5 lg:gap-2 shrink-0 items-center">
              <DatePicker
                date={dateRange}
                onSelect={(date) => {
                  if (date?.from && date?.to) {
                    setDateRange({
                      from: startOfDayUTC(date.from),
                      to: endOfDayUTC(date.to),
                    });
                  }
                }}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
      <div className="p-2 lg:p-3">
        {/* Summary Cards */}
        <div className="overflow-x-auto mb-3 lg:mb-6">
          <div className="grid grid-cols-7 gap-1.5 lg:gap-2 min-w-[950px]">
            <div className="bg-blue-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-blue-600">
                  Kapasitas Total
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-blue-900 font-mono">
                {formatNumber(report.summary.totalCapacity)} L
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-purple-600">
                  Stock Awal
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-purple-900 font-mono">
                {formatNumber(report.summary.totalOpeningStock)} L
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-green-600">
                  Total Unload
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-green-900 font-mono">
                {formatNumber(report.summary.totalUnload)} L
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-orange-600">
                  Total Pump Test
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-orange-900 font-mono">
                {formatNumber(report.summary.totalPumpTest)} L
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-red-600">
                  Total Sales
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-red-900 font-mono">
                {formatNumber(report.summary.totalSales)} L
              </p>
            </div>
            <div
              className={`rounded-lg p-1.5 lg:p-3 ${
                report.summary.totalVariance < 0 ? "bg-red-50" : "bg-green-50"
              }`}
            >
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span
                  className={`text-[10px] lg:text-xs ${
                    report.summary.totalVariance < 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  Total Variance
                </span>
              </div>
              <p
                className={`text-lg lg:text-2xl font-bold font-mono ${
                  report.summary.totalVariance < 0
                    ? "text-red-900"
                    : "text-green-900"
                }`}
              >
                {report.summary.totalVariance < 0 ? "-" : "+"}
                {formatNumber(Math.abs(report.summary.totalVariance))} L
              </p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-1.5 lg:p-3">
              <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
                <span className="text-[10px] lg:text-xs text-cyan-600">
                  Stock Akhir
                </span>
              </div>
              <p className="text-lg lg:text-2xl font-bold text-cyan-900 font-mono">
                {formatNumber(report.summary.totalClosingStock)} L
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-1.5 lg:py-2 w-[70px] lg:w-[120px] sticky left-0 z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    Tangki
                  </TableHead>
                  <TableHead className="py-1.5 lg:py-2 w-[70px] lg:w-[120px]">
                    Produk
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Kapasitas (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Stock Awal (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Unload (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Pump Test (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Sales (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Stock Akhir (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Variance (L)
                  </TableHead>
                  <TableHead className="text-right py-1.5 lg:py-2">
                    Fill %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.tanks.map((tank) => (
                  <TableRow key={tank.tankId} className="hover:bg-gray-50">
                    <TableCell className="font-medium py-1.5 lg:py-2 w-[70px] lg:w-[120px] sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                      {tank.tankName}
                    </TableCell>
                    <TableCell className="py-1.5 lg:py-2 w-[70px] lg:w-[120px]">
                      <ProductBadge productName={tank.productName} />
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatNumber(tank.capacity)}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatNumber(tank.openingStock)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600 py-1.5 lg:py-2">
                      {formatNumber(tank.totalUnload)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600 py-1.5 lg:py-2">
                      {formatNumber(tank.totalPumpTest)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 py-1.5 lg:py-2">
                      {formatNumber(tank.totalSales)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold py-1.5 lg:py-2">
                      {formatNumber(tank.closingStock)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono py-1.5 lg:py-2 ${
                        tank.totalVariance < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {tank.totalVariance < 0 ? "-" : "+"}
                      {formatNumber(Math.abs(tank.totalVariance))}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {tank.fillPercentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}

                {/* Total Row */}
                <TableRow className="bg-gray-100 font-semibold">
                  <TableCell className="py-1.5 lg:py-2 w-[70px] lg:w-[120px] sticky left-0 z-10 bg-gray-100 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    TOTAL
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2 w-[70px] lg:w-[120px]"></TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalCapacity)}
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalOpeningStock)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600 py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalUnload)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600 py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalPumpTest)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600 py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalSales)}
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalClosingStock)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono py-1.5 lg:py-2 ${
                      report.summary.totalVariance < 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {report.summary.totalVariance < 0 ? "-" : "+"}
                    {formatNumber(Math.abs(report.summary.totalVariance))}
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
