import { NextRequest, NextResponse } from "next/server";
import { OperationalService } from "@/lib/services/operational.service";
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

    // Permission check
    const { authorized, message } = await checkPermissionWithGasStation(
      ["DEVELOPER", "ADMINISTRATOR", "OWNER", "OWNER_GROUP", "MANAGER", "FINANCE"],
      gasStationId
    );
    if (!authorized) {
      return NextResponse.json(
        { success: false, message },
        { status: 403 }
      );
    }

    // Get tanks with stock
    const tanksWithStock = await OperationalService.getTanksWithStock(gasStationId);

    return NextResponse.json({
      success: true,
      data: tanksWithStock,
    });
  } catch (error) {
    console.error("Error fetching tanks:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

