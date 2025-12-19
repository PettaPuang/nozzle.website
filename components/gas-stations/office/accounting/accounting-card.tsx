"use client";

import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountingCardProps = {
  selected?: boolean;
  onClick?: () => void;
};

export function AccountingCard({
  selected = false,
  onClick,
}: AccountingCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg bg-card hover:shadow-lg transition-all cursor-pointer",
        selected && "bg-blue-50 border-2 border-blue-500"
      )}
      onClick={onClick}
    >
      <div className="p-2 lg:p-3">
        <div className="flex items-center gap-1.5 lg:gap-2">
          <div className="p-1.5 bg-gray-100 rounded-lg flex items-center justify-center">
            <Calculator className="h-4 w-4 text-gray-700" />
          </div>
          <div className="text-sm lg:text-base font-semibold">Accounting</div>
        </div>
      </div>
    </div>
  );
}

