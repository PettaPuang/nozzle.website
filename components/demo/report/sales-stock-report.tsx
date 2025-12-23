"use client";

import { useState } from "react";
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
};

export function SalesStockReport({
  gasStationId,
  gasStationName = "SPBU",
}: SalesStockReportProps) {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);

  const handleExportDisabled = () => {
    toast.info("Fitur export tidak tersedia di demo experience");
  };

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3 space-y-3 lg:space-y-6">
      {/* Header dengan export buttons (disabled) */}
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4">
          <div className="flex-1">
            <div className="text-base lg:text-lg font-semibold">
              Laporan Penjualan dan Stock
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
      />

      {/* Stock Report Table */}
      <StockReportTable
        gasStationId={gasStationId}
        onReportChange={setStockReport}
      />
    </div>
  );
}
