import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");

    if (!ownerId) {
      return NextResponse.json(
        { success: false, message: "Missing ownerId parameter" },
        { status: 400 }
      );
    }

    // Get owner with profile
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, message: "Owner not found" },
        { status: 404 }
      );
    }

    const ownerName = owner.profile?.name || owner.username;

    return NextResponse.json({
      success: true,
      data: {
        name: ownerName,
      },
    });
  } catch (error) {
    console.error("Error fetching owner name:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

