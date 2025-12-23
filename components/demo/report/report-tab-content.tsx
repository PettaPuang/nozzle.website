"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalReportTab } from "./operational-report-tab";
import { FinancialReportTab } from "./financial-report-tab";
import type { RoleCode } from "@/lib/utils/permissions";

type ReportTabContentProps = {
  gasStationId: string;
  gasStationName?: string;
  userRole?: RoleCode;
  gasStation?: {
    financeCanPurchase?: boolean;
    managerCanPurchase?: boolean;
  };
};

export function ReportTabContent({
  gasStationId,
  gasStationName = "SPBU",
  userRole,
  gasStation,
}: ReportTabContentProps) {
  const isManager = userRole === "MANAGER";
  const isFinance = userRole === "FINANCE";

  // Check if manager/finance has accounting access
  const canAccessAccounting =
    (isFinance && gasStation?.financeCanPurchase === true) ||
    (isManager && gasStation?.managerCanPurchase === true);

  const [activeTab, setActiveTab] = useState<"operational" | "financial">(
    "operational"
  );

  // Demo mode: static reports, no date range filter

  // FINANCE: langsung tampilkan Financial Report saja (tidak ada tab switcher)
  if (isFinance && canAccessAccounting) {
    return (
      <div className="flex-1 overflow-y-auto">
        <FinancialReportTab
          gasStationId={gasStationId}
          gasStationName={gasStationName}
        />
      </div>
    );
  }

  // MANAGER tanpa akses accounting: langsung tampilkan Operational Report saja
  if (isManager && !canAccessAccounting) {
    return (
      <div className="flex-1 overflow-y-auto">
        <OperationalReportTab
          gasStationId={gasStationId}
          gasStationName={gasStationName}
        />
      </div>
    );
  }

  // Untuk role lain, tampilkan dengan tab switcher
  return (
    <div className="flex-1 overflow-y-auto">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="h-full"
      >
        {/* Sticky header dengan tab */}
        <div className="sticky top-0">
          <div className="flex items-center justify-between gap-2 lg:gap-4 px-2 lg:px-4 md:px-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
            <TabsList className="grid grid-cols-2 shrink-0">
              <TabsTrigger
                value="operational"
                className="text-xs lg:text-sm whitespace-nowrap"
              >
                Operational Report
              </TabsTrigger>
              <TabsTrigger
                value="financial"
                className="text-xs lg:text-sm whitespace-nowrap"
              >
                Financial Report
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="operational" className="mt-0">
          <OperationalReportTab
            gasStationId={gasStationId}
            gasStationName={gasStationName}
          />
        </TabsContent>

        <TabsContent value="financial" className="mt-0">
          <FinancialReportTab
            gasStationId={gasStationId}
            gasStationName={gasStationName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
