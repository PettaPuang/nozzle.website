import { NextRequest, NextResponse } from "next/server";
import { OwnerReportService } from "@/lib/services/owner-report.service";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is owner, owner_group, administrator, or developer
    const roleCode = session.user.roleCode;
    if (
      roleCode !== "OWNER" &&
      roleCode !== "OWNER_GROUP" &&
      roleCode !== "ADMINISTRATOR" &&
      roleCode !== "DEVELOPER"
    ) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!ownerId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    let targetOwnerId: string;

    // Determine target ownerId based on role
    if (roleCode === "OWNER") {
      // OWNER: hanya bisa lihat report mereka sendiri
      targetOwnerId = session.user.id;
    } else if (roleCode === "OWNER_GROUP") {
      // OWNER_GROUP: hanya bisa lihat report ownernya (dari ownerId di database)
      const userWithOwner = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ownerId: true },
      });

      if (!userWithOwner?.ownerId) {
        return NextResponse.json(
          { success: false, message: "User tidak memiliki ownerId" },
          { status: 400 }
        );
      }

      // OWNER_GROUP hanya bisa lihat report ownernya, bukan owner lain
      if (ownerId !== userWithOwner.ownerId) {
        return NextResponse.json(
          {
            success: false,
            message: "Forbidden: Anda hanya bisa melihat report owner Anda",
          },
          { status: 403 }
        );
      }

      targetOwnerId = userWithOwner.ownerId;
    } else if (roleCode === "ADMINISTRATOR") {
      // ADMINISTRATOR: bisa lihat report ownernya (dari ownerId di database)
      const userWithOwner = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ownerId: true },
      });

      if (!userWithOwner?.ownerId) {
        return NextResponse.json(
          { success: false, message: "User tidak memiliki ownerId" },
          { status: 400 }
        );
      }

      // ADMINISTRATOR hanya bisa lihat report ownernya, bukan owner lain
      if (ownerId !== userWithOwner.ownerId) {
        return NextResponse.json(
          {
            success: false,
            message: "Forbidden: Anda hanya bisa melihat report owner Anda",
          },
          { status: 403 }
        );
      }

      targetOwnerId = userWithOwner.ownerId;
    } else {
      // DEVELOPER: bisa lihat report owner manapun
      targetOwnerId = ownerId;
    }

    // Normalize dates to UTC start and end of day
    const startDateUTC = startOfDayUTC(startDate);
    const endDateUTC = endOfDayUTC(endDate);

    const data = await OwnerReportService.getOwnerReportSummary(
      targetOwnerId,
      startDateUTC,
      endDateUTC
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching owner report:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
