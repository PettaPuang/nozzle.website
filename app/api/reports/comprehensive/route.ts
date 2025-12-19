import { NextRequest, NextResponse } from "next/server";
import { ReportSalesService } from "@/lib/services/report-sales.service";
import { checkPermissionWithGasStation } from "@/lib/utils/permissions.server";
import { normalizeToUTC } from "@/lib/utils/datetime";

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

    // Permission check: MANAGER, OWNER, ADMINISTRATOR, DEVELOPER
    const { authorized, message } = await checkPermissionWithGasStation(
      ["MANAGER", "OWNER"],
      gasStationId
    );
    if (!authorized) {
      return NextResponse.json(
        { success: false, message },
        { status: 403 }
      );
    }

    // Normalize dates to UTC
    const startDateUTC = normalizeToUTC(startDate);
    const endDateUTC = normalizeToUTC(endDate);
    
    if (!startDateUTC || !endDateUTC) {
      return NextResponse.json(
        { success: false, message: "Invalid date format" },
        { status: 400 }
      );
    }

    const data = await ReportSalesService.getComprehensiveSalesReport(
      gasStationId,
      startDateUTC,
      endDateUTC
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching comprehensive report:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
