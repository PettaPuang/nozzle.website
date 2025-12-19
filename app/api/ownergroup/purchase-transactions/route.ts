import { NextRequest, NextResponse } from "next/server";
import { getPurchaseTransactionsForOwnerGroup } from "@/lib/actions/ownergroup.actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    
    const result = await getPurchaseTransactionsForOwnerGroup(ownerId || undefined);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

