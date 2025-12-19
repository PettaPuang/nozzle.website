"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import { z } from "zod";
import { calculateTankStockByCalculation } from "@/lib/utils/tank-calculations";
import { todayRangeUTC, nowUTC } from "@/lib/utils/datetime";
import { createTitipanFillTransaction } from "@/lib/utils/transaction/transaction-titipan";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

// Validation schema untuk titipan fill
const createTitipanFillSchema = z.object({
  tankId: z.string().cuid(),
  titipanName: z.string().min(1, "Pilih nama titipan"),
  literAmount: z.coerce.number().min(1, "Volume harus lebih dari 0"),
  invoiceNumber: z.string().optional(),
  imageUrl: z.union([z.string(), z.array(z.string())]).optional(),
  notes: z.string().optional(),
});

/**
 * Create Titipan Fill - Input isi tank dari titipan
 * Status: PENDING (perlu approval manager, sama seperti unload)
 * Journal entry dibuat saat approve
 */
export async function createTitipanFill(
  input: z.infer<typeof createTitipanFillSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (sama seperti unloader)
    const { authorized, user, message } = await checkPermission([
      "UNLOADER",
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createTitipanFillSchema.parse(input);

    // 2.1. Normalize imageUrl: convert array to string (join with comma)
    const imageUrl = Array.isArray(validated.imageUrl)
      ? validated.imageUrl.join(",")
      : validated.imageUrl;

    // 3. Get tank dengan product dan gas station
    const tank = await prisma.tank.findUnique({
      where: { id: validated.tankId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
          },
        },
        gasStation: {
          select: {
            id: true,
            hasTitipan: true,
            titipanNames: true,
          },
        },
      },
    });

    if (!tank) {
      return { success: false, message: "Tank tidak ditemukan" };
    }

    // 4. Validasi gas station hasTitipan
    if (!tank.gasStation.hasTitipan) {
      return {
        success: false,
        message: "Fitur titipan tidak diaktifkan untuk gas station ini",
      };
    }

    // 5. Validasi nama titipan: cek apakah COA "Titipan [nama]" ada
    // titipanName dari form sudah dalam format display name (tanpa prefix "Titipan")
    const fullTitipanCOAName = `Titipan ${validated.titipanName}`;
    const titipanCOA = await prisma.cOA.findUnique({
      where: {
        gasStationId_name: {
          gasStationId: tank.gasStation.id,
          name: fullTitipanCOAName,
        },
      },
    });

    if (!titipanCOA || titipanCOA.status !== "ACTIVE") {
      return {
        success: false,
        message: `Nama titipan "${validated.titipanName}" tidak terdaftar atau tidak aktif`,
      };
    }

    // 6. Check permission untuk gas station
    const { authorized: gasStationAuth } =
      await checkPermissionWithGasStation(
        ["UNLOADER", "ADMINISTRATOR", "DEVELOPER"],
        tank.gasStation.id
      );
    if (!gasStationAuth) {
      return {
        success: false,
        message: "Anda tidak memiliki akses ke gas station ini",
      };
    }

    // 7. Check tank capacity
    // Gunakan service untuk get current stock
    const { OperationalService } = await import(
      "@/lib/services/operational.service"
    );
    const currentStock = await OperationalService.getCurrentStock(
      validated.tankId
    );

    // Calculate new total after adding literAmount
    const newTotal = calculateTankStockByCalculation({
      stockOpen: currentStock,
      unloads: validated.literAmount,
      sales: 0,
    });

    // Check capacity
    if (newTotal > tank.capacity) {
      return {
        success: false,
        message: `Kapasitas tank tidak cukup. Isi sekarang: ${currentStock}L, Kapasitas: ${tank.capacity}L, Sisa ruang: ${
          tank.capacity - currentStock
        }L`,
      };
    }

    // 8. Create Unload record dengan status PENDING (perlu approval manager)
    const result = await prisma.$transaction(async (tx) => {
      // 8.1. Create Unload record
      const unload = await tx.unload.create({
        data: {
          tankId: validated.tankId,
          unloaderId: user!.id,
          managerId: null, // Belum di-approve
          purchaseTransactionId: null, // Titipan tidak terkait dengan purchase transaction
          initialOrderVolume: null,
          deliveredVolume: null, // Tidak ada delivered volume untuk titipan
          literAmount: validated.literAmount,
          invoiceNumber: validated.invoiceNumber || null,
          imageUrl: imageUrl || null,
          status: "PENDING", // PENDING - perlu approval manager
          notes: `Isi titipan dari ${validated.titipanName}. ${
            validated.notes || ""
          }`.trim(),
          createdById: user!.id,
          createdAt: nowUTC(),
          updatedById: user!.id,
          updatedAt: nowUTC(),
        },
      });

      // 8.2. TIDAK update tank currentStock (hanya update saat approve)
      // 8.3. TIDAK create transaction (hanya create saat approve)

      return { unload };
    });

    // 9. Cache invalidation
    revalidatePath("/gas-stations");
    revalidatePath(`/gas-stations/${tank.gasStation.id}`);

    return {
      success: true,
      message: `Isi titipan berhasil disimpan (menunggu approval manager). ${validated.literAmount}L ${tank.product.name} dari ${validated.titipanName}.`,
      data: result,
    };
  } catch (error) {
    console.error("Create Titipan Fill error:", error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Validasi gagal",
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menyimpan isi titipan",
    };
  }
}

