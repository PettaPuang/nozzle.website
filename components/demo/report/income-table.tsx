"use client";

import { useState, useEffect } from "react";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils/format-client";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import type { DateRange } from "react-day-picker";
import { format as formatDate } from "date-fns";
import { id as localeId } from "date-fns/locale";

/**
 * Format UTC date to local date string for display
 * Uses UTC methods to ensure date doesn't shift due to timezone
 */
function formatUTCDate(date: Date, formatStr: string): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return formatDate(localDate, formatStr, { locale: localeId });
}

/**
 * Format UTC date to local date string considering timezone offset
 * Converts UTC date to local timezone date for display
 * Assumes timezone is UTC+8
 *
 * Untuk periodStart: konversi ke tanggal lokal
 * Untuk periodEnd (endOfDayUTC): tetap gunakan tanggal UTC asli karena sudah mewakili akhir hari
 */
function formatUTCDateAsLocal(date: Date, formatStr: string): string {
  // Timezone offset untuk UTC+8 (dalam milliseconds)
  const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;

  // Cek apakah ini endOfDay (23:59:59.999 UTC)
  const isEndOfDay =
    date.getUTCHours() === 23 &&
    date.getUTCMinutes() === 59 &&
    date.getUTCSeconds() === 59 &&
    date.getUTCMilliseconds() >= 999;

  let year: number;
  let month: number;
  let day: number;

  if (isEndOfDay) {
    // Untuk endOfDay, gunakan tanggal UTC asli
    // Karena endOfDayUTC sudah mewakili akhir hari untuk tanggal tertentu
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
  } else {
    // Untuk waktu lainnya, konversi ke tanggal lokal
    const localTime = date.getTime() + TIMEZONE_OFFSET_MS;
    const localDateObj = new Date(localTime);
    year = localDateObj.getUTCFullYear();
    month = localDateObj.getUTCMonth();
    day = localDateObj.getUTCDate();
  }

  // Buat date object untuk formatting
  const localDate = new Date(year, month, day);
  return formatDate(localDate, formatStr, { locale: localeId });
}

type ProductFinancialData = {
  productId: string;
  productName: string;
  volumeWithoutPriceChange: number;
  volumeWithPriceChange: number;
  hasBreakdown: boolean;
  breakdowns?: Array<{
    periodStart: Date;
    periodEnd: Date;
    volume: number;
    sellingPrice?: number;
    purchasePrice?: number;
  }>;
  sellingPrice?: number;
  purchasePrice?: number;
};

type FinancialReportTableProps = {
  isLoading?: boolean;
  gasStationId?: string;
  dateRange?: DateRange;
  incomeData?: any | null; // Data dari parent, jika ada tidak perlu fetch
  financialData?: any | null; // Data dari parent, jika ada tidak perlu fetch
};

