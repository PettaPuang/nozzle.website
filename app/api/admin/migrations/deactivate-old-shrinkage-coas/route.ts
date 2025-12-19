import { NextResponse } from "next/server";
import { migrateOldShrinkageCOAs } from "@/lib/actions/migration.actions";
import { checkPermission } from "@/lib/utils/permissions.server";

export async function POST() {
  try {
    // Hanya DEVELOPER yang bisa menjalankan migration
    const { authorized, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: message || "Unauthorized" },
        { status: 403 }
      );
    }

    const result = await migrateOldShrinkageCOAs();

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error("Error in migrate-old-shrinkage-coas API:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

