"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC, addDaysUTC } from "@/lib/utils/datetime";
import {
  createGasStationSchema,
  updateGasStationSchema,
} from "@/lib/validations/infrastructure.validation";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import { createStandardCOAs } from "@/lib/utils/coa.utils";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createGasStation(
  input: z.infer<typeof createGasStationSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check - HANYA DEVELOPER
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createGasStationSchema.parse(input);

    // 3. Database + Audit trail
    await prisma.$transaction(async (tx) => {
      // Auto-set trial 15 hari untuk SPBU baru
      const now = nowUTC();
      const trialEndDate = addDaysUTC(now, 15);

      const gasStation = await tx.gasStation.create({
        data: {
          name: validated.name,
          address: validated.address,
          latitude: validated.latitude || null,
          longitude: validated.longitude || null,
          owner: {
            connect: { id: validated.ownerId },
          },
          openTime: validated.openTime,
          closeTime: validated.closeTime,
          status: validated.status || "ACTIVE",
          managerCanPurchase: validated.managerCanPurchase ?? false,
          financeCanPurchase: validated.financeCanPurchase ?? false,
          hasTitipan: validated.hasTitipan ?? false,
          titipanNames: validated.titipanNames || [],
          // Subscription: Trial 15 hari untuk SPBU baru
          subscriptionType: "TRIAL",
          subscriptionStartDate: now,
          subscriptionEndDate: trialEndDate,
          isTrial: true,
          createdBy: { connect: { id: user!.id } },
        },
      });

      // 4. Auto-create standard COAs (dalam transaction yang sama)
      await createStandardCOAs(gasStation.id, user!.id, tx);

      // 5. Auto-create Titipan COAs jika hasTitipan = true
      if (validated.hasTitipan && validated.titipanNames && validated.titipanNames.length > 0) {
        const { createTitipanCOAs } = await import("@/lib/utils/coa.utils");
        await createTitipanCOAs(
          gasStation.id,
          validated.titipanNames,
          user!.id,
          tx
        );
      }

      // 5. Auto-create default products dengan COA
      const defaultProducts = [
        {
          name: "Pertalite",
          ron: "RON 90",
          purchasePrice: 9661,
          sellingPrice: 10000,
        },
        {
          name: "Pertamax",
          ron: "RON 92",
          purchasePrice: 11963,
          sellingPrice: 12500,
        },
        {
          name: "Biosolar",
          ron: "CN 48",
          purchasePrice: 6556,
          sellingPrice: 6800,
        },
        {
          name: "Dexlite",
          ron: "CN 52",
          purchasePrice: 13765,
          sellingPrice: 14200,
        },
      ];

      // Import COA utils untuk membuat COA produk
      const {
        findOrCreateInventoryCOA,
        findOrCreateRevenueCOAForProduct,
        findOrCreateCOGSCOA,
        findOrCreateShrinkageCOA,
      } = await import("@/lib/utils/coa.utils");

      for (const productData of defaultProducts) {
        await tx.product.create({
          data: {
            gasStation: { connect: { id: gasStation.id } },
            name: productData.name,
            ron: productData.ron,
            purchasePrice: productData.purchasePrice,
            sellingPrice: productData.sellingPrice,
            createdBy: { connect: { id: user!.id } },
          },
        });

        // Auto-create COAs untuk produk default ini
        await findOrCreateInventoryCOA(
          gasStation.id,
          productData.name,
          user!.id,
          tx
        );
        await findOrCreateRevenueCOAForProduct(
          gasStation.id,
          productData.name,
          user!.id,
          tx
        );
        await findOrCreateCOGSCOA(
          gasStation.id,
          productData.name,
          user!.id,
          tx
        );
        await findOrCreateShrinkageCOA(
          gasStation.id,
          productData.name,
          user!.id,
          tx
        );
      }
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath("/gas-stations");
    revalidatePath("/welcome");
    return { success: true, message: "Gas station created successfully" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to create gas station" };
  }
}

export async function updateGasStation(
  id: string,
  input: z.infer<typeof updateGasStationSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check dengan gas station access
    // ADMINISTRATOR dan DEVELOPER bisa update gas station
    const { authorized, user, message } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "DEVELOPER"],
      id
    );
    if (!authorized || !user?.id) {
      return { success: false, message: message || "Unauthorized" };
    }

    // 2. Validation
    const validated = updateGasStationSchema.parse(input);

    // 3. ADMINISTRATOR hanya bisa update ownerId ke ownernya sendiri
    if (user.roleCode === "ADMINISTRATOR" && validated.ownerId) {
      const userWithOwner = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ownerId: true },
      });

      if (userWithOwner?.ownerId !== validated.ownerId) {
        return {
          success: false,
          message:
            "Forbidden: Administrator hanya bisa mengubah owner ke ownernya sendiri",
        };
      }
    }

    // 3. Database + Audit trail
    // Verify user exists before setting updatedById
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

    await prisma.gasStation.update({
      where: { id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.address && { address: validated.address }),
        ...(validated.latitude !== undefined && {
          latitude: validated.latitude || null,
        }),
        ...(validated.longitude !== undefined && {
          longitude: validated.longitude || null,
        }),
        ...(validated.ownerId && {
          owner: { connect: { id: validated.ownerId } },
        }),
        ...(validated.openTime && { openTime: validated.openTime }),
        ...(validated.closeTime && { closeTime: validated.closeTime }),
        // Status hanya bisa diubah oleh DEVELOPER
        ...(user.roleCode === "DEVELOPER" && validated.status && { status: validated.status }),
        ...(validated.managerCanPurchase !== undefined && {
          managerCanPurchase: validated.managerCanPurchase,
        }),
        ...(validated.financeCanPurchase !== undefined && {
          financeCanPurchase: validated.financeCanPurchase,
        }),
        ...(validated.hasTitipan !== undefined && {
          hasTitipan: validated.hasTitipan,
        }),
        ...(validated.titipanNames !== undefined && {
          titipanNames: validated.titipanNames,
        }),
        ...(dbUser && {
          updatedBy: { connect: { id: dbUser.id } },
        }),
        updatedAt: nowUTC(),
      },
    });

    // 4. Auto-create Titipan COAs jika hasTitipan = true dan ada nama baru
    if (validated.hasTitipan && validated.titipanNames && validated.titipanNames.length > 0) {
      const { createTitipanCOAs } = await import("@/lib/utils/coa.utils");
      await createTitipanCOAs(
        id,
        validated.titipanNames,
        user.id,
        undefined // Tidak pakai tx karena sudah di luar transaction
      );
    }

    // 5. Cache invalidation
    revalidatePath("/admin");
    revalidatePath("/gas-stations");
    revalidatePath("/welcome");
    revalidatePath(`/gas-stations/${id}`);
    return { success: true, message: "Gas station updated successfully" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Update gas station error:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update gas station",
    };
  }
}