export function FinancialReportTable({
  isLoading = false,
  gasStationId,
  dateRange,
  incomeData = null,
  financialData = null,
}: FinancialReportTableProps) {
  const getDateRangeLabel = () => {
    if (!dateRange?.from) return "";

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
  const [reportFromIncomeAPI, setReportFromIncomeAPI] = useState<any>(null);
  const [reportFromFinancialAPI, setReportFromFinancialAPI] =
    useState<any>(null);

  // Jika data sudah diberikan dari parent, gunakan langsung. Jika tidak, fetch sendiri
  useEffect(() => {
    // Jika data sudah diberikan dari props, gunakan langsung dan tidak perlu fetch
    if (incomeData !== null || financialData !== null) {
      if (incomeData !== null) {
        setReportFromIncomeAPI(incomeData);
      }
      if (financialData !== null) {
        setReportFromFinancialAPI(financialData);
      }
      return; // Jangan fetch jika data sudah diberikan
    }

    // Jika data belum diberikan dan gasStationId + dateRange ada, fetch sendiri
    if (!gasStationId || !dateRange?.from || !dateRange?.to) return;

    const fetchIncomeReport = async () => {
      try {
        const startDate = dateRange.from!.toISOString().split("T")[0];
        const endDate = dateRange.to!.toISOString().split("T")[0];

        // Fetch kedua API secara parallel untuk mempercepat loading
        const [incomeResponse, financialResponse] = await Promise.all([
          fetch(
            `/api/reports/income?gasStationId=${gasStationId}&startDate=${startDate}&endDate=${endDate}`
          ),
          fetch(
            `/api/reports/financial?gasStationId=${gasStationId}&startDate=${startDate}&endDate=${endDate}`
          ),
        ]);

        const [incomeResult, financialResult] = await Promise.all([
          incomeResponse.json(),
          financialResponse.json(),
        ]);

        if (incomeResult.success && incomeResult.data) {
          setReportFromIncomeAPI(incomeResult.data);
        }

        if (financialResult.success && financialResult.data) {
          setReportFromFinancialAPI(financialResult.data);
        }
      } catch (error) {
        console.error("Error fetching income report:", error);
      }
    };

    fetchIncomeReport();
  }, [gasStationId, dateRange, incomeData, financialData]);

  // Get products dari Income API
  const getMergedProducts = (): ProductFinancialData[] => {
    if (reportFromIncomeAPI && reportFromIncomeAPI.byProduct) {
      return reportFromIncomeAPI.byProduct.map((p: any) => ({
        productId: p.productId,
        productName: p.productName,
        volumeWithoutPriceChange: p.volumeWithoutPriceChange || 0,
        volumeWithPriceChange: p.volumeWithPriceChange || 0,
        hasBreakdown: p.hasBreakdown || false,
        breakdowns:
          p.breakdowns?.map((b: any) => ({
            periodStart: new Date(b.periodStart),
            periodEnd: new Date(b.periodEnd),
            volume: b.volume,
            sellingPrice: b.sellingPrice || 0,
            purchasePrice: b.purchasePrice || 0,
          })) || [],
        sellingPrice: p.sellingPrice || 0,
        purchasePrice: p.purchasePrice || 0,
      }));
    }
    return [];
  };
  if (isLoading) {
    return (
      <div className="p-2 lg:p-3">
        <div className="text-sm lg:text-base font-semibold mb-1">
          Rincian Pemasukan
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Memuat data...
        </div>
      </div>
    );
  }

  if (!reportFromIncomeAPI) {
    return (
      <div className="p-2 lg:p-3">
        <div className="text-sm lg:text-base font-semibold mb-1">
          Rincian Pemasukan
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Tidak ada data
        </div>
      </div>
    );
  }

  const dateRangeLabel = getDateRangeLabel();

  return (
    <div className="p-2 lg:p-3">
      <div className="mb-2">
        <div className="text-sm lg:text-base font-semibold">
          Rincian Pemasukan{dateRangeLabel ? ` - ${dateRangeLabel}` : ""}
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Detail pemasukan per produk dengan analisis laba
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] lg:w-[150px] py-1.5 lg:py-2 sticky left-0 z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                Produk
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2 w-[60px] lg:w-[80px]">
                Sales (L)
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Margin (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  (Harga Jual - Harga Tebus)
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Pendapatan (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  (Sales(L) x Margin)
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Total Sales (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  (SellPrice x Margin)
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Total Modal (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  (PurchasePrice x Margin)
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Pump Test (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  Pengurangan
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Susut (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  Penyesuaian
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Total HPP (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  Modal + Pump Test + Susut
                </div>
              </TableHead>
              <TableHead className="text-right py-1.5 lg:py-2">
                <div>Laba Kotor (Rp)</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  Sales - HPP
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const products = getMergedProducts();

              return products.map((product: ProductFinancialData) => {
                // Pilih volume: jika ada perubahan harga, gunakan volumeWithPriceChange, else volumeWithoutPriceChange
                const displayVolume =
                  product.volumeWithPriceChange > 0
                    ? product.volumeWithPriceChange
                    : product.volumeWithoutPriceChange;

                // Jika ada breakdown, tampilkan dengan detail periode
                if (
                  product.hasBreakdown &&
                  product.breakdowns &&
                  product.breakdowns.length > 0
                ) {
                  return (
                    <React.Fragment key={product.productId}>
                      {/* Main row dengan nama produk dan total */}
                      <TableRow className="hover:bg-gray-50 font-semibold">
                        <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                          <ProductBadge productName={product.productName} />
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {formatNumber(
                            product.breakdowns.reduce(
                              (sum, b) => sum + b.volume,
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-gray-400">
                          {/* Margin tidak ditampilkan untuk row utama produk dengan breakdown */}
                          -
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-green-600">
                          {/* Pendapatan = Sales Volume × Margin */}
                          {formatCurrency(
                            product.breakdowns.reduce(
                              (sum, b) => {
                                const margin = (b.sellingPrice && b.purchasePrice)
                                  ? b.sellingPrice - b.purchasePrice
                                  : 0;
                                return sum + (b.volume > 0 ? b.volume * margin : 0);
                              },
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-green-600 font-semibold">
                          {/* Total Sales */}
                          {formatCurrency(
                            product.breakdowns.reduce(
                              (sum, b) =>
                                sum +
                                (b.sellingPrice &&
                                b.sellingPrice > 0 &&
                                b.volume > 0
                                  ? b.volume * b.sellingPrice
                                  : 0),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-red-600">
                          {/* Total Modal */}
                          {formatCurrency(
                            product.breakdowns.reduce(
                              (sum, b) =>
                                sum +
                                (b.purchasePrice &&
                                b.purchasePrice > 0 &&
                                b.volume > 0
                                  ? b.volume * b.purchasePrice
                                  : 0),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-red-600">
                          {/* Pump Test */}
                          {(() => {
                            const stockValue =
                              reportFromFinancialAPI?.stockValues?.byProduct?.find(
                                (sv: any) => sv.productId === product.productId
                              );
                            const pumpTestValue = stockValue?.pumpTestValue || 0;
                            const pumpTestVolume = stockValue?.pumpTestVolume || 0;
                            return (
                              <div>
                                <div>{formatCurrency(pumpTestValue)}</div>
                                {pumpTestVolume > 0 && (
                                  <div className="text-[10px] text-gray-400">
                                    {formatNumber(pumpTestVolume)} L
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {/* Susut */}
                          {(() => {
                            const stockValue =
                              reportFromFinancialAPI?.stockValues?.byProduct?.find(
                                (sv: any) => sv.productId === product.productId
                              );
                            const shrinkageValue =
                              stockValue?.shrinkageValue || 0;
                            const shrinkageVolume = stockValue?.shrinkageVolume || 0;
                            return (
                              <div>
                                <span
                                  className={
                                    shrinkageValue > 0
                                      ? "text-red-600"
                                      : shrinkageValue < 0
                                      ? "text-green-600"
                                      : ""
                                  }
                                >
                                  {formatCurrency(shrinkageValue)}
                                </span>
                                {shrinkageVolume !== 0 && (
                                  <div className="text-[10px] text-gray-400">
                                    {shrinkageVolume > 0 ? "+" : ""}
                                    {formatNumber(shrinkageVolume)} L
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {/* Total HPP = Modal + PumpTest + Susut */}
                          {(() => {
                            const totalModal = product.breakdowns.reduce(
                              (sum, b) =>
                                sum +
                                (b.purchasePrice &&
                                b.purchasePrice > 0 &&
                                b.volume > 0
                                  ? b.volume * b.purchasePrice
                                  : 0),
                              0
                            );
                            const stockValue =
                              reportFromFinancialAPI?.stockValues?.byProduct?.find(
                                (sv: any) => sv.productId === product.productId
                              );
                            const pumpTestValue =
                              stockValue?.pumpTestValue || 0;
                            const shrinkageValue =
                              stockValue?.shrinkageValue || 0;
                            const hpp =
                              totalModal + pumpTestValue + shrinkageValue;

                            return (
                              <span
                                className={
                                  hpp > 0
                                    ? "text-red-600 font-semibold"
                                    : hpp < 0
                                    ? "text-green-600 font-semibold"
                                    : "font-semibold"
                                }
                              >
                                {formatCurrency(hpp)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {/* Laba kotor = Total Sales - Total HPP */}
                          {(() => {
                            const totalSales = product.breakdowns.reduce(
                              (sum, b) =>
                                sum +
                                (b.sellingPrice &&
                                b.sellingPrice > 0 &&
                                b.volume > 0
                                  ? b.volume * b.sellingPrice
                                  : 0),
                              0
                            );

                            // Hitung Total HPP = Modal + Pump Test + Susut
                            const totalModal = product.breakdowns.reduce(
                              (sum, b) =>
                                sum +
                                (b.purchasePrice &&
                                b.purchasePrice > 0 &&
                                b.volume > 0
                                  ? b.volume * b.purchasePrice
                                  : 0),
                              0
                            );
                            const stockValue =
                              reportFromFinancialAPI?.stockValues?.byProduct?.find(
                                (sv: any) => sv.productId === product.productId
                              );
                            const pumpTestValue =
                              stockValue?.pumpTestValue || 0;
                            const shrinkageValue =
                              stockValue?.shrinkageValue || 0;
                            const totalHPP =
                              totalModal + pumpTestValue + shrinkageValue;

                            const labaKotor = totalSales - totalHPP;
                            return (
                              <span
                                className={
                                  labaKotor < 0
                                    ? "text-red-600 font-semibold"
                                    : labaKotor > 0
                                    ? "text-green-600 font-semibold"
                                    : "font-semibold"
                                }
                              >
                                {formatCurrency(labaKotor)}
                              </span>
                            );
                          })()}
                        </TableCell>
                      </TableRow>

                      {/* Breakdown rows */}
                      {product.breakdowns.map((breakdown, idx) => {
                        const startStr = formatUTCDateAsLocal(
                          breakdown.periodStart,
                          "d MMM"
                        );
                        const endStr = formatUTCDateAsLocal(
                          breakdown.periodEnd,
                          "d MMM"
                        );
                        const periodLabel = `(${startStr} - ${endStr})`;

                        return (
                          <TableRow
                            key={`${product.productId}-breakdown-${idx}`}
                            className="bg-gray-50 hover:bg-gray-100"
                          >
                            <TableCell className="py-1.5 lg:py-2 pl-6 sticky left-0 z-10 bg-gray-50 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                              <div className="text-[10px] lg:text-xs text-muted-foreground">
                                {periodLabel}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2">
                              {formatNumber(breakdown.volume)}
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2">
                              {/* Margin per Liter dengan breakdown harga */}
                              {(() => {
                                const margin =
                                  breakdown.sellingPrice &&
                                  breakdown.sellingPrice > 0 &&
                                  breakdown.purchasePrice &&
                                  breakdown.purchasePrice > 0
                                    ? breakdown.sellingPrice -
                                      breakdown.purchasePrice
                                    : 0;

                                return (
                                  <div>
                                    <div>{formatCurrency(margin)}</div>
                                    {breakdown.sellingPrice &&
                                    breakdown.purchasePrice ? (
                                      <div className="text-[10px] text-gray-400">
                                        (
                                        {formatCurrency(breakdown.sellingPrice)}{" "}
                                        -{" "}
                                        {formatCurrency(
                                          breakdown.purchasePrice
                                        )}
                                        )
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-gray-400">
                                        -
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2 text-green-600">
                              {/* Pendapatan = Sales Volume × Margin */}
                              {(() => {
                                const margin = (breakdown.sellingPrice && breakdown.purchasePrice)
                                  ? breakdown.sellingPrice - breakdown.purchasePrice
                                  : 0;
                                return breakdown.volume > 0 && margin > 0
                                  ? formatCurrency(breakdown.volume * margin)
                                  : "-";
                              })()}
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2">
                              {/* Total Sales */}
                              {breakdown.sellingPrice &&
                              breakdown.sellingPrice > 0 &&
                              breakdown.volume > 0
                                ? formatCurrency(
                                    breakdown.volume * breakdown.sellingPrice
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2">
                              {/* Total Modal */}
                              {breakdown.purchasePrice &&
                              breakdown.purchasePrice > 0 &&
                              breakdown.volume > 0
                                ? formatCurrency(
                                    breakdown.volume * breakdown.purchasePrice
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2 text-gray-400">
                              <div>-</div>
                              <div className="text-[10px] text-gray-400">-</div>
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2 text-gray-400">
                              <div>-</div>
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2 text-gray-400">
                              <div>-</div>
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5 lg:py-2 text-gray-400">
                              <div>-</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                }

                // Produk tanpa breakdown
                return (
                  <TableRow
                    key={product.productId}
                    className="hover:bg-gray-50"
                  >
                    <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                      <ProductBadge productName={product.productName} />
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatNumber(displayVolume)}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {/* Margin per Liter dengan breakdown harga */}
                      {(() => {
                        const margin =
                          product.sellingPrice &&
                          product.sellingPrice > 0 &&
                          product.purchasePrice &&
                          product.purchasePrice > 0
                            ? product.sellingPrice - product.purchasePrice
                            : 0;

                        return (
                          <div>
                            <div>{formatCurrency(margin)}</div>
                            {product.sellingPrice && product.purchasePrice ? (
                              <div className="text-[10px] text-gray-400">
                                ({formatCurrency(product.sellingPrice)} -{" "}
                                {formatCurrency(product.purchasePrice)})
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-400">-</div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2 text-green-600">
                      {/* Pendapatan = Sales Volume × Margin */}
                      {(() => {
                        const margin = (product.sellingPrice && product.purchasePrice)
                          ? product.sellingPrice - product.purchasePrice
                          : 0;
                        return displayVolume > 0 && margin > 0
                          ? formatCurrency(displayVolume * margin)
                          : "-";
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2 text-green-600 font-semibold">
                      {/* Total Sales */}
                      {product.sellingPrice &&
                      product.sellingPrice > 0 &&
                      displayVolume > 0
                        ? formatCurrency(displayVolume * product.sellingPrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2 text-red-600">
                      {/* Total Modal */}
                      {product.purchasePrice &&
                      product.purchasePrice > 0 &&
                      displayVolume > 0
                        ? formatCurrency(displayVolume * product.purchasePrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2 text-red-600">
                      {/* Pump Test */}
                      {(() => {
                        const stockValue =
                          reportFromFinancialAPI?.stockValues?.byProduct?.find(
                            (sv: any) => sv.productId === product.productId
                          );
                        const pumpTestValue = stockValue?.pumpTestValue || 0;
                        const pumpTestVolume = stockValue?.pumpTestVolume || 0;
                        return (
                          <div>
                            <div>{formatCurrency(pumpTestValue)}</div>
                            {pumpTestVolume > 0 && (
                              <div className="text-[10px] text-gray-400">
                                {formatNumber(pumpTestVolume)} L
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {/* Susut */}
                      {(() => {
                        const stockValue =
                          reportFromFinancialAPI?.stockValues?.byProduct?.find(
                            (sv: any) => sv.productId === product.productId
                          );
                        const shrinkageValue = stockValue?.shrinkageValue || 0;
                        const shrinkageVolume = stockValue?.shrinkageVolume || 0;
                        return (
                          <div>
                            <span
                              className={
                                shrinkageValue > 0
                                  ? "text-red-600"
                                  : shrinkageValue < 0
                                  ? "text-green-600"
                                  : ""
                              }
                            >
                              {formatCurrency(shrinkageValue)}
                            </span>
                            {shrinkageVolume !== 0 && (
                              <div className="text-[10px] text-gray-400">
                                {shrinkageVolume > 0 ? "+" : ""}
                                {formatNumber(shrinkageVolume)} L
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {/* Total HPP = Modal + PumpTest + Susut */}
                      {(() => {
                        const totalModal =
                          product.purchasePrice &&
                          product.purchasePrice > 0 &&
                          displayVolume > 0
                            ? displayVolume * product.purchasePrice
                            : 0;
                        const stockValue =
                          reportFromFinancialAPI?.stockValues?.byProduct?.find(
                            (sv: any) => sv.productId === product.productId
                          );
                        const pumpTestValue = stockValue?.pumpTestValue || 0;
                        const shrinkageValue = stockValue?.shrinkageValue || 0;
                        const hpp = totalModal + pumpTestValue + shrinkageValue;

                        return (
                          <span
                            className={
                              hpp > 0
                                ? "text-red-600 font-semibold"
                                : hpp < 0
                                ? "text-green-600 font-semibold"
                                : "font-semibold"
                            }
                          >
                            {formatCurrency(hpp)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {/* Laba kotor = Total Sales - Total HPP */}
                      {(() => {
                        const totalSales =
                          product.sellingPrice &&
                          product.sellingPrice > 0 &&
                          displayVolume > 0
                            ? displayVolume * product.sellingPrice
                            : 0;

                        // Hitung Total HPP = Modal + Pump Test + Susut
                        const totalModal =
                          product.purchasePrice &&
                          product.purchasePrice > 0 &&
                          displayVolume > 0
                            ? displayVolume * product.purchasePrice
                            : 0;
                        const stockValue =
                          reportFromFinancialAPI?.stockValues?.byProduct?.find(
                            (sv: any) => sv.productId === product.productId
                          );
                        const pumpTestValue = stockValue?.pumpTestValue || 0;
                        const shrinkageValue = stockValue?.shrinkageValue || 0;
                        const totalHPP =
                          totalModal + pumpTestValue + shrinkageValue;

                        const labaKotor = totalSales - totalHPP;
                        return (
                          <span
                            className={
                              labaKotor < 0
                                ? "text-red-600 font-semibold"
                                : labaKotor > 0
                                ? "text-green-600 font-semibold"
                                : "font-semibold"
                            }
                          >
                            {formatCurrency(labaKotor)}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              });
            })()}

            {/* Total Row */}
            <TableRow className="bg-gray-100 font-semibold">
              <TableCell className="py-1.5 lg:py-2 sticky left-0 z-10 bg-gray-100 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                TOTAL
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2">
                {formatNumber(
                  getMergedProducts().reduce((sum, p) => {
                    const vol =
                      p.volumeWithPriceChange > 0
                        ? p.volumeWithPriceChange
                        : p.volumeWithoutPriceChange;
                    return sum + vol;
                  }, 0)
                )}
              </TableCell>
              <TableCell className="py-1.5 lg:py-2">
                {/* Total row tidak menampilkan margin */}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2 text-green-600">
                {/* Total Pendapatan */}
                {formatCurrency(
                  getMergedProducts().reduce((sum, p) => {
                    if (p.hasBreakdown && p.breakdowns) {
                      return (
                        sum +
                        p.breakdowns.reduce((breakdownSum, b) => {
                          const margin = (b.sellingPrice && b.purchasePrice)
                            ? b.sellingPrice - b.purchasePrice
                            : 0;
                          return breakdownSum + (b.volume > 0 ? b.volume * margin : 0);
                        }, 0)
                      );
                    } else {
                      const vol =
                        p.volumeWithPriceChange > 0
                          ? p.volumeWithPriceChange
                          : p.volumeWithoutPriceChange;
                      const margin = (p.sellingPrice && p.purchasePrice)
                        ? p.sellingPrice - p.purchasePrice
                        : 0;
                      return sum + (vol > 0 && margin > 0 ? vol * margin : 0);
                    }
                  }, 0)
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2 text-green-600 font-semibold">
                {/* Total Sales - hitung dari breakdown atau produk */}
                {formatCurrency(
                  getMergedProducts().reduce((sum, p) => {
                    if (p.hasBreakdown && p.breakdowns) {
                      return (
                        sum +
                        p.breakdowns.reduce((breakdownSum, b) => {
                          return (
                            breakdownSum +
                            (b.sellingPrice &&
                            b.sellingPrice > 0 &&
                            b.volume > 0
                              ? b.volume * b.sellingPrice
                              : 0)
                          );
                        }, 0)
                      );
                    } else {
                      const vol =
                        p.volumeWithPriceChange > 0
                          ? p.volumeWithPriceChange
                          : p.volumeWithoutPriceChange;
                      return (
                        sum +
                        (p.sellingPrice && p.sellingPrice > 0 && vol > 0
                          ? vol * p.sellingPrice
                          : 0)
                      );
                    }
                  }, 0)
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2 text-red-600">
                {/* Total Modal */}
                {formatCurrency(
                  getMergedProducts().reduce((sum, p) => {
                    const vol =
                      p.volumeWithPriceChange > 0
                        ? p.volumeWithPriceChange
                        : p.volumeWithoutPriceChange;
                    if (p.hasBreakdown && p.breakdowns) {
                      return (
                        sum +
                        p.breakdowns.reduce((breakdownSum, b) => {
                          return (
                            breakdownSum +
                            (b.purchasePrice &&
                            b.purchasePrice > 0 &&
                            b.volume > 0
                              ? b.volume * b.purchasePrice
                              : 0)
                          );
                        }, 0)
                      );
                    } else {
                      return (
                        sum +
                        (p.purchasePrice && p.purchasePrice > 0 && vol > 0
                          ? vol * p.purchasePrice
                          : 0)
                      );
                    }
                  }, 0)
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2 text-red-600">
                {/* Total Pump Test */}
                {(() => {
                  const totalPumpTestValue =
                    reportFromFinancialAPI?.stockValues?.totalPumpTestValue || 0;
                  const totalPumpTestVolume = getMergedProducts().reduce((sum, p) => {
                    const stockValue =
                      reportFromFinancialAPI?.stockValues?.byProduct?.find(
                        (sv: any) => sv.productId === p.productId
                      );
                    return sum + (stockValue?.pumpTestVolume || 0);
                  }, 0);
                  return (
                    <div>
                      <div>{formatCurrency(totalPumpTestValue)}</div>
                      {totalPumpTestVolume > 0 && (
                        <div className="text-[10px] text-gray-400">
                          {formatNumber(totalPumpTestVolume)} L
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2">
                {/* Total Susut */}
                {(() => {
                  const totalShrinkage =
                    reportFromFinancialAPI?.stockValues?.totalShrinkageValue ||
                    0;
                  const totalShrinkageVolume = getMergedProducts().reduce((sum, p) => {
                    const stockValue =
                      reportFromFinancialAPI?.stockValues?.byProduct?.find(
                        (sv: any) => sv.productId === p.productId
                      );
                    return sum + (stockValue?.shrinkageVolume || 0);
                  }, 0);
                  return (
                    <div>
                      <span
                        className={
                          totalShrinkage > 0
                            ? "text-red-600"
                            : totalShrinkage < 0
                            ? "text-green-600"
                            : ""
                        }
                      >
                        {formatCurrency(totalShrinkage)}
                      </span>
                      {totalShrinkageVolume !== 0 && (
                        <div className="text-[10px] text-gray-400">
                          {totalShrinkageVolume > 0 ? "+" : ""}
                          {formatNumber(totalShrinkageVolume)} L
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2">
                {/* Total HPP = Total Modal + Pump Test + Susut */}
                {(() => {
                  const totalModal = getMergedProducts().reduce((sum, p) => {
                    const vol =
                      p.volumeWithPriceChange > 0
                        ? p.volumeWithPriceChange
                        : p.volumeWithoutPriceChange;
                    if (p.hasBreakdown && p.breakdowns) {
                      return (
                        sum +
                        p.breakdowns.reduce((breakdownSum, b) => {
                          return (
                            breakdownSum +
                            (b.purchasePrice &&
                            b.purchasePrice > 0 &&
                            b.volume > 0
                              ? b.volume * b.purchasePrice
                              : 0)
                          );
                        }, 0)
                      );
                    } else {
                      return (
                        sum +
                        (p.purchasePrice && p.purchasePrice > 0 && vol > 0
                          ? vol * p.purchasePrice
                          : 0)
                      );
                    }
                  }, 0);

                  const totalPumpTest =
                    reportFromFinancialAPI?.stockValues?.totalPumpTestValue ||
                    0;
                  const totalShrinkage =
                    reportFromFinancialAPI?.stockValues?.totalShrinkageValue ||
                    0;
                  const totalHPP = totalModal + totalPumpTest + totalShrinkage;

                  return (
                    <span
                      className={
                        totalHPP > 0
                          ? "text-red-600 font-semibold"
                          : totalHPP < 0
                          ? "text-green-600 font-semibold"
                          : "font-semibold"
                      }
                    >
                      {formatCurrency(totalHPP)}
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs lg:text-sm py-1.5 lg:py-2">
                {/* Total Laba Kotor = Total Sales - Total HPP */}
                {(() => {
                  const totalSales =
                    reportFromFinancialAPI?.income?.totalSales || 0;
                  const totalModal = getMergedProducts().reduce((sum, p) => {
                    const vol =
                      p.volumeWithPriceChange > 0
                        ? p.volumeWithPriceChange
                        : p.volumeWithoutPriceChange;
                    if (p.hasBreakdown && p.breakdowns) {
                      return (
                        sum +
                        p.breakdowns.reduce((breakdownSum, b) => {
                          return (
                            breakdownSum +
                            (b.purchasePrice &&
                            b.purchasePrice > 0 &&
                            b.volume > 0
                              ? b.volume * b.purchasePrice
                              : 0)
                          );
                        }, 0)
                      );
                    } else {
                      return (
                        sum +
                        (p.purchasePrice && p.purchasePrice > 0 && vol > 0
                          ? vol * p.purchasePrice
                          : 0)
                      );
                    }
                  }, 0);

                  const totalPumpTest =
                    reportFromFinancialAPI?.stockValues?.totalPumpTestValue ||
                    0;
                  const totalShrinkage =
                    reportFromFinancialAPI?.stockValues?.totalShrinkageValue ||
                    0;
                  const totalHPP = totalModal + totalPumpTest + totalShrinkage;
                  const labaKotor = totalSales - totalHPP;

                  return (
                    <span
                      className={
                        labaKotor < 0
                          ? "text-red-600 font-semibold"
                          : labaKotor > 0
                          ? "text-green-600 font-semibold"
                          : "font-semibold"
                      }
                    >
                      {formatCurrency(labaKotor)}
                    </span>
                  );
                })()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
