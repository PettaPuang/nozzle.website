"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/reusable/date-picker";
import { OperationalReportTab } from "./operational-report-tab";
import { FinancialReportTab } from "./financial-report-tab";
import type { RoleCode } from "@/lib/utils/permissions";
import {
  getTodayLocalAsUTC,
  startOfMonthUTC,
  endOfDayUTC,
  startOfDayUTC,
} from "@/lib/utils/datetime";

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

  // Default: bulan ini (tanggal 1 sampai hari ini)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const todayLocal = new Date(); // Local time
    const monthStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
    const todayLocalUTC = getTodayLocalAsUTC();

    const result = {
      from: startOfDayUTC(
        new Date(
          Date.UTC(
            monthStart.getFullYear(),
            monthStart.getMonth(),
            monthStart.getDate(),
            0,
            0,
            0,
            0
          )
        )
      ),
      to: endOfDayUTC(todayLocalUTC),
    } as DateRange;

    return result;
  });

  // FINANCE: langsung tampilkan Financial Report saja (tidak ada tab switcher)
  if (isFinance && canAccessAccounting) {
    return (
      <div className="flex-1 overflow-y-auto">
        {/* Filter Date Range */}
        <div className="sticky top-0 bg-white z-10 border-b">
          <div className="flex items-center justify-end gap-2 px-2 lg:px-4 md:px-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
            <DatePicker
              date={dateRange}
              onSelect={(date) => {
                if (date?.from && date?.to) {
                  setDateRange(date);
                }
              }}
              size="sm"
            />
          </div>
        </div>
        <FinancialReportTab
          gasStationId={gasStationId}
          gasStationName={gasStationName}
          dateRange={dateRange}
        />
      </div>
    );
  }

  // MANAGER tanpa akses accounting: langsung tampilkan Operational Report saja
  if (isManager && !canAccessAccounting) {
    return (
      <div className="flex-1 overflow-y-auto">
        {/* Filter Date Range */}
        <div className="sticky top-0 bg-white z-10 border-b">
          <div className="flex items-center justify-end gap-2 px-2 lg:px-4 md:px-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
            <DatePicker
              date={dateRange}
              onSelect={(date) => {
                if (date?.from && date?.to) {
                  setDateRange(date);
                }
              }}
              size="sm"
            />
          </div>
        </div>
        <OperationalReportTab
          gasStationId={gasStationId}
          gasStationName={gasStationName}
          dateRange={dateRange}
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
        {/* Sticky header dengan tab dan filter */}
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
            <DatePicker
              date={dateRange}
              onSelect={(date) => {
                if (date?.from && date?.to) {
                  setDateRange(date);
                }
              }}
              size="sm"
            />
          </div>
        </div>

        <TabsContent value="operational" className="mt-0">
          <OperationalReportTab
            gasStationId={gasStationId}
            gasStationName={gasStationName}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="financial" className="mt-0">
          <FinancialReportTab
            gasStationId={gasStationId}
            gasStationName={gasStationName}
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