export async function deleteGasStation(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check dengan gas station access
    // ADMINISTRATOR hanya bisa delete gas station milik ownernya
    // DEVELOPER bisa delete semua
    const { authorized, message } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "DEVELOPER"],
      id
    );
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Database
    await prisma.gasStation.delete({
      where: { id },
    });

    // 3. Cache invalidation
    revalidatePath("/admin");
    revalidatePath("/gas-stations");
    revalidatePath("/welcome");
    return { success: true, message: "Gas station deleted successfully" };
  } catch (error) {
    console.error("Delete gas station error:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete gas station",
    };
  }
}

/**
 * Get gas stations by owner (untuk OWNER_GROUP)
 * OWNER_GROUP bisa akses semua gas station milik ownernya
 */
export async function getGasStationsByOwner(
  ownerId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "OWNER_GROUP",
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Verify OWNER_GROUP & ADMINISTRATOR has access to this owner
    if (user.roleCode === "OWNER_GROUP" || user.roleCode === "ADMINISTRATOR") {
      // Fetch user dengan ownerId dari database
      const userWithOwner = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ownerId: true },
      });

      if (userWithOwner?.ownerId !== ownerId) {
        return {
          success: false,
          message: "Forbidden: No access to this owner's gas stations",
        };
      }
    }

    // 3. Get gas stations
    const gasStations = await prisma.gasStation.findMany({
      where: {
        ownerId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      message: "Gas stations retrieved successfully",
      data: gasStations,
    };
  } catch (error) {
    console.error("Get gas stations by owner error:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get gas stations",
    };
  }
}

/**
 * Get ownerId from gasStationId
 * Untuk redirect ke ownergroup page
 */
export async function getOwnerIdByGasStationId(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
      "OWNER",
      "OWNER_GROUP",
      "MANAGER",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Check gas station access
    const { authorized: hasAccess } = await checkPermissionWithGasStation(
      [user.roleCode as any],
      gasStationId
    );
    if (!hasAccess) {
      return {
        success: false,
        message: "Forbidden: No access to this gas station",
      };
    }

    // 3. Get gas station ownerId dan check toggle untuk MANAGER/FINANCE
    const gasStation = await prisma.gasStation.findUnique({
      where: { id: gasStationId },
      select: {
        ownerId: true,
        managerCanPurchase: true,
        financeCanPurchase: true,
      },
    });

    if (!gasStation) {
      return { success: false, message: "Gas station not found" };
    }

    // 4. Check toggle untuk MANAGER dan FINANCE
    if (user.roleCode === "MANAGER" && !gasStation.managerCanPurchase) {
      return {
        success: false,
        message: "Purchase access tidak diaktifkan untuk Manager",
      };
    }

    if (user.roleCode === "FINANCE" && !gasStation.financeCanPurchase) {
      return {
        success: false,
        message: "Purchase access tidak diaktifkan untuk Finance",
      };
    }

    return {
      success: true,
      message: "Owner ID retrieved successfully",
      data: { ownerId: gasStation.ownerId },
    };
  } catch (error) {
    console.error("Get owner ID by gas station ID error:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get owner ID",
    };
  }
}

/**
 * Toggle gas station status (ACTIVE/INACTIVE)
 * Hanya DEVELOPER yang bisa mengakses
 */
export async function toggleGasStationStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check - HANYA DEVELOPER
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized || !user?.id) {
      return { success: false, message: message || "Unauthorized" };
    }

    // 2. Verify gas station exists
    const gasStation = await prisma.gasStation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!gasStation) {
      return { success: false, message: "Gas station not found" };
    }

    // 3. Update status
    await prisma.gasStation.update({
      where: { id },
      data: {
        status,
        updatedById: user.id,
        updatedAt: nowUTC(),
      },
    });

    // 4. Cache invalidation
    revalidatePath("/welcome");
    revalidatePath("/admin");
    revalidatePath("/gas-stations");
    return {
      success: true,
      message: `Gas station status updated to ${status}`,
    };
  } catch (error) {
    console.error("Toggle gas station status error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to toggle gas station status",
    };
  }
}
