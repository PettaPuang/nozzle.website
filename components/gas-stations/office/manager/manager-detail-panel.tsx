"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
} from "lucide-react";
import { useSidebar } from "@/components/gas-stations/office/sidebar-context";
import { UnloadApprovalTab } from "./manager-unload-tab";
import { TransactionApprovalTab } from "./manager-transaction-tab";
import { ManagerDepositTab } from "./manager-deposit-tab";
import { TankReadingApprovalTab } from "./manager-tankreading-tab";

type ManagerDetailPanelProps = {
  gasStationId: string;
  ownerId: string;
  pendingUnloadCount: number;
  pendingTransactionsCount: number;
  pendingDepositsCount: number;
  pendingTankReadingsCount: number;
  userRole?: string;
};

export function ManagerDetailPanel({
  gasStationId,
  ownerId,
  pendingUnloadCount,
  pendingTransactionsCount,
  pendingDepositsCount,
  pendingTankReadingsCount,
  userRole,
}: ManagerDetailPanelProps) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // Determine default tab based on notifications
  const getDefaultTab = () => {
    if (pendingTankReadingsCount > 0) return "tankreading";
    if (pendingUnloadCount > 0) return "unload";
    if (pendingDepositsCount > 0) return "deposit";
    if (pendingTransactionsCount > 0) return "transaction";
    return "tankreading"; // Default to tank reading if no notifications
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

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
            Manager Dashboard
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger
                value="tankreading"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Tank Reading
                {pendingTankReadingsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {pendingTankReadingsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="unload"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Unload
                {pendingUnloadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {pendingUnloadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="deposit"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Deposit
                {pendingDepositsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {pendingDepositsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="transaction"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                Cash Transaction
                {pendingTransactionsCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                  >
                    {pendingTransactionsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 px-2 lg:px-6 pb-2 lg:pb-6">
            <TabsContent value="tankreading" className="mt-1.5 lg:mt-4">
              <TankReadingApprovalTab
                gasStationId={gasStationId}
                active={activeTab === "tankreading"}
                userRole={userRole}
              />
            </TabsContent>

            <TabsContent value="unload" className="mt-1.5 lg:mt-4">
              <UnloadApprovalTab
                gasStationId={gasStationId}
                active={activeTab === "unload"}
                userRole={userRole}
              />
            </TabsContent>

            <TabsContent value="deposit" className="mt-1.5 lg:mt-4">
              <ManagerDepositTab
                gasStationId={gasStationId}
                active={activeTab === "deposit"}
                userRole={userRole}
              />
            </TabsContent>

            <TabsContent value="transaction" className="mt-1.5 lg:mt-4">
              <TransactionApprovalTab
                gasStationId={gasStationId}
                active={activeTab === "transaction"}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
