import { NextRequest, NextResponse } from "next/server";
import { fixPurchaseTransactionDeliveredVolume } from "@/lib/actions/rollback";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gasStationId } = body;

    // gasStationId optional, jika tidak ada akan fix semua
    const result = await fixPurchaseTransactionDeliveredVolume(
      gasStationId || undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fixing delivered volume:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}

