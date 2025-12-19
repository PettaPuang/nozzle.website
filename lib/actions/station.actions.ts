"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  createStationSchema,
  updateStationSchema,
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

export async function createStation(
  input: z.infer<typeof createStationSchema>
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
    const validated = createStationSchema.parse(input);

    // 3. Check if station code already exists in this gas station
    const existingStation = await prisma.station.findFirst({
      where: {
        gasStationId: validated.gasStationId,
        code: validated.code,
      },
    });

    if (existingStation) {
      return {
        success: false,
        message: "Kode station sudah digunakan",
      };
    }

    // 4. Database + Audit trail
    await prisma.station.create({
      data: {
        gasStation: {
          connect: { id: validated.gasStationId },
        },
        code: validated.code,
        name: validated.name,
        tankConnections: {
          create: validated.tankIds.map((tankId) => ({
            tank: { connect: { id: tankId } },
            createdBy: { connect: { id: user!.id } },
          })),
        },
        createdBy: { connect: { id: user!.id } },
      },
    });

    // 5. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return { success: true, message: "Station berhasil dibuat" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create station error:", error);
    return { success: false, message: "Gagal membuat station" };
  }
}

export async function updateStation(
  id: string,
  input: z.infer<typeof updateStationSchema>
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
    const validated = updateStationSchema.parse(input);

    // 3. Check if code already exists (if updating code)
    if (validated.code) {
      const existingStation = await prisma.station.findFirst({
        where: {
          code: validated.code,
          id: { not: id },
          ...(validated.gasStationId && {
            gasStationId: validated.gasStationId,
          }),
        },
      });

      if (existingStation) {
        return {
          success: false,
          message: "Kode station sudah digunakan",
        };
      }
    }

    // 4. Database + Audit trail
    await prisma.station.update({
      where: { id },
      data: {
        ...(validated.gasStationId && {
          gasStation: { connect: { id: validated.gasStationId } },
        }),
        ...(validated.code && { code: validated.code }),
        ...(validated.name && { name: validated.name }),
        ...(validated.tankIds && {
          tankConnections: {
            deleteMany: {},
            create: validated.tankIds.map((tankId) => ({
              tank: { connect: { id: tankId } },
              createdBy: { connect: { id: user!.id } },
            })),
          },
        }),
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 5. Cache invalidation
    revalidatePath("/admin");
    if (validated.gasStationId) {
      revalidatePath(`/gas-stations/${validated.gasStationId}`);
    }
    return { success: true, message: "Station berhasil diupdate" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Update station error:", error);
    return { success: false, message: "Gagal update station" };
  }
}

export async function deleteStation(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. VALIDASI PREVENTIF: Cek data terkait sebelum delete
    const station = await prisma.station.findUnique({
      where: { id },
      include: {
        nozzles: {
          select: {
            id: true,
            name: true,
            code: true,
            nozzleReadings: {
              select: { id: true },
              take: 1, // Hanya perlu cek apakah ada
            },
          },
        },
        operatorShifts: {
          select: { id: true },
          take: 1, // Hanya perlu cek apakah ada
        },
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!station) {
      return { success: false, message: "Station tidak ditemukan" };
    }

    // 3. VALIDASI: Cek apakah ada data terkait yang akan ikut terhapus
    const nozzleCount = station.nozzles.length;
    const hasOperatorShifts = station.operatorShifts.length > 0;
    const hasNozzleReadings = station.nozzles.some(
      (n) => n.nozzleReadings.length > 0
    );

    // 4. BLOCK DELETE jika ada data terkait yang penting
    const hasImportantData =
      nozzleCount > 0 || hasOperatorShifts || hasNozzleReadings;

    if (hasImportantData) {
      // Log warning dengan detail lengkap
      console.error(
        `[DELETE STATION BLOCKED] Station "${station.name}" (Code: ${station.code}, ID: ${id}) TIDAK BISA DIHAPUS karena memiliki data terkait:\n` +
          `  - ${nozzleCount} Nozzle(s): ${station.nozzles
            .map((n) => `${n.name} (${n.code})`)
            .join(", ")}\n` +
          `  - ${hasOperatorShifts ? "Ada" : "Tidak ada"} OperatorShift\n` +
          `  - ${hasNozzleReadings ? "Ada" : "Tidak ada"} NozzleReading\n` +
          `  User: ${user?.username || "Unknown"} (ID: ${
            user?.id || "Unknown"
          })\n` +
          `  GasStation: ${station.gasStation.name} (ID: ${station.gasStation.id})\n` +
          `\n⚠️  PENGHAPUSAN DIBLOKIR untuk mencegah cascade delete yang tidak disengaja.\n` +
          `   Jika benar-benar perlu menghapus, hapus data terkait terlebih dahulu atau hubungi developer.`
      );

      return {
        success: false,
        message:
          `Station "${station.name}" (${station.code}) tidak dapat dihapus karena memiliki data terkait yang akan ikut terhapus:\n` +
          `- ${nozzleCount} Nozzle\n` +
          `${hasOperatorShifts ? "- OperatorShift\n" : ""}` +
          `${hasNozzleReadings ? "- NozzleReading\n" : ""}` +
          `\n⚠️ Penghapusan diblokir untuk mencegah kehilangan data. Hapus data terkait terlebih dahulu jika benar-benar perlu menghapus Station ini.`,
        data: {
          stationId: id,
          stationName: station.name,
          stationCode: station.code,
          relatedData: {
            nozzles: nozzleCount,
            hasOperatorShifts,
            hasNozzleReadings,
          },
        },
      };
    }

    // 5. Jika tidak ada data terkait, baru boleh delete
    await prisma.station.delete({
      where: { id },
    });

    console.log(
      `[DELETE STATION] Station "${station.name}" (Code: ${
        station.code
      }, ID: ${id}) berhasil dihapus oleh ${user?.username || "Unknown"}`
    );

    // 6. Cache invalidation
    revalidatePath("/admin");
    return {
      success: true,
      message: `Station "${station.name}" berhasil dihapus`,
    };
  } catch (error) {
    console.error(`[DELETE STATION] Error deleting station ${id}:`, error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menghapus station. Pastikan tidak ada data terkait.",
    };
  }
}

/**
 * Check related data before deletion (untuk preview di dialog)
 */
export async function checkStationRelatedData(
  id: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission(["ADMINISTRATOR"]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const station = await prisma.station.findUnique({
      where: { id },
      include: {
        nozzles: {
          select: {
            id: true,
            name: true,
            code: true,
            nozzleReadings: {
              select: { id: true },
              take: 1,
            },
          },
        },
        operatorShifts: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!station) {
      return { success: false, message: "Station tidak ditemukan" };
    }

    const nozzleCount = station.nozzles.length;
    const hasOperatorShifts = station.operatorShifts.length > 0;
    const hasNozzleReadings = station.nozzles.some(
      (n) => n.nozzleReadings.length > 0
    );

    const hasImportantData =
      nozzleCount > 0 || hasOperatorShifts || hasNozzleReadings;

    return {
      success: true,
      message: "Data terkait berhasil dicek",
      data: {
        hasImportantData,
        relatedData: {
          nozzles: nozzleCount,
          hasOperatorShifts,
          hasNozzleReadings,
        },
      },
    };
  } catch (error) {
    console.error("Check station related data error:", error);
    return { success: false, message: "Gagal mengecek data terkait" };
  }
}
