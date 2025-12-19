import { NextRequest, NextResponse } from "next/server";
import { ReportSalesService } from "@/lib/services/report-sales.service";
import { checkPermissionWithGasStation } from "@/lib/utils/permissions.server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gasStationId = searchParams.get("gasStationId");

    if (!gasStationId) {
      return NextResponse.json(
        { success: false, message: "Missing gasStationId parameter" },
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

    const data = await ReportSalesService.getAvailableProducts(gasStationId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
