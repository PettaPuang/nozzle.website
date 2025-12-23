"use client";

import { IncomeExpenseReport } from "./income-expense-report";
import { ProfitLossTable } from "./profit-loss-table";
import { BalanceSheetTable } from "./balance-sheet-table";

type FinancialReportTabProps = {
  gasStationId: string;
  gasStationName?: string;
};

export function FinancialReportTab({
  gasStationId,
  gasStationName = "SPBU",
}: FinancialReportTabProps) {
  return (
    <div className="p-2 lg:p-6 space-y-3 lg:space-y-6">
      {/* Income & Expense Report */}
      <IncomeExpenseReport
        gasStationId={gasStationId}
        gasStationName={gasStationName}
      />

      {/* Profit Loss Report */}
      <ProfitLossTable gasStationId={gasStationId} />

      {/* Balance Sheet */}
      <BalanceSheetTable gasStationId={gasStationId} />
    </div>
  );
}
