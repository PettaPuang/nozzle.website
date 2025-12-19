"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Fuel, Building2, Settings, FileText } from "lucide-react";
import { TanksTabContent } from "@/components/gas-stations/tank/tanks-tab-content";
import { StationsTabContent } from "@/components/gas-stations/station/stations-tab-content";
import { ManagementTabContent } from "@/components/gas-stations/office/management-tab-content";
import { ReportTabContent } from "@/components/gas-stations/report/report-tab-content";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type { GasStationDetailForClient } from "@/lib/services/gas-station.service";
import type {
  OperationalDataForClient,
  TankWithStock,
} from "@/lib/services/operational.service";
import type { ProductForClient } from "@/lib/services/product.service";
import type { UnloadWithRelations } from "@/lib/services/unload.service";
import type { ActiveRole } from "@/lib/services/role.service";
import type { OperatorWithShifts } from "@/lib/services/operator.service";

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

  // Permission checks for operational
  const canUnload = hasPermission(userRole, ["UNLOADER"]);
  const canOperate = hasPermission(userRole, ["OPERATOR"]);
  const isOwnerOrOwnerGroup = hasPermission(userRole, ["OWNER", "OWNER_GROUP"]);

  // Determine default tab based on role
  const defaultTab = useMemo(() => {
    if (hasPermission(userRole, ["OPERATOR"])) return "stations";
    if (hasPermission(userRole, ["UNLOADER"])) return "tanks";
    if (hasPermission(userRole, ["FINANCE"])) return "management";
    if (hasPermission(userRole, ["MANAGER"])) return "management"; // Manager default ke management karena ada pending tasks
    if (hasPermission(userRole, ["OWNER"])) return "report";
    return "stations";
  }, [userRole]);

  // Tab visibility restrictions menggunakan hasPermission
  // DEVELOPER & ADMINISTRATOR otomatis bypass di hasPermission
  // Tank = unloader, owner, ownergroup, manager (view only)
  const canAccessTanks = hasPermission(userRole, [
    "UNLOADER",
    "OWNER",
    "OWNER_GROUP",
    "MANAGER",
  ]);
  // Station = operator, owner, ownergroup, manager (view only)
  const canAccessStations = hasPermission(userRole, [
    "OPERATOR",
    "OWNER",
    "OWNER_GROUP",
    "MANAGER",
  ]);
  // Office = finance, manager
  const canAccessManagement = hasPermission(userRole, [
    "FINANCE",
    "MANAGER",
  ]);
  // Report access: MANAGER, OWNER selalu bisa akses
  // FINANCE dan MANAGER bisa akses jika memiliki akses accounting (financeCanPurchase/managerCanPurchase)
  // DEVELOPER dan ADMINISTRATOR selalu bisa akses (via hasPermission)
  const canAccessReport =
    hasPermission(userRole, ["MANAGER", "OWNER", "DEVELOPER", "ADMINISTRATOR"]) ||
    (userRole === "FINANCE" && gasStation.financeCanPurchase === true) ||
    (userRole === "MANAGER" && gasStation.managerCanPurchase === true);

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

  // Total pending tasks for Office tab
  // Use Finance count for Finance role, Manager count for Manager role
  const isFinanceRole = hasPermission(userRole, ["FINANCE"]);
  const isManagerRole = hasPermission(userRole, ["MANAGER"]);
  const isAdminRole = hasPermission(userRole, ["DEVELOPER", "ADMINISTRATOR"]);

  const pendingDepositsCountForOffice = isFinanceRole
    ? pendingDepositsCountForFinance
    : isManagerRole
    ? pendingDepositsCountForManager
    : isAdminRole
    ? pendingDepositsCountForFinance + pendingDepositsCountForManager
    : 0;

  const totalOfficePendingTasks =
    pendingUnloadCount +
    pendingDepositsCountForOffice +
    pendingTransactionsCount;

  // Hitung jumlah tab yang bisa diakses
  const accessibleTabsCount = [
    canAccessTanks,
    canAccessStations,
    canAccessManagement,
    canAccessReport,
  ].filter(Boolean).length;

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
          {/* Stations Tab - operator, owner, ownergroup, admin, developer */}
          {canAccessStations && (
            <TabsTrigger
              value="stations"
              className="gap-1 lg:gap-2 text-xs lg:text-sm px-1.5 lg:px-2 py-0.5 lg:py-1"
            >
              <Building2 className="h-3 w-3 lg:h-4 lg:w-4" />
              Stations
            </TabsTrigger>
          )}
          {/* Office Tab - finance, manager, admin, developer */}
          {canAccessManagement && (
            <TabsTrigger
              value="management"
              className="gap-1 lg:gap-2 text-xs lg:text-sm px-1.5 lg:px-2 py-0.5 lg:py-1"
            >
              <Settings className="h-3 w-3 lg:h-4 lg:w-4" />
              Office
              {totalOfficePendingTasks > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-0.5 lg:ml-1 text-[9px] lg:text-[10px]"
                >
                  {totalOfficePendingTasks}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {/* Report Tab - manager, owner, admin, developer */}
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
            userRole={userRole}
          />
        </TabsContent>
      )}

      {/* Stations Tab - operator, admin, developer */}
      {canAccessStations && (
        <TabsContent
          value="stations"
          className="flex-1 overflow-y-auto px-2 lg:px-6 pb-2 lg:pb-6 mt-2 lg:mt-4"
        >
          <StationsTabContent
            stations={operationalStations}
            canOperate={canOperate}
            gasStationId={gasStation.id}
            gasStationOpenTime={operationalData.gasStation.openTime}
            gasStationCloseTime={operationalData.gasStation.closeTime}
            userRole={userRole}
            userActiveShiftInOtherStation={
              operationalData.gasStation.userActiveShiftInOtherStation
            }
            userId={userId}
          />
        </TabsContent>
      )}

      {/* Office Tab - operator, finance, manager, admin, developer */}
      {canAccessManagement && (
        <TabsContent value="management" className="flex-1 overflow-y-auto">
          <ManagementTabContent
            gasStation={gasStation}
            detailStations={detailStations}
            operationalStations={operationalStations}
            staff={staff}
            administrators={administrators}
            ownerGroups={ownerGroups}
            products={products}
            unloads={unloads}
            pendingUnloadCount={pendingUnloadCount}
            operators={operators}
            roles={roles}
            pendingDepositsCountForFinance={pendingDepositsCountForFinance}
            pendingDepositsCountForManager={pendingDepositsCountForManager}
            shiftVerificationCount={shiftVerificationCount}
            pendingCashTransactionCount={pendingCashTransactionCount}
            pendingTransactionsCount={pendingTransactionsCount}
            pendingTankReadingsCount={pendingTankReadingsCount}
            isManager={hasPermission(userRole, ["MANAGER"])}
            isFinance={hasPermission(userRole, ["FINANCE"])}
            isAdmin={hasPermission(userRole, ["DEVELOPER", "ADMINISTRATOR"])}
            userId={userId}
            userRole={userRole}
          />
        </TabsContent>
      )}

      {/* Report Tab - manager, owner, admin, developer, finance/manager dengan akses accounting */}
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
