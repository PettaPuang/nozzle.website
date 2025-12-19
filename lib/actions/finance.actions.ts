"use server";

import { FinanceService } from "@/lib/services/finance.service";
import { TransactionService } from "@/lib/services/transaction.service";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";

type ActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Get payment method balance
 */
export async function getPaymentMethodBalance(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const balance = await FinanceService.getPaymentMethodBalance(gasStationId);

    return {
      success: true,
      data: balance,
    };
  } catch (error) {
    console.error("Get payment method balance error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get payment method balance by date range
 */
export async function getPaymentMethodBalanceByDateRange(
  gasStationId: string,
  startDate: Date,
  endDate: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const balance =
      await FinanceService.getPaymentMethodBalanceByDateRange(
        gasStationId,
        startDate,
        endDate
      );

    return {
      success: true,
      data: balance,
    };
  } catch (error) {
    console.error("Get payment method balance by date range error:", error);
    return { success: false, message: "Gagal mengambil data" };
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const transactions = await FinanceService.getTransactionHistory(
      gasStationId
    );

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error("Get transaction history error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get pending deposits
 */
export async function getPendingDeposits(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "MANAGER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const deposits = await FinanceService.getPendingDeposits(gasStationId);

    return {
      success: true,
      data: deposits,
    };
  } catch (error) {
    console.error("Get pending deposits error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get deposit history
 */
export async function getDepositHistory(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "MANAGER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const deposits = await FinanceService.getDepositHistory(gasStationId);

    return {
      success: true,
      data: deposits,
    };
  } catch (error) {
    console.error("Get deposit history error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get pending approval transactions
 */
export async function getPendingApprovalTransactions(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "MANAGER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const transactions =
      await TransactionService.getPendingApprovalTransactions(gasStationId);

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error("Get pending approval transactions error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get transaction history with filters
 */
export async function getTransactionHistoryWithFilters(
  gasStationId: string,
  approverId?: string,
  managerOnly?: boolean
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const approverRole = managerOnly ? "MANAGER" : undefined;

    const transactions = await TransactionService.getTransactionHistory(
      gasStationId,
      approverId,
      approverRole
    );

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error("Get transaction history error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}
