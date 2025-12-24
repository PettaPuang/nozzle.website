"use client";

import { useState, useEffect } from "react";
// Demo mode: no session needed
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils/format-client";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { toast } from "sonner";
import {
  startOfDayUTC,
  endOfDayUTC,
} from "@/lib/utils/datetime";

type ProfitLossTableProps = {
  gasStationId: string;
  dateRange: DateRange;
};

export function ProfitLossTable({
  gasStationId,
  dateRange: dateRangeProp,
}: ProfitLossTableProps) {
  // Demo mode: no session needed

  const [report, setReport] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedHPP, setExpandedHPP] = useState<Set<string>>(new Set());

  const handleExportDisabled = () => {
    toast.info("Fitur export tidak tersedia di demo experience");
  };

  // Use dateRange from props
  const dateRange = dateRangeProp;

  // Fetch financial and stock data when date range changes
  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange.from || !dateRange.to) return;

      setIsLoading(true);
      try {
        // Fetch financial data
        const financialParams = new URLSearchParams({
          gasStationId,
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        });
        const financialResponse = await fetch(
          `/api/reports/financial?${financialParams}`
        );
        const financialResult = await financialResponse.json();

        // Fetch stock data
        const stockParams = new URLSearchParams({
          gasStationId,
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        });
        const stockResponse = await fetch(`/api/reports/stock?${stockParams}`);
        const stockResult = await stockResponse.json();

        if (financialResult.success) {
          setReport(financialResult.data);
        } else {
          setReport(null);
        }

        if (stockResult.success) {
          setStockReport(stockResult.data);
        } else {
          setStockReport(null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setReport(null);
        setStockReport(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [gasStationId, dateRange]);

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


  const toggleHPP = (key: string) => {
    const newExpanded = new Set(expandedHPP);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedHPP(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Laporan Laba Rugi
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
            Laporan Laba Rugi
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Pilih rentang tanggal untuk melihat laporan laba rugi
          </div>
        </div>
      </div>
    );
  }

  // Calculate HPP breakdown using stock values (volume * product price)
  // Sederhana: ambil langsung volume dari stockReport yang sudah lengkap, lalu kalikan dengan purchasePrice
  // PENTING: Gabungkan semua produk dari income DAN stockReport agar produk tanpa penjualan tetap muncul
  // Aggregate all tanks per product (1 product can have multiple tanks)

  // 1. Buat map semua produk dari income (yang ada penjualan)
  const productsFromIncome = new Map<string, any>();
  report.income.byProduct.forEach((product: any) => {
    productsFromIncome.set(product.productId, {
      ...product,
      hasSales: true,
    });
  });

  // 2. Tambahkan produk dari stockReport yang belum ada di income (yang tidak ada penjualan)
  stockReport?.tanks.forEach((tank: any) => {
    if (tank.productId && !productsFromIncome.has(tank.productId)) {
      // Cari stockValues untuk mendapatkan purchasePrice (dari perhitungan backend)
      const stockValue = report.stockValues?.byProduct?.find(
        (sv: any) => sv.productId === tank.productId
      );

      // Hitung purchasePrice dari stockValues jika ada
      // purchasePrice = purchaseValue / purchaseVolume (jika purchaseVolume > 0)
      let purchasePrice = 0;
      if (stockValue) {
        const purchaseVolume = stockReport.tanks
          .filter((t: any) => t.productId === tank.productId)
          .reduce((sum: number, t: any) => sum + (t.totalUnload || 0), 0);
        if (purchaseVolume > 0 && stockValue.purchaseValue > 0) {
          purchasePrice = stockValue.purchaseValue / purchaseVolume;
        } else if (stockValue.openingValue > 0) {
          // Fallback: gunakan openingValue / openingStock
          const openingStock = stockReport.tanks
            .filter((t: any) => t.productId === tank.productId)
            .reduce((sum: number, t: any) => sum + (t.openingStock || 0), 0);
          if (openingStock > 0) {
            purchasePrice = stockValue.openingValue / openingStock;
          }
        }
      }

      productsFromIncome.set(tank.productId, {
        productId: tank.productId,
        productName: tank.productName,
        totalSales: 0, // Tidak ada penjualan
        purchasePrice,
        hasSales: false,
      });
    }
  });

  // 3. Sekarang iterate dari semua produk (income + stock tanpa penjualan)
  const hppBreakdown = Array.from(productsFromIncome.values()).map(
    (product: any) => {
      // Filter all tanks for this product by productId (lebih reliable daripada productName)
      let productTanks =
        stockReport?.tanks.filter(
          (t: any) => t.productId === product.productId
        ) || [];

      // FALLBACK: Jika tidak ada tank yang match dengan productId, coba match dengan productName
      // Ini untuk handle kasus dimana productId tidak match (mungkin karena data lama atau mismatch)
      if (productTanks.length === 0) {
        productTanks =
          stockReport?.tanks.filter(
            (t: any) => t.productName === product.productName
          ) || [];
      }

      // Aggregate volumes from all tanks for this product (langsung dari stockReport)
      const openingStock = productTanks.reduce(
        (sum: number, t: any) => sum + (t.openingStock || 0),
        0
      );
      const purchases = productTanks.reduce(
        (sum: number, t: any) => sum + (t.totalUnload || 0),
        0
      );
      const closingStock = productTanks.reduce(
        (sum: number, t: any) => sum + (t.closingStock || 0),
        0
      );
      const variance = productTanks.reduce(
        (sum: number, t: any) => sum + (t.totalVariance || 0),
        0
      );

      // Match by productId untuk konsistensi (sama seperti filter tanks di atas)
      const stockValues = report.stockValues?.byProduct?.find(
        (sv: any) => sv.productId === product.productId
      );

      // Untuk produk dengan penjualan: gunakan totalCost dari income table (sudah menghitung berdasarkan purchasePrice saat penjualan)
      // Untuk produk tanpa penjualan: hitung HPP berdasarkan stock movement
      if (product.hasSales) {
        // Ambil totalCost dari income table untuk produk ini
        const incomeProduct = report.income.byProduct.find(
          (p: any) => p.productId === product.productId
        );
        const cogsFromIncome = incomeProduct?.totalCost || 0;

        // Untuk display, tetap hitung nilai-nilai individual
        // Ambil purchasePrice: dari product.purchasePrice jika ada, atau hitung dari stockValues
        let purchasePrice = product.purchasePrice || 0;
        if (purchasePrice === 0 && stockValues) {
          if (purchases > 0 && stockValues.purchaseValue > 0) {
            purchasePrice = stockValues.purchaseValue / purchases;
          } else if (openingStock > 0 && stockValues.openingValue > 0) {
            purchasePrice = stockValues.openingValue / openingStock;
          } else if (closingStock > 0 && stockValues.closingValue > 0) {
            purchasePrice = stockValues.closingValue / closingStock;
          }
        }

        const openingValue =
          stockValues?.openingValue ?? openingStock * purchasePrice;
        const purchaseValue =
          stockValues?.purchaseValue ?? purchases * purchasePrice;
        const closingValue =
          stockValues?.closingValue ?? closingStock * purchasePrice;

        const pumpTestValue = stockValues?.pumpTestValue ?? 0;

        return {
          productName: product.productName,
          openingStock,
          openingValue,
          purchases,
          purchaseValue,
          variance, // Untuk display saja, tidak digunakan dalam perhitungan HPP
          pumpTestValue,
          closingStock,
          closingValue,
          cogs: cogsFromIncome, // Gunakan totalCost dari income table
        };
      } else {
        // Produk tanpa penjualan: hitung HPP berdasarkan stock movement
        let purchasePrice = product.purchasePrice || 0;
        if (purchasePrice === 0 && stockValues) {
          if (purchases > 0 && stockValues.purchaseValue > 0) {
            purchasePrice = stockValues.purchaseValue / purchases;
          } else if (openingStock > 0 && stockValues.openingValue > 0) {
            purchasePrice = stockValues.openingValue / openingStock;
          } else if (closingStock > 0 && stockValues.closingValue > 0) {
            purchasePrice = stockValues.closingValue / closingStock;
          }
        }

        const openingValue =
          stockValues?.openingValue ?? openingStock * purchasePrice;
        const purchaseValue =
          stockValues?.purchaseValue ?? purchases * purchasePrice;
        const closingValue =
          stockValues?.closingValue ?? closingStock * purchasePrice;

        const pumpTestValue = stockValues?.pumpTestValue ?? 0;

        return {
          productName: product.productName,
          openingStock,
          openingValue,
          purchases,
          purchaseValue,
          variance, // Untuk display saja, tidak digunakan dalam perhitungan HPP
          pumpTestValue,
          closingStock,
          closingValue,
          cogs:
            openingValue + purchaseValue - pumpTestValue - closingValue,
        };
      }
    }
  );

  // Gunakan totalCost dari income table untuk total HPP (karena sudah menghitung berdasarkan purchasePrice saat penjualan)
  // Tapi tetap hitung breakdown untuk display
  
  // Untuk display breakdown, tetap hitung nilai-nilai individual
  const totalOpeningValue =
    report.stockValues?.totalOpeningValue ??
    hppBreakdown.reduce((sum: number, item: any) => sum + item.openingValue, 0);
  const totalPurchaseValue =
    report.stockValues?.totalPurchaseValue ??
    hppBreakdown.reduce(
      (sum: number, item: any) => sum + item.purchaseValue,
      0
    );
  const totalPumpTestValue =
    report.stockValues?.totalPumpTestValue ??
    hppBreakdown.reduce((sum: number, item: any) => sum + (item.pumpTestValue || 0), 0);
  const totalClosingValue =
    report.stockValues?.totalClosingValue ??
    hppBreakdown.reduce((sum: number, item: any) => sum + item.closingValue, 0);

  // UPDATE: Hitung Total HPP langsung dari Stock Awal + Pembelian - Stock Akhir
  const totalCOGS = totalOpeningValue + totalPurchaseValue - totalClosingValue;

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3">
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4 mb-2">
          <div className="flex-1">
            <div className="text-base lg:text-lg font-semibold">
              Laporan Laba Rugi{getDateRangeLabel() ? ` - ${getDateRangeLabel()}` : ""}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Income Statement - Profit & Loss
            </div>
          </div>
          <div className="flex gap-1.5 lg:gap-2 shrink-0 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!report}
                  className="text-xs lg:text-sm h-8 lg:h-9"
                  onClick={handleExportDisabled}
                >
                  <Download className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDisabled}>
                  Export ke PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportDisabled}>
                  Export ke Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="p-2 lg:p-3">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Optimized for landscape: reduce width untuk lebih banyak kolom visible */}
                <TableHead className="w-[150px] lg:w-[300px] py-1.5 lg:py-2">
                  Keterangan
                </TableHead>
                <TableHead className="text-right py-1.5 lg:py-2">
                  Jumlah (Rp)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenue Section */}
              <TableRow className="bg-blue-50">
                <TableCell className="font-bold py-1.5 lg:py-2">
                  PENDAPATAN
                </TableCell>
                <TableCell className="py-1.5 lg:py-2"></TableCell>
              </TableRow>
              {(() => {
                // Aggregate pendapatan per produk (gabungkan jika ada breakdown per perubahan harga)
                const productMap = new Map<string, { productName: string; totalSales: number }>();
                
                report.income.byProduct.forEach((product: any) => {
                  const key = product.productId || product.productName;
                  if (productMap.has(key)) {
                    const existing = productMap.get(key)!;
                    existing.totalSales += product.totalSales;
                  } else {
                    productMap.set(key, {
                      productName: product.productName,
                      totalSales: product.totalSales,
                    });
                  }
                });

                return Array.from(productMap.values()).map((product, idx) => (
                  <TableRow key={`revenue-${idx}`}>
                    <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                      <div className="flex items-center gap-1.5 lg:gap-2">
                        Penjualan
                        <ProductBadge productName={product.productName} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatCurrency(product.totalSales)}
                    </TableCell>
                  </TableRow>
                ));
              })()}
              <TableRow className="border-t font-semibold">
                <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                  Total Pendapatan
                </TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(report.income.totalSales)}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* COGS Section */}
              <TableRow className="bg-red-50">
                <TableCell className="font-bold py-1.5 lg:py-2">
                  HARGA POKOK PENJUALAN (HPP)
                </TableCell>
                <TableCell className="py-1.5 lg:py-2"></TableCell>
              </TableRow>

              {/* Stock Awal */}
              <TableRow
                className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleHPP("opening")}
              >
                <TableCell className="pl-3 lg:pl-6 font-semibold py-1.5 lg:py-2">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 lg:h-6 lg:w-6 -ml-2"
                    >
                      {expandedHPP.has("opening") ? (
                        <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                      ) : (
                        <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                      )}
                    </Button>
                    Stock Awal:
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold py-1.5 lg:py-2">
                  {formatCurrency(totalOpeningValue)}
                </TableCell>
              </TableRow>
              {expandedHPP.has("opening") &&
                hppBreakdown.map((item: any, idx: number) => (
                  <TableRow key={`opening-${idx}`} className="bg-gray-50/50">
                    <TableCell className="pl-6 lg:pl-12 flex items-center gap-1.5 lg:gap-2 py-1.5 lg:py-2">
                      <ProductBadge productName={item.productName} />
                      <span className="text-gray-500 text-[10px] lg:text-xs">
                        ({formatNumber(item.openingStock)} L)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatCurrency(item.openingValue)}
                    </TableCell>
                  </TableRow>
                ))}

              {/* Pembelian */}
              <TableRow
                className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleHPP("purchase")}
              >
                <TableCell className="pl-3 lg:pl-6 font-semibold py-1.5 lg:py-2">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 lg:h-6 lg:w-6 -ml-2"
                    >
                      {expandedHPP.has("purchase") ? (
                        <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                      ) : (
                        <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                      )}
                    </Button>
                    Pembelian:
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold py-1.5 lg:py-2">
                  {formatCurrency(totalPurchaseValue)}
                </TableCell>
              </TableRow>
              {expandedHPP.has("purchase") &&
                hppBreakdown.map((item: any, idx: number) => (
                  <TableRow key={`purchase-${idx}`} className="bg-gray-50/50">
                    <TableCell className="pl-6 lg:pl-12 flex items-center gap-1.5 lg:gap-2 py-1.5 lg:py-2">
                      <ProductBadge productName={item.productName} />
                      <span className="text-gray-500 text-[10px] lg:text-xs">
                        ({formatNumber(item.purchases)} L)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2">
                      {formatCurrency(item.purchaseValue)}
                    </TableCell>
                  </TableRow>
                ))}

              {/* Stock Akhir */}
              <TableRow
                className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleHPP("closing")}
              >
                <TableCell className="pl-3 lg:pl-6 font-semibold py-1.5 lg:py-2">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 lg:h-6 lg:w-6 -ml-2"
                    >
                      {expandedHPP.has("closing") ? (
                        <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                      ) : (
                        <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                      )}
                    </Button>
                    Stock Akhir:
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-red-600 py-1.5 lg:py-2">
                  ({formatCurrency(totalClosingValue)})
                </TableCell>
              </TableRow>
              {expandedHPP.has("closing") &&
                hppBreakdown.map((item: any, idx: number) => (
                  <TableRow key={`closing-${idx}`} className="bg-gray-50/50">
                    <TableCell className="pl-6 lg:pl-12 flex items-center gap-1.5 lg:gap-2 py-1.5 lg:py-2">
                      <ProductBadge productName={item.productName} />
                      <span className="text-gray-500 text-[10px] lg:text-xs">
                        ({formatNumber(item.closingStock)} L)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 py-1.5 lg:py-2">
                      ({formatCurrency(item.closingValue)})
                    </TableCell>
                  </TableRow>
                ))}

              {/* Total HPP */}

              <TableRow className="border-t-2 font-semibold">
                <TableCell className="pl-3 lg:pl-6 py-1.5 lg:py-2">
                  Total HPP
                </TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(totalCOGS)}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* Gross Profit */}
              <TableRow className="border-t-2 bg-green-50 font-semibold">
                <TableCell className="py-1.5 lg:py-2">LABA KOTOR</TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(report.income.totalSales - totalCOGS)}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* Operating Expenses */}
              <TableRow className="bg-orange-50">
                <TableCell className="font-bold py-1.5 lg:py-2">
                  BEBAN OPERASIONAL
                </TableCell>
                <TableCell className="py-1.5 lg:py-2"></TableCell>
              </TableRow>
              {report.expenses?.byCategory?.map((category: any) => (
                <TableRow key={category.category}>
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    {category.category}
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(category.total)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t font-semibold">
                <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                  Total Beban Operasional
                </TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(report.expenses?.totalExpenses || 0)}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* Laba Operasional */}
              <TableRow className="border-t-2 bg-blue-50 font-semibold">
                <TableCell className="py-1.5 lg:py-2">LABA OPERASIONAL</TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(
                    report.income.totalSales -
                      totalCOGS -
                      (report.expenses?.totalExpenses || 0)
                  )}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* Other Income/Expense */}
              <TableRow className="bg-purple-50">
                <TableCell className="font-bold py-1.5 lg:py-2">
                  PENDAPATAN/BEBAN LAIN
                </TableCell>
                <TableCell className="py-1.5 lg:py-2"></TableCell>
              </TableRow>
              {/* Tampilkan semua pendapatan REVENUE (selain penjualan produk) */}
              {report.otherIncomeExpense?.revenueByCategory?.map((revenue: any) => (
                <TableRow key={revenue.category}>
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    {revenue.category}
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(revenue.total)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Tampilkan beban penyesuaian harga */}
              {report.otherIncomeExpense?.adjustmentExpense > 0 && (
                <TableRow>
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    Beban Penyesuaian Harga
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600 py-1.5 lg:py-2">
                    ({formatCurrency(report.otherIncomeExpense.adjustmentExpense)})
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t font-semibold">
                <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                  Total Pendapatan/Beban Lain
                </TableCell>
                <TableCell className="text-right font-mono py-1.5 lg:py-2">
                  {formatCurrency(report.otherIncomeExpense?.total || 0)}
                </TableCell>
              </TableRow>

              {/* Spacer */}
              <TableRow>
                <TableCell colSpan={2} className="h-2 lg:h-4"></TableCell>
              </TableRow>

              {/* Net Profit */}
              <TableRow className="border-t-2 bg-gray-100 font-bold">
                <TableCell className="py-1.5 lg:py-2">LABA BERSIH</TableCell>
                <TableCell className="text-right font-mono text-sm lg:text-lg py-1.5 lg:py-2">
                  {formatCurrency(
                    report.income.totalSales -
                      totalCOGS -
                      (report.expenses?.totalExpenses || 0) +
                      (report.otherIncomeExpense?.total || 0)
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
