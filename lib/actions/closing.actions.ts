"use server";

import { checkPermission } from "@/lib/utils/permissions.server";
import {
  createMonthlyClosingTransaction,
  hasMonthlyClosingBeenDone,
  getGasStationsNeedingClosing,
  autoCloseAllGasStations,
} from "@/lib/utils/transaction/transaction-closing";
import { revalidatePath } from "next/cache";

type ActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Manual closing untuk gas station tertentu
 * Hanya bisa dilakukan oleh ADMINISTRATOR atau FINANCE
 */
export async function manualMonthlyClosing(
  gasStationId: string,
  closingDate: Date
): Promise<ActionResult> {
  try {
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
    ]);

    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // Check if already closed
    const year = closingDate.getFullYear();
    const month = closingDate.getMonth();
    const previousMonth = new Date(year, month - 1, 1);

    const hasClosed = await hasMonthlyClosingBeenDone(
      gasStationId,
      previousMonth.getFullYear(),
      previousMonth.getMonth()
    );

    if (hasClosed) {
      return {
        success: false,
        message: "Penutupan buku untuk bulan tersebut sudah dilakukan",
      };
    }

    const result = await createMonthlyClosingTransaction(
      gasStationId,
      closingDate,
      user.id
    );

    revalidatePath(`/gas-stations/${gasStationId}`);
    revalidatePath(`/finance`);

    return {
      success: true,
      message: `Penutupan buku ${result.monthName} berhasil. ${
        result.isProfit ? "Laba" : "Rugi"
      }: Rp ${Math.abs(result.balance).toLocaleString("id-ID")}`,
      data: result,
    };
  } catch (error: any) {
    console.error("Manual monthly closing error:", error);
    return {
      success: false,
      message: error.message || "Gagal melakukan penutupan buku",
    };
  }
}

/**
 * Get status penutupan buku untuk bulan tertentu
 */
export async function getMonthlyClosingStatus(
  gasStationId: string,
  year: number,
  month: number
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

    const hasClosed = await hasMonthlyClosingBeenDone(
      gasStationId,
      year,
      month
    );

    return {
      success: true,
      data: { hasClosed },
    };
  } catch (error: any) {
    console.error("Get monthly closing status error:", error);
    return {
      success: false,
      message: error.message || "Gagal mengambil status penutupan buku",
    };
  }
}

/**
 * Get list gas stations yang perlu closing
 * Hanya untuk ADMINISTRATOR
 */
export async function getGasStationsNeedingClosingAction(
  targetMonth: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission(["ADMINISTRATOR"]);

    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const gasStationIds = await getGasStationsNeedingClosing(targetMonth);

    return {
      success: true,
      data: gasStationIds,
    };
  } catch (error: any) {
    console.error("Get gas stations needing closing error:", error);
    return {
      success: false,
      message: error.message || "Gagal mengambil data",
    };
  }
}

/**
 * Auto-close semua gas stations (untuk cron job)
 * Hanya untuk ADMINISTRATOR
 */
export async function autoCloseAllGasStationsAction(): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission(["ADMINISTRATOR"]);

    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const results = await autoCloseAllGasStations();

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    revalidatePath(`/finance`);

    return {
      success: true,
      message: `Penutupan buku selesai. Berhasil: ${successCount}, Gagal: ${failCount}`,
      data: results,
    };
  } catch (error: any) {
    console.error("Auto-close all gas stations error:", error);
    return {
      success: false,
      message: error.message || "Gagal melakukan penutupan buku otomatis",
    };
  }
}
