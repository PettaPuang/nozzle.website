"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import {
  createCOASchema,
  updateCOASchema,
} from "@/lib/validations/coa.validation";
import type { z } from "zod";
import { COAService } from "@/lib/services/coa.service";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createCOA(
  input: z.infer<typeof createCOASchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // ADMINISTRATOR dan DEVELOPER bisa create COA langsung
    // FINANCE bisa create COA melalui cash transaction form
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
      "FINANCE",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createCOASchema.parse(input);

    // 3. Check if COA name already exists for this gas station
    const existing = await prisma.cOA.findUnique({
      where: {
        gasStationId_name: {
          gasStationId: validated.gasStationId,
          name: validated.name,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Akun "${validated.name}" sudah ada untuk SPBU ini`,
      };
    }

    // 4. Database + Audit trail
    const coa = await prisma.cOA.create({
      data: {
        gasStation: {
          connect: { id: validated.gasStationId },
        },
        code: validated.code || null,
        name: validated.name,
        category: validated.category,
        status: validated.status || "ACTIVE",
        description: validated.description || null,
        createdBy: { connect: { id: user!.id } },
      },
    });

    // 5. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return {
      success: true,
      message: "COA berhasil dibuat",
      data: { id: coa.id },
    };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to create COA" };
  }
}

export async function updateCOA(
  id: string,
  input: z.infer<typeof updateCOASchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = updateCOASchema.parse(input);

    // 3. Check if COA exists
    const existing = await prisma.cOA.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, message: "COA tidak ditemukan" };
    }

    // 4. Check if name already exists (if name is being updated)
    if (validated.name && validated.name !== existing.name) {
      const nameExists = await prisma.cOA.findUnique({
        where: {
          gasStationId_name: {
            gasStationId: existing.gasStationId,
            name: validated.name,
          },
        },
      });

      if (nameExists) {
        return {
          success: false,
          message: `Akun "${validated.name}" sudah ada untuk SPBU ini`,
        };
      }
    }

    // 5. Database + Audit trail
    await prisma.cOA.update({
      where: { id },
      data: {
        ...(validated.code !== undefined && { code: validated.code }),
        ...(validated.name && { name: validated.name }),
        ...(validated.category && { category: validated.category }),
        ...(validated.status && { status: validated.status }),
        ...(validated.description !== undefined && {
          description: validated.description,
        }),
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${existing.gasStationId}`);
    return { success: true, message: "COA berhasil diupdate" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to update COA" };
  }
}

export async function deleteCOA(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Check if COA exists
    const existing = await prisma.cOA.findUnique({
      where: { id },
      include: {
        journalEntries: true,
      },
    });

    if (!existing) {
      return { success: false, message: "COA tidak ditemukan" };
    }

    // 3. Check if COA is being used
    if (existing.journalEntries.length > 0) {
      return {
        success: false,
        message: "COA tidak dapat dihapus karena sudah digunakan dalam jurnal",
      };
    }

    // 4. Soft delete via status
    await prisma.cOA.update({
      where: { id },
      data: {
        status: "INACTIVE",
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 5. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${existing.gasStationId}`);
    return { success: true, message: "COA berhasil dihapus" };
  } catch (error) {
    return { success: false, message: "Failed to delete COA" };
  }
}

export async function getCOAs(gasStationId: string) {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
      "FINANCE",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const coas = await COAService.getCOAs(gasStationId);

    return {
      success: true,
      data: coas,
    };
  } catch (error) {
    console.error("Get COAs error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

export async function getCOAsWithBalance(gasStationId: string) {
  try {
    // Permission check konsisten dengan financial report API
    const { authorized, message, user } = await checkPermissionWithGasStation(
      [
        "DEVELOPER",
        "ADMINISTRATOR",
        "OWNER",
        "OWNER_GROUP",
        "MANAGER",
        "FINANCE",
      ],
      gasStationId
    );
    if (!authorized || !user) {
      return { success: false, message: message || "Unauthorized", data: [] };
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
        return {
          success: false,
          message: "Gas station not found",
          data: [],
        };
      }

      if (
        (user.roleCode === "MANAGER" && !gasStation.managerCanPurchase) ||
        (user.roleCode === "FINANCE" && !gasStation.financeCanPurchase)
      ) {
        return {
          success: false,
          message: `Forbidden: ${
            user.roleCode === "MANAGER" ? "Manager" : "Finance"
          } accounting access is not enabled for this gas station`,
          data: [],
        };
      }
    }

    const coasWithBalance = await COAService.getCOAsWithBalance(gasStationId);

    return {
      success: true,
      data: coasWithBalance,
    };
  } catch (error) {
    console.error("Get COAs with balance error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

export async function getTitipanCOAs(gasStationId: string) {
  try {
    const { authorized, message } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "DEVELOPER", "MANAGER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message: message || "Unauthorized", data: [] };
    }

    // Fetch COA dengan filter: category LIABILITY dan name contains "Titipan"
    const coas = await prisma.cOA.findMany({
      where: {
        gasStationId,
        category: "LIABILITY",
        name: {
          contains: "Titipan",
          mode: "insensitive",
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      data: coas,
    };
  } catch (error) {
    console.error("Get Titipan COAs error:", error);
    return { success: false, message: "Gagal mengambil COA Titipan", data: [] };
  }
}

export async function getCOAJournalEntries(coaId: string) {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const journalEntries = await COAService.getCOAJournalEntries(coaId);

    return {
      success: true,
      data: journalEntries,
    };
  } catch (error) {
    console.error("Get COA journal entries error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}
