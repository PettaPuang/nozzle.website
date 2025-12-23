"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fuel, Building2, FileText } from "lucide-react";
import { TanksTabContent } from "@/components/demo/tank/tanks-tab-content";
import { StationsTabContent } from "@/components/demo/station/stations-tab-content";
import { ReportTabContent } from "@/components/demo/report/report-tab-content";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type {
  GasStationDetailForClient,
  OperationalDataForClient,
  TankWithStock,
  ProductForClient,
  UnloadWithRelations,
  ActiveRole,
  OperatorWithShifts,
} from "@/lib/types/demo";

type GasStationClientProps = {
  gasStationDetail: GasStationDetailForClient;
  operationalData: OperationalDataForClient;
  userRole: RoleCode;
  userId: string;
  products: ProductForClient[];
  unloads?: UnloadWithRelations[];
  pendingUnloadCount?: number;
  pendingDepositsCountForFinance?: number;
  pendingDepositsCountForManager?: number;
  shiftVerificationCount?: number;
  pendingCashTransactionCount?: number;
  pendingTransactionsCount?: number;
  pendingTankReadingsCount?: number;
  tanksWithStock: TankWithStock[];
  roles: ActiveRole[];
  operators: OperatorWithShifts[];
};

export function GasStationClient({
  gasStationDetail,
  operationalData,
  userRole,
  userId,
  products,
  unloads = [],
  pendingUnloadCount = 0,
  pendingDepositsCountForFinance = 0,
  pendingDepositsCountForManager = 0,
  shiftVerificationCount = 0,
  pendingCashTransactionCount = 0,
  pendingTransactionsCount = 0,
  pendingTankReadingsCount = 0,
  tanksWithStock,
  roles,
  operators,
}: GasStationClientProps) {
  const {
    gasStation,
    stations: detailStations,
    staff,
    administrators,
    ownerGroups,
  } = gasStationDetail;
  const { stations: operationalStations } = operationalData;

  // Demo mode: read-only, no operational actions

  // Demo mode: default tab adalah report untuk OWNER
  const defaultTab = useMemo(() => {
    return "report";
  }, []);

  // Demo mode: hanya tanks, stations, dan report yang bisa diakses
  const canAccessTanks = true; // OWNER bisa akses tanks
  const canAccessStations = true; // OWNER bisa akses stations
  const canAccessReport = true; // OWNER bisa akses report

  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  
  // Use tab from URL if valid, otherwise use defaultTab
  const initialTab = useMemo(() => {
    if (tabFromUrl && ["tanks", "stations", "management", "report"].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return defaultTab;
  }, [tabFromUrl, defaultTab]);
  
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ["tanks", "stations", "management", "report"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Demo mode: tidak ada pending tasks
  const accessibleTabsCount = 3; // tanks, stations, report

  // Sembunyikan tab filter jika hanya ada 1 tab (misalnya untuk operator)
  const showTabFilter = accessibleTabsCount > 1;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex-1 flex flex-col overflow-hidden"
      suppressHydrationWarning
    >
      {/* Center: Tab Filter - hanya tampil jika ada lebih dari 1 tab */}
      {showTabFilter && (
        <div className="flex justify-center mt-1.5 lg:mt-4 px-2 lg:px-0">
          <TabsList className="w-full lg:w-fit lg:min-w-[600px] h-7 lg:h-9 p-0.5 lg:p-[3px]">
          {/* Tanks Tab - unloader, owner, ownergroup, admin, developer */}
          {canAccessTanks && (
            <TabsTrigger
              value="tanks"
              className="gap-1 lg:gap-2 text-xs lg:text-sm px-1.5 lg:px-2 py-0.5 lg:py-1"
            >
              <Fuel className="h-3 w-3 lg:h-4 lg:w-4" />
              Tanks
            </TabsTrigger>
          )}
          {/* Stations Tab */}
          {canAccessStations && (
            <TabsTrigger
              value="stations"
              className="gap-1 lg:gap-2 text-xs lg:text-sm px-1.5 lg:px-2 py-0.5 lg:py-1"
            >
              <Building2 className="h-3 w-3 lg:h-4 lg:w-4" />
              Stations
            </TabsTrigger>
          )}
          {/* Report Tab */}
          {canAccessReport && (
            <TabsTrigger
              value="report"
              className="gap-1 lg:gap-2 text-xs lg:text-sm px-1.5 lg:px-2 py-0.5 lg:py-1"
            >
              <FileText className="h-3 w-3 lg:h-4 lg:w-4" />
              Report
            </TabsTrigger>
          )}
          </TabsList>
        </div>
      )}

      {/* Tanks Tab - unloader, owner, ownergroup, admin, developer */}
      {canAccessTanks && (
        <TabsContent
          value="tanks"
          className="flex-1 overflow-y-auto px-2 lg:px-6 pb-2 lg:pb-6 mt-2 lg:mt-4"
        >
          <TanksTabContent
            gasStationId={gasStation.id}
            gasStationOpenTime={gasStation.openTime}
            gasStationCloseTime={gasStation.closeTime}
            tanksWithStock={tanksWithStock}
          />
        </TabsContent>
      )}

      {/* Stations Tab */}
      {canAccessStations && (
        <TabsContent
          value="stations"
          className="flex-1 overflow-y-auto px-2 lg:px-6 pb-2 lg:pb-6 mt-2 lg:mt-4"
        >
          <StationsTabContent
            stations={operationalStations}
            gasStationId={gasStation.id}
            gasStationOpenTime={operationalData.gasStation.openTime}
            gasStationCloseTime={operationalData.gasStation.closeTime}
            userRole={userRole}
          />
        </TabsContent>
      )}

      {/* Report Tab */}
      {canAccessReport && (
        <TabsContent value="report" className="flex-1 overflow-y-auto">
          <ReportTabContent
            gasStationId={gasStation.id}
            gasStationName={gasStation.name}
            userRole={userRole}
            gasStation={{
              financeCanPurchase: gasStation.financeCanPurchase,
              managerCanPurchase: gasStation.managerCanPurchase,
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

