"use client";

import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnloadWithRelations } from "@/lib/services/unload.service";

type ManagerCardProps = {
  unloads: UnloadWithRelations[];
  pendingUnloadCount: number;
  gasStationId: string;
  pendingTransactionsCount?: number;
  pendingDepositsCount?: number;
  selected?: boolean;
  onClick?: () => void;
};

export function ManagerCard({
  unloads,
  pendingUnloadCount,
  gasStationId,
  pendingTransactionsCount = 0,
  pendingDepositsCount = 0,
  selected = false,
  onClick,
}: ManagerCardProps) {
  const totalPending =
    pendingUnloadCount + pendingTransactionsCount + pendingDepositsCount;

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
              <ClipboardCheck className="h-4 w-4 text-gray-700" />
            </div>
            <div className="text-sm lg:text-base font-semibold">Manager</div>
          </div>
          {totalPending > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] lg:text-xs px-1.5 py-0.5"
            >
              {totalPending}
            </Badge>
          )}
        </div>
      </div>
      <div className="px-2 lg:px-3 pb-2 lg:pb-3">
        <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Unload
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {pendingUnloadCount}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Deposit
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {pendingDepositsCount}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 border">
            <p className="text-[10px] lg:text-xs text-gray-600 mb-0.5">
              Transaksi
            </p>
            <p className="text-base lg:text-lg font-semibold text-gray-900">
              {pendingTransactionsCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
