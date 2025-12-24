"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/format-client";
import { nowUTC, endOfDayUTC } from "@/lib/utils/datetime";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCOAsWithBalance } from "@/lib/actions/coa.actions";

/**
 * Format UTC date to local date string for display
 * Uses UTC methods to ensure date doesn't shift due to timezone
 */
function formatUTCDate(date: Date, formatStr: string): string {
  // Use UTC methods to get date components
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  // Create a new Date object in local timezone with UTC values
  // This ensures format() displays the correct date without timezone shift
  const localDate = new Date(year, month, day);

  return format(localDate, formatStr, { locale: localeId });
}

type BalanceSheetItem = {
  name: string;
  balance: number;
};

type BalanceSheetTableProps = {
  gasStationId: string;
};

export function BalanceSheetTable({ gasStationId }: BalanceSheetTableProps) {
  const [balanceSheet, setBalanceSheet] = useState<{
    assets: BalanceSheetItem[];
    liabilities: BalanceSheetItem[];
    equity: BalanceSheetItem[];
    netIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesEquity: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Balance sheet mengambil langsung dari COA balance (semua data tanpa filter tanggal)
  useEffect(() => {
    const fetchBalanceSheetData = async () => {
      setIsLoading(true);
      try {
        const result = await getCOAsWithBalance(gasStationId);
        if (!result.success) {
          // Handle permission error atau error lainnya
          console.error("Error fetching balance sheet:", result.message);
          setBalanceSheet(null);
          return;
        }
        if (result.success && result.data) {
          const coas = result.data;

          // Group COAs by category
          const assets: BalanceSheetItem[] = [];
          const liabilities: BalanceSheetItem[] = [];
          const equity: BalanceSheetItem[] = [];
          let netIncome = 0;

          // Cari COA "Realtime Profit/Loss" terlebih dahulu
          // Gunakan case-insensitive search untuk memastikan menemukan COA
          const realtimeProfitLossCOA = coas.find(
            (coa) =>
              coa.name.toLowerCase() === "realtime profit/loss".toLowerCase()
          );

          if (realtimeProfitLossCOA) {
            // Balance untuk EQUITY = totalCredit - totalDebit
            // Karena EQUITY adalah kategori credit normal
            netIncome = realtimeProfitLossCOA.balance;
          } else {
            // Set netIncome ke 0 jika COA tidak ditemukan
            netIncome = 0;
          }

          coas.forEach((coa) => {
            // Skip "Realtime Profit/Loss" dari list karena akan digunakan sebagai net income
            if (coa.name.toLowerCase() === "realtime profit/loss") {
              return;
            }

            // Hanya masukkan COA yang relevan untuk balance sheet
            // Balance sheet hanya menampilkan ASSET, LIABILITY, dan EQUITY
            // REVENUE, EXPENSE, COGS tidak masuk balance sheet (masuk P&L)
            switch (coa.category) {
              case "ASSET":
                assets.push({ name: coa.name, balance: coa.balance });
                break;
              case "LIABILITY":
                liabilities.push({ name: coa.name, balance: coa.balance });
                break;
              case "EQUITY":
                equity.push({ name: coa.name, balance: coa.balance });
                break;
              // REVENUE, EXPENSE, COGS tidak masuk balance sheet
              case "REVENUE":
              case "EXPENSE":
              case "COGS":
                // Skip - ini masuk ke Profit & Loss, bukan balance sheet
                break;
              default:
                // Skip COA dengan kategori yang tidak dikenal
                break;
            }
          });

          // Sort by name
          assets.sort((a, b) => a.name.localeCompare(b.name));
          liabilities.sort((a, b) => a.name.localeCompare(b.name));
          equity.sort((a, b) => a.name.localeCompare(b.name));

          // Calculate totals
          const totalAssets = assets.reduce(
            (sum, item) => sum + item.balance,
            0
          );
          const totalLiabilities = liabilities.reduce(
            (sum, item) => sum + item.balance,
            0
          );
          const totalEquity =
            equity.reduce((sum, item) => sum + item.balance, 0) + netIncome;
          const totalLiabilitiesEquity = totalLiabilities + totalEquity;

          setBalanceSheet({
            assets,
            liabilities,
            equity,
            netIncome,
            totalAssets,
            totalLiabilities,
            totalEquity,
            totalLiabilitiesEquity,
          });
        } else {
          setBalanceSheet(null);
        }
      } catch (error) {
        console.error("Error fetching balance sheet data:", error);
        setBalanceSheet(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalanceSheetData();
  }, [gasStationId]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">Neraca</div>
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

  if (!balanceSheet) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">Neraca</div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data COA
          </div>
        </div>
      </div>
    );
  }

  const {
    assets,
    liabilities,
    equity,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesEquity,
  } = balanceSheet;

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3">
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4 mb-2">
          <div>
            <div className="text-base lg:text-lg font-semibold">
              Neraca per tanggal{" "}
              {formatUTCDate(endOfDayUTC(nowUTC()), "dd MMMM yyyy")}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Balance Sheet - Posisi Keuangan
            </div>
          </div>
        </div>
      </div>
      <div className="p-2 lg:p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-6">
          {/* ASSETS */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    colSpan={2}
                    className="bg-blue-50 font-bold py-1.5 lg:py-2"
                  >
                    ASET
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-blue-50/50">
                  <TableCell className="font-semibold py-1.5 lg:py-2">
                    Aset Lancar
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2"></TableCell>
                </TableRow>
                {assets.length > 0 ? (
                  assets.map((asset: BalanceSheetItem, idx: number) => (
                    <TableRow key={`asset-${idx}`}>
                      <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                        {asset.name}
                      </TableCell>
                      <TableCell className="text-right font-mono py-1.5 lg:py-2">
                        {formatCurrency(asset.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="pl-4 lg:pl-8 text-muted-foreground py-1.5 lg:py-2 text-center"
                    >
                      Tidak ada aset
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t font-semibold">
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    Total Aset Lancar
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(
                      assets.reduce(
                        (sum: number, item: BalanceSheetItem) =>
                          sum + item.balance,
                        0
                      )
                    )}
                  </TableCell>
                </TableRow>

                {/* Total Assets */}
                <TableRow className="border-t-2 bg-blue-100 font-bold">
                  <TableCell className="py-1.5 lg:py-2">TOTAL ASET</TableCell>
                  <TableCell className="text-right font-mono text-sm lg:text-lg py-1.5 lg:py-2">
                    {formatCurrency(totalAssets)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    colSpan={2}
                    className="bg-green-50 font-bold py-1.5 lg:py-2"
                  >
                    KEWAJIBAN & EKUITAS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Liabilities */}
                <TableRow className="bg-red-50/50">
                  <TableCell className="font-semibold py-1.5 lg:py-2">
                    Kewajiban Lancar
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2"></TableCell>
                </TableRow>
                {liabilities.length > 0 ? (
                  liabilities.map(
                    (liability: BalanceSheetItem, idx: number) => (
                      <TableRow key={`liability-${idx}`}>
                        <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                          {liability.name}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2">
                          {formatCurrency(liability.balance)}
                        </TableCell>
                      </TableRow>
                    )
                  )
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="pl-4 lg:pl-8 text-muted-foreground py-1.5 lg:py-2 text-center"
                    >
                      Tidak ada kewajiban
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t font-semibold">
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    Total Kewajiban
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(totalLiabilities)}
                  </TableCell>
                </TableRow>

                {/* Equity */}
                <TableRow className="bg-green-50/50">
                  <TableCell className="font-semibold py-1.5 lg:py-2">
                    Ekuitas
                  </TableCell>
                  <TableCell className="py-1.5 lg:py-2"></TableCell>
                </TableRow>
                {/* Realtime Profit/Loss sebagai net income */}
                <TableRow>
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    Realtime Profit/Loss
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(netIncome)}
                  </TableCell>
                </TableRow>
                {/* Equity lainnya (Modal Awal, Laba Ditahan, dll) */}
                {equity.length > 0 &&
                  equity.map((eq: BalanceSheetItem, idx: number) => (
                    <TableRow key={`equity-${idx}`}>
                      <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                        {eq.name}
                      </TableCell>
                      <TableCell className="text-right font-mono py-1.5 lg:py-2">
                        {formatCurrency(eq.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                <TableRow className="border-t font-semibold">
                  <TableCell className="pl-4 lg:pl-8 py-1.5 lg:py-2">
                    Total Ekuitas
                  </TableCell>
                  <TableCell className="text-right font-mono py-1.5 lg:py-2">
                    {formatCurrency(totalEquity)}
                  </TableCell>
                </TableRow>

                {/* Total Liabilities & Equity */}
                <TableRow className="border-t-2 bg-green-100 font-bold">
                  <TableCell className="py-1.5 lg:py-2">
                    TOTAL KEWAJIBAN & EKUITAS
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm lg:text-lg py-1.5 lg:py-2">
                    {formatCurrency(totalLiabilitiesEquity)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Balance Check */}
        {totalAssets !== totalLiabilitiesEquity && (
          <div className="mt-2 lg:mt-4 p-2 lg:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs lg:text-sm text-yellow-800 font-medium">
              ⚠️ Peringatan: Total Aset tidak seimbang dengan Total Kewajiban &
              Ekuitas
            </p>
            <p className="text-[10px] lg:text-xs text-yellow-600 mt-1">
              Perbedaan:{" "}
              {formatCurrency(Math.abs(totalAssets - totalLiabilitiesEquity))}
            </p>
          </div>
        )}

        {totalAssets === totalLiabilitiesEquity && (
          <div className="mt-2 lg:mt-4 p-2 lg:p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs lg:text-sm text-green-800 font-medium">
              ✓ Neraca seimbang
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
