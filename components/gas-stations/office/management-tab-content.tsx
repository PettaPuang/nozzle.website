"use client";

import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useSidebar } from "@/components/gas-stations/office/sidebar-context";
import { ManagerCard } from "@/components/gas-stations/office/manager/manager-card";
import { FinanceCard } from "@/components/gas-stations/office/finance/finance-card";
import { SettingsCard } from "@/components/gas-stations/office/admin/settings-card";
import { AccountingCard } from "@/components/gas-stations/office/accounting/accounting-card";
import { ManagerDetailPanel } from "@/components/gas-stations/office/manager/manager-detail-panel";
import { FinanceDetailPanel } from "@/components/gas-stations/office/finance/finance-detail-panel";
import { SettingsDetailPanel } from "@/components/gas-stations/office/admin/settings-detail-panel";
import { AccountingDetailPanel } from "@/components/gas-stations/office/accounting/accounting-detail-panel";
import { cn } from "@/lib/utils";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type { GasStationDetailForClient } from "@/lib/services/gas-station.service";
import type { OperationalDataForClient } from "@/lib/services/operational.service";
import type { ProductForClient } from "@/lib/services/product.service";
import type { UnloadWithRelations } from "@/lib/services/unload.service";
import type { OperatorWithShifts } from "@/lib/services/operator.service";
import type { ActiveRole } from "@/lib/services/role.service";

type ManagementTabContentProps = {
  gasStation: GasStationDetailForClient["gasStation"] & {
    owner: {
      username: string;
      email: string;
      profile?: { name: string; phone?: string | null } | null;
    };
    managerCanPurchase?: boolean;
    financeCanPurchase?: boolean;
  };
  detailStations: GasStationDetailForClient["stations"];
  operationalStations: OperationalDataForClient["stations"];
  staff: GasStationDetailForClient["staff"];
  administrators?: GasStationDetailForClient["administrators"];
  ownerGroups?: GasStationDetailForClient["ownerGroups"];
  products: ProductForClient[];
  unloads: UnloadWithRelations[];
  pendingUnloadCount: number;
  operators: OperatorWithShifts[];
  roles: ActiveRole[];
  pendingDepositsCountForFinance: number;
  pendingDepositsCountForManager: number;
  shiftVerificationCount?: number;
  pendingCashTransactionCount?: number;
  pendingTransactionsCount: number;
  pendingTankReadingsCount: number;
  isManager: boolean;
  isFinance: boolean;
  isAdmin: boolean;
  userId: string;
  userRole: string;
};

type SelectedCard = "settings" | "accounting" | "manager" | "finance" | null;

