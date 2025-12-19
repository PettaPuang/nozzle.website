"use client";

import { useState } from "react";
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
import { ComprehensiveSalesTable } from "./sales-table";
import { StockReportTable } from "./stock-table";

type SalesStockReportProps = {
  gasStationId: string;
  gasStationName?: string;
  dateRange: DateRange;
};

export function SalesStockReport({
  gasStationId,
  gasStationName = "SPBU",
  dateRange,
}: SalesStockReportProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.roleCode || "";
  const userName = session?.user?.username;

  const [salesReport, setSalesReport] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);

  const handleExportDisabled = () => {
    toast.info("Fitur export tidak tersedia di demo experience");
  };

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
              Laporan Penjualan dan Stock
              {getDateRangeLabel() ? ` - ${getDateRangeLabel()}` : ""}
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Detail penjualan per produk dan laporan stock per tangki
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

      {/* Sales Table */}
      <ComprehensiveSalesTable
        gasStationId={gasStationId}
        onReportChange={setSalesReport}
        dateRange={dateRange}
      />

      {/* Stock Report Table */}
      <StockReportTable
        gasStationId={gasStationId}
        onReportChange={setStockReport}
        dateRange={dateRange}
      />
    </div>
  );
}
