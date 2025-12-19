"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { FinancialReportTable } from "./income-table";
import { ExpenseReportTable } from "./expense-table";
import { endOfDayUTC, startOfDayUTC } from "@/lib/utils/datetime";

type FinancialReportData = {
  income: {
    byProduct: any[];
    totalSales: number;
    totalCost: number;
    totalGrossProfit: number;
    totalVariance: number;
  };
  expenses: {
    byCategory: Array<{
      category: string;
      total: number;
      items: any[];
    }>;
    totalExpenses: number;
  };
  netIncome: number;
  financialData?: any; // Full financial data untuk stockValues
};

type IncomeExpenseReportProps = {
  gasStationId: string;
  gasStationName?: string;
  dateRange: DateRange;
};

export function IncomeExpenseReport({
  gasStationId,
  gasStationName = "SPBU",
  dateRange,
}: IncomeExpenseReportProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.roleCode || "";
  const userName = session?.user?.username;

  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExportDisabled = () => {
    toast.info("Fitur export tidak tersedia di demo experience");
  };

  // Fetch financial data when date range changes
  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!dateRange.from || !dateRange.to) return;

      setIsLoading(true);
      try {
        // Normalize date range untuk memastikan konsistensi UTC
        const normalizedFrom = startOfDayUTC(dateRange.from);
        const normalizedTo = endOfDayUTC(dateRange.to);

        // Fetch kedua API secara parallel untuk mempercepat loading
        const [incomeResponse, financialResponse] = await Promise.all([
          fetch(
            `/api/reports/income?gasStationId=${gasStationId}&startDate=${normalizedFrom.toISOString()}&endDate=${normalizedTo.toISOString()}`
          ),
          fetch(
            `/api/reports/financial?gasStationId=${gasStationId}&startDate=${normalizedFrom.toISOString()}&endDate=${normalizedTo.toISOString()}`
          ),
        ]);

        const [incomeResult, financialResult] = await Promise.all([
          incomeResponse.json(),
          financialResponse.json(),
        ]);

        if (incomeResult.success && financialResult.success) {
          // Merge income dan expense data
          setReport({
            income: incomeResult.data,
            expenses: financialResult.data.expenses,
            netIncome: financialResult.data.netIncome || 0,
            financialData: financialResult.data, // Simpan full financial data untuk stockValues
          });
        } else {
          toast.error(
            incomeResult.message ||
              financialResult.message ||
              "Gagal memuat data keuangan"
          );
          setReport(null);
        }
      } catch (error) {
        console.error("Error fetching financial data:", error);
        toast.error("Gagal memuat data keuangan");
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinancialData();
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

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3 space-y-3 lg:space-y-6">
      {/* Header dengan export buttons (disabled) */}
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4">
          <div className="flex-1">
            <div className="text-base lg:text-lg font-semibold">
              Rincian Pemasukan dan Pengeluaran
              {getDateRangeLabel() ? ` - ${getDateRangeLabel()}` : ""}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Detail pemasukan per produk dan pengeluaran per kategori
            </div>
          </div>
          <div className="flex gap-1.5 lg:gap-2 shrink-0 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs lg:text-sm h-8 lg:h-9"
                  onClick={handleExportDisabled}
                >
                  <Download className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  Export PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDisabled}>
                  Bulan Ini
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs lg:text-sm h-8 lg:h-9"
                  onClick={handleExportDisabled}
                >
                  <Download className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  Export Excel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDisabled}>
                  Bulan Ini
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Rincian Pemasukan */}
      <FinancialReportTable
        isLoading={isLoading}
        incomeData={report?.income || null}
        financialData={report?.financialData || null}
        dateRange={dateRange}
      />

      {/* Rincian Pengeluaran */}
      <ExpenseReportTable
        report={report?.expenses || null}
        isLoading={isLoading}
      />
    </div>
  );
}
