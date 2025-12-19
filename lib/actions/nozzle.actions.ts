"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  createNozzleSchema,
  updateNozzleSchema,
} from "@/lib/validations/infrastructure.validation";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createNozzle(
  input: z.infer<typeof createNozzleSchema>
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
    const validated = createNozzleSchema.parse(input);

    // 3. Validate product matches tank product
    const tank = await prisma.tank.findUnique({
      where: { id: validated.tankId },
      include: { product: true },
    });

    if (!tank) {
      return { success: false, message: "Tank tidak ditemukan" };
    }

    if (tank.productId !== validated.productId) {
      return {
        success: false,
        message: `Product nozzle harus sama dengan product tank (${tank.product.name})`,
      };
    }

    // 4. Check if nozzle code already exists in this station (excluding soft-deleted)
    const existingNozzle = await prisma.nozzle.findFirst({
      where: {
        stationId: validated.stationId,
        code: validated.code,
        deletedAt: null, // Exclude soft-deleted nozzles
      },
    });

    if (existingNozzle) {
      return {
        success: false,
        message: "Kode nozzle sudah digunakan di station ini",
      };
    }

    // 5. Database + Audit trail
    await prisma.nozzle.create({
      data: {
        station: {
          connect: { id: validated.stationId },
        },
        tank: {
          connect: { id: validated.tankId },
        },
        product: {
          connect: { id: validated.productId },
        },
        code: validated.code,
        name: validated.name,
        createdBy: { connect: { id: user!.id } },
      },
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    return { success: true, message: "Nozzle berhasil dibuat" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create nozzle error:", error);
    return { success: false, message: "Gagal membuat nozzle" };
  }
}

export async function updateNozzle(
  id: string,
  input: z.infer<typeof updateNozzleSchema>
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
    const validated = updateNozzleSchema.parse(input);

    // 3. Get current nozzle data
    const currentNozzle = await prisma.nozzle.findUnique({
      where: { id },
      include: {
        tank: {
          include: {
            product: true,
          },
        },
        nozzleReadings: {
          take: 1, // Hanya perlu cek apakah ada
        },
      },
    });

    if (!currentNozzle) {
      return { success: false, message: "Nozzle tidak ditemukan" };
    }

    if (currentNozzle.deletedAt) {
      return {
        success: false,
        message: "Tidak bisa mengupdate nozzle yang sudah dihapus",
      };
    }

    // 4. Validate product matches tank product (if tankId or productId changed)
    const newTankId = validated.tankId || currentNozzle.tankId;
    const newProductId = validated.productId || currentNozzle.productId;

    if (validated.tankId || validated.productId) {
      const tank = await prisma.tank.findUnique({
        where: { id: newTankId },
        include: { product: true },
      });

      if (!tank) {
        return { success: false, message: "Tank tidak ditemukan" };
      }

      if (tank.productId !== newProductId) {
        return {
          success: false,
          message: `Product nozzle harus sama dengan product tank (${tank.product.name})`,
        };
      }
    }

    // 5. Check if code already exists in the station (excluding current nozzle and soft-deleted)
    if (validated.code || validated.stationId) {
      const newStationId = validated.stationId || currentNozzle.stationId;
      const newCode = validated.code || currentNozzle.code;

      const existingNozzle = await prisma.nozzle.findFirst({
        where: {
          stationId: newStationId,
          code: newCode,
          id: { not: id },
          deletedAt: null, // Exclude soft-deleted nozzles
        },
      });

      if (existingNozzle) {
        return {
          success: false,
          message: "Kode nozzle sudah digunakan di station ini",
        };
      }
    }

    // 6. Warning if changing tankId/stationId when there's historical data
    const hasHistoricalData = currentNozzle.nozzleReadings.length > 0;
    const isChangingTankId =
      validated.tankId && validated.tankId !== currentNozzle.tankId;
    const isChangingStationId =
      validated.stationId && validated.stationId !== currentNozzle.stationId;

    if (hasHistoricalData && (isChangingTankId || isChangingStationId)) {
      // Allow update but log warning (data tetap aman karena query berdasarkan nozzleReadings)
      console.warn(
        `Nozzle ${id} diupdate: tankId atau stationId berubah dengan data historis. ` +
          `Data historis tetap aman karena query berdasarkan nozzleReadings.`
      );
    }

    // 7. Database + Audit trail
    await prisma.nozzle.update({
      where: { id },
      data: {
        ...(validated.stationId && {
          station: { connect: { id: validated.stationId } },
        }),
        ...(validated.tankId && {
          tank: { connect: { id: validated.tankId } },
        }),
        ...(validated.productId && {
          product: { connect: { id: validated.productId } },
        }),
        ...(validated.code && { code: validated.code }),
        ...(validated.name && { name: validated.name }),
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 8. Cache invalidation
    revalidatePath("/admin");
    return { success: true, message: "Nozzle berhasil diupdate" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Update nozzle error:", error);
    return { success: false, message: "Gagal mengupdate nozzle" };
  }
}

export async function deleteNozzle(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. VALIDASI PREVENTIF: Cek data terkait sebelum delete
    const nozzle = await prisma.nozzle.findUnique({
      where: { id },
      include: {
        nozzleReadings: {
          select: {
            id: true,
            operatorShiftId: true,
            createdAt: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            gasStation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        tank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!nozzle) {
      return { success: false, message: "Nozzle tidak ditemukan" };
    }

    if (nozzle.deletedAt) {
      return { success: false, message: "Nozzle sudah dihapus sebelumnya" };
    }

    // 3. VALIDASI: Cek apakah ada data terkait yang penting
    const nozzleReadingCount = nozzle.nozzleReadings.length;

    // Check for pending shifts
    const pendingShifts = await prisma.operatorShift.count({
      where: {
        stationId: nozzle.stationId,
        status: "PENDING",
        nozzleReadings: {
          some: {
            nozzleId: id,
          },
        },
      },
    });

    // Check for pending deposits
    const pendingDeposits = await prisma.deposit.count({
      where: {
        status: "PENDING",
        operatorShift: {
          nozzleReadings: {
            some: {
              nozzleId: id,
            },
          },
        },
      },
    });

    // Check for completed shifts (untuk informasi)
    const completedShifts = await prisma.operatorShift.count({
      where: {
        stationId: nozzle.stationId,
        status: "COMPLETED",
        nozzleReadings: {
          some: {
            nozzleId: id,
          },
        },
      },
    });

    // 4. VALIDASI: Block hard delete jika ada data penting
    const hasImportantData =
      nozzleReadingCount > 0 || pendingShifts > 0 || pendingDeposits > 0;

    if (hasImportantData) {
      // Log warning dengan detail lengkap
      console.warn(
        `[DELETE NOZZLE] Nozzle "${nozzle.name}" (Code: ${nozzle.code}, ID: ${id}) memiliki data terkait:\n` +
          `  - ${nozzleReadingCount} NozzleReading(s)\n` +
          `  - ${pendingShifts} Pending OperatorShift(s)\n` +
          `  - ${pendingDeposits} Pending Deposit(s)\n` +
          `  - ${completedShifts} Completed OperatorShift(s)\n` +
          `  User: ${user?.username || "Unknown"} (ID: ${
            user?.id || "Unknown"
          })\n` +
          `  Station: ${nozzle.station.name} (Code: ${nozzle.station.code}, ID: ${nozzle.station.id})\n` +
          `  GasStation: ${nozzle.station.gasStation.name} (ID: ${nozzle.station.gasStation.id})\n` +
          `  Tank: ${nozzle.tank.name} (Code: ${nozzle.tank.code}, ID: ${nozzle.tank.id})\n` +
          `  Product: ${nozzle.product.name} (ID: ${nozzle.product.id})\n` +
          `\n✅ Menggunakan SOFT DELETE untuk menjaga data historis.`
      );

      // Soft delete untuk menjaga data historis
      await prisma.nozzle.update({
        where: { id },
        data: {
          deletedAt: nowUTC(),
          deletedById: user!.id,
        },
      });

      console.log(
        `[DELETE NOZZLE] Nozzle "${nozzle.name}" (Code: ${
          nozzle.code
        }, ID: ${id}) berhasil di-soft delete oleh ${
          user?.username || "Unknown"
        }`
      );

      revalidatePath("/admin");
      return {
        success: true,
        message: `Nozzle "${nozzle.name}" berhasil dihapus (soft delete). Data historis tetap tersimpan untuk keperluan laporan.`,
        data: {
          nozzleId: id,
          nozzleName: nozzle.name,
          nozzleCode: nozzle.code,
          deleteType: "soft",
          relatedData: {
            nozzleReadings: nozzleReadingCount,
            pendingShifts,
            pendingDeposits,
            completedShifts,
          },
        },
      };
    }

    // 5. Jika tidak ada data penting, hard delete aman
    await prisma.nozzle.delete({
      where: { id },
    });

    console.log(
      `[DELETE NOZZLE] Nozzle "${nozzle.name}" (Code: ${
        nozzle.code
      }, ID: ${id}) berhasil di-hard delete oleh ${user?.username || "Unknown"}`
    );

    revalidatePath("/admin");
    return {
      success: true,
      message: `Nozzle "${nozzle.name}" berhasil dihapus`,
      data: {
        nozzleId: id,
        nozzleName: nozzle.name,
        nozzleCode: nozzle.code,
        deleteType: "hard",
      },
    };
  } catch (error) {
    console.error(`[DELETE NOZZLE] Error deleting nozzle ${id}:`, error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menghapus nozzle. Pastikan tidak ada data terkait.",
    };
  }
}

/**
 * Check related data before deletion (untuk preview di dialog)
 */
export async function checkNozzleRelatedData(
  id: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission(["ADMINISTRATOR"]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const nozzle = await prisma.nozzle.findUnique({
      where: { id },
      include: {
        nozzleReadings: {
          select: { id: true },
        },
      },
    });

    if (!nozzle) {
      return { success: false, message: "Nozzle tidak ditemukan" };
    }

    if (nozzle.deletedAt) {
      return { success: false, message: "Nozzle sudah dihapus sebelumnya" };
    }

    const nozzleReadingCount = nozzle.nozzleReadings.length;

    const pendingShifts = await prisma.operatorShift.count({
      where: {
        stationId: nozzle.stationId,
        status: "PENDING",
        nozzleReadings: {
          some: {
            nozzleId: id,
          },
        },
      },
    });

    const pendingDeposits = await prisma.deposit.count({
      where: {
        status: "PENDING",
        operatorShift: {
          nozzleReadings: {
            some: {
              nozzleId: id,
            },
          },
        },
      },
    });

    const completedShifts = await prisma.operatorShift.count({
      where: {
        stationId: nozzle.stationId,
        status: "COMPLETED",
        nozzleReadings: {
          some: {
            nozzleId: id,
          },
        },
      },
    });

    const hasImportantData =
      nozzleReadingCount > 0 || pendingShifts > 0 || pendingDeposits > 0;

    return {
      success: true,
      message: "Data terkait berhasil dicek",
      data: {
        hasImportantData,
        relatedData: {
          nozzleReadings: nozzleReadingCount,
          pendingShifts,
          pendingDeposits,
          completedShifts,
        },
      },
    };
  } catch (error) {
    console.error("Check nozzle related data error:", error);
    return { success: false, message: "Gagal mengecek data terkait" };
  }
}
