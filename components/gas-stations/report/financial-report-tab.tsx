"use client";

import type { DateRange } from "react-day-picker";
import { IncomeExpenseReport } from "./income-expense-report";
import { ProfitLossTable } from "./profit-loss-table";
import { BalanceSheetTable } from "./balance-sheet-table";

type FinancialReportTabProps = {
  gasStationId: string;
  gasStationName?: string;
  dateRange: DateRange;
};

export function FinancialReportTab({
  gasStationId,
  gasStationName = "SPBU",
  dateRange,
}: FinancialReportTabProps) {
  return (
    <div className="p-2 lg:p-6 space-y-3 lg:space-y-6">
      {/* Income & Expense Report */}
      <IncomeExpenseReport
        gasStationId={gasStationId}
        gasStationName={gasStationName}
        dateRange={dateRange}
      />

      {/* Profit Loss Report */}
      <ProfitLossTable gasStationId={gasStationId} dateRange={dateRange} />

      {/* Balance Sheet */}
      <BalanceSheetTable gasStationId={gasStationId} />
    </div>
  );
}
