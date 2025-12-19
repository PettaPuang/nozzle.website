"use client";

import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

type FinanceCardProps = {
  gasStationId: string;
  inputDepositCount: number; // Shifts tanpa deposit (untuk input deposit)
  pendingApprovalCount: number; // Deposit dengan status PENDING (untuk approval manager)
  shiftVerificationCount?: number; // Shifts yang perlu diverifikasi
  pendingCashTransactionCount?: number; // CASH transactions dengan status PENDING
  selected?: boolean;
  onClick?: () => void;
};

export function FinanceCard({
  gasStationId,
  inputDepositCount,
  pendingApprovalCount,
  shiftVerificationCount = 0,
  pendingCashTransactionCount = 0,
  selected = false,
  onClick,
}: FinanceCardProps) {
  const totalCount =
    inputDepositCount + shiftVerificationCount + pendingCashTransactionCount;

  return (
    <div
      className={cn(
        "border rounded-lg bg-card hover:shadow-lg transition-all cursor-pointer",
        selected && "bg-blue-50 border-2 border-blue-500"
      )}
      onClick={onClick}
    >
      <div className="p-2 lg:p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="p-1.5 bg-gray-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-gray-700" />
            </div>
            <div className="text-sm lg:text-base font-semibold">Finance</div>
          </div>
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] lg:text-xs px-1.5 py-0.5"
            >
              {totalCount}
            </Badge>
          )}
        </div>
      </div>
      <div className="px-2 lg:px-3 pb-2 lg:pb-3">
        <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Verifikasi
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {shiftVerificationCount}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Deposits
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {inputDepositCount}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Transaction
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {pendingCashTransactionCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
