"use server";

import { TankHistoryService } from "@/lib/services/tank-history.service";
import { checkPermission } from "@/lib/utils/permissions.server";
import { normalizeToUTC, startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";

type ActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Get tank history (daily report and summary)
 */
export async function getTankHistory(
  tankId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
      "UNLOADER",
      "OWNER",
      "OWNER_GROUP",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: null };
    }

    // Normalize dates to UTC to ensure consistency
    const normalizedStartDate = startDate ? startOfDayUTC(startDate) : undefined;
    const normalizedEndDate = endDate ? endOfDayUTC(endDate) : undefined;

    const [dailyReport, summary] = await Promise.all([
      TankHistoryService.getTankDailyReportForClient(tankId, normalizedStartDate, normalizedEndDate),
      TankHistoryService.getTankSummaryForClient(tankId),
    ]);

    return {
      success: true,
      data: {
        dailyReport,
        summary,
      },
    };
  } catch (error) {
    console.error("Get tank history error:", error);
    return { success: false, message: "Gagal mengambil data", data: null };
  }
}

