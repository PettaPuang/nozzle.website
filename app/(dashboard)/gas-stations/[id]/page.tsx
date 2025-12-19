import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { GasStationService } from "@/lib/services/gas-station.service";
import { OperationalService } from "@/lib/services/operational.service";
import { ProductService } from "@/lib/services/product.service";
import { UnloadService } from "@/lib/services/unload.service";
import { RoleService } from "@/lib/services/role.service";
import { OperatorService } from "@/lib/services/operator.service";
import { FinanceService } from "@/lib/services/finance.service";
import { TransactionService } from "@/lib/services/transaction.service";
import { TankReadingService } from "@/lib/services/tank-reading.service";
import { GasStationClient } from "./client";
import type { RoleCode } from "@/lib/utils/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GasStationPage({ params }: PageProps) {
  // Note: auth() and checkAccess() already called in layout.tsx
  // Layout will redirect if not authenticated or no access

  const { id } = await params;

  // Get session for user info (layout already validated access)
  const session = await auth();
  if (!session) redirect("/login");

  const isDeveloper = session.user.roleCode === "DEVELOPER";
  // Check if user is operator
  const isOperator = session.user.roleCode === "operator";

  // Fetch both gas station detail and operational data
  // DEVELOPER bisa akses gas station yang inactive
  const [
    gasStationDetail,
    operationalData,
    products,
    unloads,
    pendingUnloadCount,
    pendingDepositsCountForFinance,
    pendingDepositsCountForManager,
    shiftVerificationCount,
    pendingCashTransactionCount,
    pendingTransactionsCount,
    pendingTankReadingsCount,
    tanksWithStock,
    roles,
    operators,
  ] = await Promise.all([
    GasStationService.findByIdForDetail(id, isDeveloper),
    OperationalService.getDataForClient(id, session.user.id),
    ProductService.findAllForClient(id),
    UnloadService.findByGasStationForClient(id),
    UnloadService.countPendingByGasStation(id),
    FinanceService.countPendingDepositsForFinance(id),
    FinanceService.countPendingDepositsForManager(id),
    FinanceService.countShiftsToVerify(id),
    TransactionService.countPendingCashTransactions(id),
    TransactionService.countPendingApproval(id),
    TankReadingService.countPendingByGasStation(id),
    OperationalService.getTanksWithStock(id),
    RoleService.findAllActive(),
    // If operator, only fetch their own data, otherwise fetch all operators
    isOperator
      ? OperatorService.getOperatorsWithShifts(id, session.user.id)
      : OperatorService.getOperatorsWithShifts(id),
  ]);

  if (!gasStationDetail || !operationalData) {
    notFound();
  }

  return (
    <GasStationClient
      gasStationDetail={gasStationDetail}
      operationalData={operationalData}
      userRole={session.user.roleCode as RoleCode}
      userId={session.user.id}
      products={products}
      unloads={unloads}
      pendingUnloadCount={pendingUnloadCount}
      pendingDepositsCountForFinance={pendingDepositsCountForFinance}
      pendingDepositsCountForManager={pendingDepositsCountForManager}
      shiftVerificationCount={shiftVerificationCount}
      pendingCashTransactionCount={pendingCashTransactionCount}
      pendingTransactionsCount={pendingTransactionsCount}
      pendingTankReadingsCount={pendingTankReadingsCount}
      tanksWithStock={tanksWithStock}
      roles={roles}
      operators={operators}
    />
  );
}
