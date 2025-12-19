"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Receipt,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
} from "lucide-react";
import { useSidebar } from "@/components/gas-stations/office/sidebar-context";
import { COAListTab } from "@/components/gas-stations/office/accounting/coa-list-tab";
import { AdminTransactionTab } from "@/components/gas-stations/office/accounting/admin-transaction-tab";

type AccountingDetailPanelProps = {
  gasStationId: string;
  userRole?: string;
};

export function AccountingDetailPanel({
  gasStationId,
  userRole,
}: AccountingDetailPanelProps) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();

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
        <div className="text-right pr-2 md:pr-4">
          <h2 className="text-base lg:text-xl font-semibold">
            Accounting Dashboard
          </h2>
        </div>
      </div>

      <div className="flex-1">
        <Tabs defaultValue="coa" className="h-full flex flex-col">
          <div className="px-2 lg:px-6 pt-2 lg:pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="coa"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                <FileText className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                <span className={sidebarOpen ? "hidden lg:inline" : "inline"}>
                  Chart of Accounts
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="transaction"
                className="gap-1 lg:gap-2 text-xs lg:text-sm"
              >
                <Receipt className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                <span className={sidebarOpen ? "hidden lg:inline" : "inline"}>
                  Transaction
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1">
            <TabsContent value="coa" className="mt-0 px-2 lg:px-6 pb-2 lg:pb-6">
              <COAListTab gasStationId={gasStationId} />
            </TabsContent>

            <TabsContent
              value="transaction"
              className="mt-0 px-2 lg:px-6 pb-2 lg:pb-6"
            >
              <AdminTransactionTab gasStationId={gasStationId} userRole={userRole} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
