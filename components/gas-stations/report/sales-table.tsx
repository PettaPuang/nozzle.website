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
import { ChevronDown, ChevronRight } from "lucide-react";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { NozzleBadge } from "@/components/reusable/badges/nozzle-badge";
import { DatePicker } from "@/components/reusable/date-picker";
import { formatNumber, formatCurrency } from "@/lib/utils/format-client";
import type {
  ComprehensiveSalesReport,
  ProductSalesData,
  NozzleBreakdown,
} from "@/lib/services/report-sales.service";
import {
  startOfDayUTC,
  endOfDayUTC,
  startOfMonthUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";

type ComprehensiveSalesTableProps = {
  gasStationId: string;
  isLoading?: boolean;
  onReportChange?: (report: ComprehensiveSalesReport | null) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (dateRange: DateRange) => void;
  hideSummaryCards?: boolean;
};

export function ComprehensiveSalesTable({
  gasStationId,
  isLoading = false,
  onReportChange,
  dateRange: externalDateRange,
  onDateRangeChange,
  hideSummaryCards = false,
}: ComprehensiveSalesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ComprehensiveSalesReport | null>(null);
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

  // Fetch report data when date range changes
  useEffect(() => {
    const fetchReportData = async () => {
      if (!dateRange.from || !dateRange.to) {
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

        const response = await fetch(`/api/reports/comprehensive?${params}`);
        const result = await response.json();

        if (result.success) {
          setReport(result.data);
          onReportChange?.(result.data);
        } else {
          console.error("[Sales Table] Fetch failed:", result.message);
          setReport(null);
          onReportChange?.(null);
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
        setReport(null);
        onReportChange?.(null);
      } finally {
        setIsFetching(false);
      }
    };

    fetchReportData();
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
      return `${fromDate} s/d ${toDate} ${formatUTCDate(
        dateRange.from,
        "MMMM yyyy"
      )}`;
    }

    if (fromYear === toYear) {
      // Different months, same year: "1 Desember s/d 15 Januari 2025"
      return `${formatUTCDate(dateRange.from, "d MMMM")} s/d ${formatUTCDate(
        dateRange.to,
        "d MMMM yyyy"
      )}`;
    }

    // Different years: "1 Desember 2024 s/d 15 Januari 2025"
    return `${formatUTCDate(dateRange.from, "d MMMM yyyy")} s/d ${formatUTCDate(
      dateRange.to,
      "d MMMM yyyy"
    )}`;
  };

  const toggleRow = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  if (isFetching || isLoading) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Laporan Penjualan Komprehensif
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Memuat data...
          </div>
        </div>
        <div className="p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground text-center py-4 lg:py-8">
            Loading report data...
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
            Laporan Penjualan Komprehensif
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data untuk ditampilkan
          </div>
        </div>
        <div className="p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground text-center py-4 lg:py-8">
            Pilih rentang tanggal untuk melihat laporan
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
              Laporan Penjualan Komprehensif
              {getDateRangeLabel() ? ` - ${getDateRangeLabel()}` : ""}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Detail penjualan per produk dengan breakdown per nozzle
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
        {!hideSummaryCards && (
          <div className="flex gap-2 lg:gap-4 mb-3 lg:mb-6">
            <div className="bg-blue-50 rounded-lg p-2 lg:p-4 border border-blue-200 flex-1 min-w-[180px]">
              <div className="text-xs lg:text-sm text-blue-600 mb-1">
                Total Volume
              </div>
              <div className="text-lg lg:text-2xl font-bold text-blue-900 font-mono">
                {formatNumber(report.summary.totalVolume)} L
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-2 lg:p-4 border border-green-200 flex-1 min-w-[180px]">
              <div className="text-xs lg:text-sm text-green-600 mb-1">
                Total Nilai
              </div>
              <div className="text-lg lg:text-2xl font-bold text-green-900 font-mono">
                {formatCurrency(report.summary.totalAmount)}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Optimized for landscape: reduce widths untuk lebih banyak kolom visible */}
                  <TableHead className="w-[30px] lg:w-[50px] sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.1)]"></TableHead>
                  <TableHead className="w-[80px] lg:w-[120px] sticky left-[30px] lg:left-[50px] z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    Produk
                  </TableHead>
                  <TableHead className="w-[100px] lg:w-[180px]">
                    Station
                  </TableHead>
                  <TableHead className="w-[70px] lg:w-[120px]">
                    Nozzle
                  </TableHead>
                  <TableHead className="text-right w-[60px] lg:w-[100px]">
                    Pump Test
                  </TableHead>
                  <TableHead className="text-right w-[70px] lg:w-[120px]">
                    Sales Volume
                  </TableHead>
                  <TableHead className="text-right w-[80px] lg:w-[120px]">
                    Harga (Rp)
                  </TableHead>
                  <TableHead className="text-right w-[100px] lg:w-[150px]">
                    Amount (Rp)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byProduct.map(
                  (product: ProductSalesData, productIndex: number) => (
                    <React.Fragment
                      key={`${product.productId}-${product.price}-${productIndex}`}
                    >
                      {/* Product Summary Row */}
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50 font-medium"
                        onClick={() =>
                          toggleRow(`${product.productId}-${product.price}`)
                        }
                      >
                        <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-background shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 lg:h-6 lg:w-6"
                          >
                            {expandedRows.has(
                              `${product.productId}-${product.price}`
                            ) ? (
                              <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                            ) : (
                              <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="py-1.5 lg:py-2 sticky left-[30px] lg:left-[50px] z-10 bg-background border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                          <ProductBadge productName={product.productName} />
                        </TableCell>
                        <TableCell className="text-gray-400 py-1.5 lg:py-2">
                          -
                        </TableCell>
                        <TableCell className="text-gray-400 py-1.5 lg:py-2">
                          -
                        </TableCell>
                        <TableCell className="text-gray-400 text-right py-1.5 lg:py-2">
                          -
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {product.totalVolume > 0
                            ? formatNumber(product.totalVolume)
                            : "0"}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {product.price > 0
                            ? formatCurrency(product.price)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {product.totalAmount > 0
                            ? formatCurrency(product.totalAmount)
                            : "0"}
                        </TableCell>
                      </TableRow>

                      {/* Nozzle Breakdown Rows */}
                      {expandedRows.has(
                        `${product.productId}-${product.price}`
                      ) &&
                        (product.nozzleBreakdown.length > 0 ? (
                          product.nozzleBreakdown.map(
                            (nozzle: NozzleBreakdown, idx: number) => (
                              <TableRow
                                key={`${product.productId}-${product.price}-${nozzle.nozzleCode}-${idx}`}
                                className="bg-gray-50"
                              >
                                <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-gray-50 shadow-[2px_0_4px_rgba(0,0,0,0.1)]"></TableCell>
                                <TableCell className="py-1.5 lg:py-2 sticky left-[30px] lg:left-[50px] z-10 bg-gray-50 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]"></TableCell>
                                <TableCell className="py-1.5 lg:py-2">
                                  <div
                                    className="truncate"
                                    title={`${nozzle.stationCode} - ${nozzle.stationName}`}
                                  >
                                    {nozzle.stationCode}
                                    <span className="text-[10px] lg:text-xs text-gray-500 ml-1">
                                      ({nozzle.stationName})
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5 lg:py-2">
                                  {nozzle.nozzleName || nozzle.nozzleCode}
                                </TableCell>
                                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                                  {formatNumber(nozzle.pumpTest)}
                                </TableCell>
                                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                                  {formatNumber(nozzle.volume)}
                                </TableCell>
                                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                                  {formatCurrency(nozzle.price)}
                                </TableCell>
                                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                                  {formatCurrency(nozzle.amount)}
                                </TableCell>
                              </TableRow>
                            )
                          )
                        ) : (
                          <TableRow className="bg-gray-50">
                            <TableCell
                              colSpan={8}
                              className="py-1.5 lg:py-2 text-center text-xs lg:text-sm text-muted-foreground"
                            >
                              Belum ada penjualan untuk produk ini
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  )
                )}

                {/* Grand Total Row */}
                <TableRow className="bg-gray-100 font-semibold">
                  <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.1)]"></TableCell>
                  <TableCell className="py-1.5 lg:py-2 sticky left-[30px] lg:left-[50px] z-10 bg-gray-100 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    TOTAL
                  </TableCell>
                  <TableCell colSpan={3} className="py-1.5 lg:py-2"></TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatNumber(report.summary.totalVolume)}
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2"></TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(report.summary.totalAmount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
