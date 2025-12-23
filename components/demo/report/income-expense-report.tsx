"use client";

import { useState, useEffect } from "react";
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
import { MockDataService } from "@/lib/utils/mock-data";

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
};

export function IncomeExpenseReport({
  gasStationId,
  gasStationName = "SPBU",
}: IncomeExpenseReportProps) {
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [isLoading] = useState(false);

  const handleExportDisabled = () => {
    toast.info("Fitur export tidak tersedia di demo experience");
  };

  // Demo mode: use mock data
  useEffect(() => {
    const financialReport = MockDataService.getFinancialReport(gasStationId);
    const incomeReport = MockDataService.getIncomeReport(gasStationId);
    
    if (financialReport && incomeReport) {
      setReport({
        income: {
          byProduct: incomeReport.byProduct.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            revenue: p.revenue,
            volume: p.volume,
            averagePrice: p.averagePrice,
          })),
          totalSales: incomeReport.totalRevenue,
          totalCost: 0, // Mock data doesn't have cost breakdown
          totalGrossProfit: 0,
          totalVariance: 0,
        },
        expenses: {
          byCategory: financialReport.breakdown.expenses.map((e) => ({
            category: e.category,
            total: e.amount,
            items: [],
          })),
          totalExpenses: financialReport.expenses.totalExpenses,
        },
        netIncome: financialReport.profitLoss.netProfit,
        financialData: financialReport,
      });
    }
  }, [gasStationId]);

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3 space-y-3 lg:space-y-6">
      {/* Header dengan export buttons (disabled) */}
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4">
          <div className="flex-1">
            <div className="text-base lg:text-lg font-semibold">
              Rincian Pemasukan dan Pengeluaran
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
      />

      {/* Rincian Pengeluaran */}
      <ExpenseReportTable
        report={report?.expenses || null}
        isLoading={isLoading}
      />
    </div>
  );
}
