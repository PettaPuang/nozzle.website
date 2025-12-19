"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
} from "lucide-react";
import { useSidebar } from "@/components/gas-stations/office/sidebar-context";
import { FinanceDepositTab } from "./finance-deposit-tab";
import { ManagementDanaTab } from "./finance-transaction-tab";
import { ShiftOperatorTab } from "./shift-operator-tab";

type FinanceDetailPanelProps = {
  gasStationId: string;
  ownerId: string;
  inputDepositCount: number; // Shifts verified tanpa deposit (untuk input deposit)
  shiftVerificationCount: number; // Shifts yang perlu diverifikasi
  pendingCashTransactionCount: number; // CASH transactions dengan status PENDING
  userRole?: string;
};

export function FinanceDetailPanel({
  gasStationId,
  ownerId,
  inputDepositCount,
  shiftVerificationCount,
  pendingCashTransactionCount,
  userRole,
}: FinanceDetailPanelProps) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  
  // Determine default tab based on notifications (priority order)
  const defaultTab = useMemo(() => {
    // Priority 1: Shift verification (most critical)
    if (shiftVerificationCount > 0) return "shift-operator";
    // Priority 2: Deposit input
    if (inputDepositCount > 0) return "deposits";
    // Priority 3: Cash transactions
    if (pendingCashTransactionCount > 0) return "transfers";
    // Default: deposits tab
    return "deposits";
  }, [shiftVerificationCount, inputDepositCount, pendingCashTransactionCount]);
  
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 lg:px-6 py-2 lg:py-4 border-b flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-7 w-7 lg:h-8 lg:w-8 shrink-0"
        >
          {sidebarOpen ? (
            <AlignHorizontalJustifyStart className="h-6 w-6 lg:h-10 lg:w-10" />
          ) : (
            <AlignHorizontalJustifyCenter className="h-6 w-6 lg:h-10 lg:w-10" />
          )}
        </Button>
        <div className="flex-1 flex items-center justify-end gap-2 pr-2 md:pr-4">
          <h2 className="text-base lg:text-xl font-semibold">
            Finance Dashboard
          </h2>
        </div>
      </div>

      <div className="flex-1">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <div className="px-2 lg:px-6 pt-2 lg:pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger
                value="shift-operator"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Shift Operator
                {shiftVerificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {shiftVerificationCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="deposits"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Deposits
                {inputDepositCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {inputDepositCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="transfers"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Transaction
                {pendingCashTransactionCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {pendingCashTransactionCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 px-2 lg:px-6 pb-2 lg:pb-6">
            <TabsContent value="shift-operator" className="mt-1.5 lg:mt-4">
              <ShiftOperatorTab
                gasStationId={gasStationId}
                active={activeTab === "shift-operator"}
              />
            </TabsContent>
            <TabsContent value="deposits" className="mt-1.5 lg:mt-4">
              <FinanceDepositTab
                gasStationId={gasStationId}
                active={activeTab === "deposits"}
                userRole={userRole}
              />
            </TabsContent>

            <TabsContent value="transfers" className="mt-1.5 lg:mt-4">
              <ManagementDanaTab
                gasStationId={gasStationId}
                active={activeTab === "transfers"}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
