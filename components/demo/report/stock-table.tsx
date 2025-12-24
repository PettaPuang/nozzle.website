"use client";

import React, { useState, useEffect } from "react";

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
import { formatNumber } from "@/lib/utils/format-client";
import { MockDataService } from "@/lib/utils/mock-data";

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
};

export function StockReportTable({
  gasStationId,
  isLoading = false,
  onReportChange,
}: StockReportTableProps) {
  // Demo mode: use mock data
  const [report, setReport] = useState<StockReportData | null>(null);
  const [isFetching] = useState(false);

  // Demo mode: no date range, use mock data
  useEffect(() => {
    const stockReport = MockDataService.getStockReport(gasStationId);
    if (stockReport) {
      // Transform mock data to match expected format
      const transformedReport: StockReportData = {
        tanks: stockReport.tanks.map((t) => ({
          tankId: t.tankId,
          tankName: t.tankName,
          productName: t.productName,
          capacity: t.capacity,
          openingStock: t.currentStock,
          totalUnload: 0,
          totalSales: 0,
          totalPumpTest: 0,
          totalOut: 0,
          closingStock: t.currentStock,
          totalVariance: 0,
          fillPercentage: t.capacity > 0 ? Math.round((t.currentStock / t.capacity) * 100) : 0,
        })),
        summary: {
          totalCapacity: stockReport.summary.totalCapacity,
          totalOpeningStock: stockReport.summary.totalStock,
          totalUnload: 0,
          totalSales: 0,
          totalPumpTest: 0,
          totalOut: 0,
          totalClosingStock: stockReport.summary.totalStock,
          totalVariance: 0,
        },
      };
      setReport(transformedReport);
      onReportChange?.(transformedReport);
    } else {
      setReport(null);
      onReportChange?.(null);
    }
  }, [gasStationId, onReportChange]);
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
              Laporan Stock
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Ringkasan stok per tangki dengan unload, penjualan, dan variance
            </div>
          </div>
          {/* Demo mode: no date picker */}
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