export function ManagementTabContent({
  gasStation,
  detailStations,
  operationalStations,
  staff,
  administrators = [],
  ownerGroups = [],
  products,
  unloads,
  pendingUnloadCount,
  operators,
  roles,
  pendingDepositsCountForFinance,
  pendingDepositsCountForManager,
  shiftVerificationCount = 0,
  pendingCashTransactionCount = 0,
  pendingTransactionsCount,
  pendingTankReadingsCount,
  isManager,
  isFinance,
  isAdmin,
  userId,
  userRole,
}: ManagementTabContentProps) {
  // Card visibility menggunakan hasPermission
  // DEVELOPER & ADMINISTRATOR otomatis bypass di hasPermission
  const canAccessSettings = hasPermission(userRole as RoleCode, [
    "DEVELOPER",
    "ADMINISTRATOR",
  ]);

  // Accounting: DEVELOPER & ADMINISTRATOR selalu bisa akses
  // FINANCE bisa akses jika financeCanPurchase === true (setting di gas station)
  // MANAGER bisa akses jika managerCanPurchase === true (setting di gas station)
  const canAccessAccounting =
    hasPermission(userRole as RoleCode, ["DEVELOPER", "ADMINISTRATOR"]) ||
    (userRole === "FINANCE" && gasStation.financeCanPurchase === true) ||
    (userRole === "MANAGER" && gasStation.managerCanPurchase === true);

  const canAccessManager = hasPermission(userRole as RoleCode, ["MANAGER"]);
  const canAccessFinance = hasPermission(userRole as RoleCode, ["FINANCE"]);

  // Hitung jumlah card yang bisa diakses
  const accessibleCardsCount =
    (canAccessSettings ? 1 : 0) +
    (canAccessAccounting ? 1 : 0) +
    (canAccessManager ? 1 : 0) +
    (canAccessFinance ? 1 : 0);

  // Jika hanya bisa akses 1 card, langsung ke detail panel tanpa sidebar
  const showSidebar = accessibleCardsCount > 1;

  // Determine default selected card
  // Finance dan Manager tetap di detail panel masing-masing, walaupun memiliki akses accounting
  const getDefaultCard = (): SelectedCard => {
    if (canAccessSettings) return "settings";
    if (canAccessFinance) return "finance";
    if (canAccessManager) return "manager";
    if (canAccessAccounting) return "accounting";
    return null;
  };

  const [selectedCard, setSelectedCard] = useState<SelectedCard>(
    getDefaultCard()
  );
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const handleCardClick = (card: SelectedCard) => {
    setSelectedCard(card);
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Left Sidebar - Cards (hanya muncul jika bisa akses lebih dari 1 card) */}
      {showSidebar && (
        <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <CollapsibleContent className="data-[state=closed]:hidden">
            <div className="w-[240px] lg:w-80 border-r overflow-y-auto p-2 lg:p-4 space-y-2 lg:space-y-4">
              {/* Settings Card - hanya untuk DEVELOPER, ADMINISTRATOR */}
              {canAccessSettings && (
                <SettingsCard
                  gasStation={gasStation}
                  stations={operationalStations}
                  staff={staff}
                  products={products}
                  roles={roles}
                  selected={selectedCard === "settings"}
                  onClick={() => handleCardClick("settings")}
                />
              )}
              {/* Accounting Card - hanya untuk DEVELOPER, ADMINISTRATOR */}
              {canAccessAccounting && (
                <AccountingCard
                  selected={selectedCard === "accounting"}
                  onClick={() => handleCardClick("accounting")}
                />
              )}
              {/* Manager Card - hanya untuk MANAGER (DEVELOPER & ADMINISTRATOR otomatis bypass) */}
              {canAccessManager && (
                <ManagerCard
                  unloads={unloads}
                  pendingUnloadCount={pendingUnloadCount}
                  gasStationId={gasStation.id}
                  pendingTransactionsCount={pendingTransactionsCount}
                  pendingDepositsCount={pendingDepositsCountForManager}
                  selected={selectedCard === "manager"}
                  onClick={() => handleCardClick("manager")}
                />
              )}
              {/* Finance Card - hanya untuk FINANCE (DEVELOPER & ADMINISTRATOR otomatis bypass) */}
              {canAccessFinance && (
                <FinanceCard
                  gasStationId={gasStation.id}
                  inputDepositCount={pendingDepositsCountForFinance}
                  pendingApprovalCount={pendingDepositsCountForManager}
                  shiftVerificationCount={shiftVerificationCount}
                  pendingCashTransactionCount={pendingCashTransactionCount}
                  selected={selectedCard === "finance"}
                  onClick={() => handleCardClick("finance")}
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Right Panel - Detail */}
      <div className="flex-1 overflow-hidden bg-background">
        {selectedCard === "settings" && canAccessSettings && (
          <SettingsDetailPanel
            gasStation={gasStation}
            stations={operationalStations}
            staff={staff}
            administrators={administrators}
            ownerGroups={ownerGroups}
            products={products}
            roles={roles}
            currentUserRole={userRole}
          />
        )}
        {selectedCard === "accounting" && canAccessAccounting && (
          <AccountingDetailPanel
            gasStationId={gasStation.id}
            userRole={userRole}
          />
        )}
        {selectedCard === "manager" && canAccessManager && (
          <ManagerDetailPanel
            gasStationId={gasStation.id}
            {...({
              ownerId: gasStation.ownerId,
              pendingUnloadCount,
              pendingTransactionsCount,
              pendingDepositsCount: pendingDepositsCountForManager,
              pendingTankReadingsCount,
              userRole,
            } as any)}
          />
        )}
        {selectedCard === "finance" && canAccessFinance && (
          <FinanceDetailPanel
            gasStationId={gasStation.id}
            ownerId={gasStation.ownerId}
            inputDepositCount={pendingDepositsCountForFinance}
            shiftVerificationCount={shiftVerificationCount}
            pendingCashTransactionCount={pendingCashTransactionCount}
            userRole={userRole}
          />
        )}
        {!selectedCard && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">
                Pilih card untuk melihat detail
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
