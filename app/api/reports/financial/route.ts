import { NextRequest, NextResponse } from "next/server";
import { FinancialReportService } from "@/lib/services/financial-report.service";
import { checkPermissionWithGasStation } from "@/lib/utils/permissions.server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gasStationId = searchParams.get("gasStationId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!gasStationId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Permission check
    const { authorized, message, user } = await checkPermissionWithGasStation(
      ["DEVELOPER", "ADMINISTRATOR", "OWNER", "MANAGER", "FINANCE"],
      gasStationId
    );
    if (!authorized || !user) {
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    // Check accounting access untuk MANAGER dan FINANCE
    if (user.roleCode === "MANAGER" || user.roleCode === "FINANCE") {
      const gasStation = await prisma.gasStation.findUnique({
        where: { id: gasStationId },
        select: {
          managerCanPurchase: true,
          financeCanPurchase: true,
        },
      });

      if (!gasStation) {
        return NextResponse.json(
          { success: false, message: "Gas station not found" },
          { status: 404 }
        );
      }

      if (
        (user.roleCode === "MANAGER" && !gasStation.managerCanPurchase) ||
        (user.roleCode === "FINANCE" && !gasStation.financeCanPurchase)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Forbidden: ${
              user.roleCode === "MANAGER" ? "Manager" : "Finance"
            } accounting access is not enabled for this gas station`,
          },
          { status: 403 }
        );
      }
    }

    // Normalize dates to UTC start and end of day
    const startDateUTC = startOfDayUTC(startDate);
    const endDateUTC = endOfDayUTC(endDate);

    // Check if this is for balance sheet (use full history)
    const useFullHistoryForBalanceSheet =
      searchParams.get("useFullHistoryForBalanceSheet") === "true";

    const data = await FinancialReportService.getFinancialReport(
      gasStationId,
      startDateUTC,
      endDateUTC,
      { useFullHistoryForBalanceSheet }
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching financial report:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
