"use server";

import { prisma } from "@/lib/prisma";
import {
  createTankSchema,
  updateTankSchema,
} from "@/lib/validations/infrastructure.validation";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import {
  findOrCreateInventoryCOA,
  findOrCreateRevenueCOAForProduct,
  findOrCreateCOGSCOA,
  findOrCreateShrinkageCOA,
  findOrCreateEquityCOA,
} from "@/lib/utils/coa.utils";
import { nowUTC } from "@/lib/utils/datetime";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createTank(
  input: z.infer<typeof createTankSchema>
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
    const validated = createTankSchema.parse(input);

    // 3. Get product to get purchasePrice for opening balance calculation
    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
      select: { id: true, name: true, purchasePrice: true },
    });

    if (!product) {
      return { success: false, message: "Product not found" };
    }

    // 4. Database + Audit trail - Create tank, COAs, and journal entry in transaction
    await prisma.$transaction(async (tx) => {
      // Create tank
      const tank = await tx.tank.create({
        data: {
          gasStation: {
            connect: { id: validated.gasStationId },
          },
          product: {
            connect: { id: validated.productId },
          },
          capacity: validated.capacity,
          initialStock: validated.initialStock || 0,
          code: validated.code,
          name: validated.name,
          createdBy: { connect: { id: user!.id } },
        },
      });

      // 5. COA sudah dibuat saat create product, cukup find/reuse
      const inventoryCOA = await findOrCreateInventoryCOA(
        validated.gasStationId,
        product.name,
        user!.id,
        tx
      );
      await findOrCreateRevenueCOAForProduct(
        validated.gasStationId,
        product.name,
        user!.id,
        tx
      );
      await findOrCreateCOGSCOA(
        validated.gasStationId,
        product.name,
        user!.id,
        tx
      );
      await findOrCreateShrinkageCOA(
        validated.gasStationId,
        product.name,
        user!.id,
        tx
      );

      // 6. Jika ada initialStock > 0, buat Transaction + JournalEntry
      if (validated.initialStock && validated.initialStock > 0) {
        // Langsung gunakan purchasePrice dari Product yang sudah di-query (sudah sesuai dengan gasStationId)
        const purchasePrice = product.purchasePrice;
        const totalValue = validated.initialStock * purchasePrice;

        // Reuse inventoryCOA yang sudah dibuat di atas
        const equityCOA = await findOrCreateEquityCOA(
          validated.gasStationId,
          user!.id,
          "Modal Awal",
          tx
        );

        // Create Transaction (header)
        const transaction = await (tx as any).transaction.create({
          data: {
            gasStationId: validated.gasStationId,
            date: nowUTC(),
            description: `Stock awal tank ${validated.code} - ${validated.name}`,
            notes: `Otomatis dibuat saat pembuatan tank. Stock: ${
              validated.initialStock
            } L x Rp ${purchasePrice.toLocaleString(
              "id-ID"
            )} = Rp ${totalValue.toLocaleString("id-ID")}`,
            transactionType: "ADJUSTMENT",
            approvalStatus: "APPROVED",
            approverId: null, // Auto-approved, tidak perlu approverId
            createdById: user!.id,
          },
        });

        // Create JournalEntry (detail) - Double entry
        // Debit: Inventory COA
        await (tx as any).journalEntry.create({
          data: {
            transactionId: transaction.id,
            coaId: inventoryCOA.id,
            debit: totalValue,
            credit: 0,
            description: `Stock awal tank ${validated.code}`,
            createdById: user!.id,
          },
        });

        // Credit: Equity COA
        await (tx as any).journalEntry.create({
          data: {
            transactionId: transaction.id,
            coaId: equityCOA.id,
            debit: 0,
            credit: totalValue,
            description: `Modal untuk stock awal tank ${validated.code}`,
            createdById: user!.id,
          },
        });
      }
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return { success: true, message: "Tank created successfully" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to create tank" };
  }
}

/**
 * Check if tank has operational activity (unload or sales)
 * Exported untuk digunakan di client component
 */
export async function hasTankActivity(tankId: string): Promise<boolean> {
  // Check if tank has any unloads
  const unloadCount = await prisma.unload.count({
    where: { tankId },
  });

  if (unloadCount > 0) {
    return true;
  }

  // Check if tank has any sales (completed shifts with nozzle readings for this tank)
  const hasSales = await prisma.operatorShift.findFirst({
    where: {
      status: "COMPLETED",
      nozzleReadings: {
        some: {
          nozzle: {
            tankId,
          },
        },
      },
    },
  });

  return !!hasSales;
}

export async function updateTank(
  id: string,
  input: z.infer<typeof updateTankSchema>
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
    const validated = updateTankSchema.parse(input);

    // 3. Get tank data untuk cek initialStock lama dan product info
    const tank = await prisma.tank.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        initialStock: true,
        gasStationId: true,
        product: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
          },
        },
      },
    });

    if (!tank) {
      return { success: false, message: "Tank not found" };
    }

    // 4. Check if initialStock is being changed
    const isInitialStockChanged =
      validated.initialStock !== undefined &&
      validated.initialStock !== tank.initialStock;

    // 5. If initialStock changed, check if tank has activity
    if (isInitialStockChanged) {
      const hasActivity = await hasTankActivity(id);
      if (hasActivity) {
        return {
          success: false,
          message:
            "Initial stock tidak bisa diubah karena tank sudah memiliki aktivitas unload atau sales",
        };
      }
    }

    // 6. Database + Audit trail + Auto transaction untuk initialStock change
    await prisma.$transaction(async (tx) => {
      // Update tank
      await tx.tank.update({
        where: { id },
        data: {
          ...(validated.productId && {
            product: { connect: { id: validated.productId } },
          }),
          ...(validated.capacity !== undefined && {
            capacity: validated.capacity,
          }),
          ...(validated.initialStock !== undefined && {
            initialStock: validated.initialStock,
          }),
          ...(validated.code && { code: validated.code }),
          ...(validated.name && { name: validated.name }),
          updatedBy: { connect: { id: user!.id } },
          updatedAt: nowUTC(),
        },
      });

      // 7. Jika initialStock berubah, buat adjustment transaction
      if (isInitialStockChanged) {
        const oldInitialStock = tank.initialStock || 0;
        const newInitialStock = validated.initialStock || 0;
        const stockDifference = newInitialStock - oldInitialStock;

        if (stockDifference !== 0) {
          const purchasePrice = Number(tank.product.purchasePrice);
          const adjustmentValue = stockDifference * purchasePrice;

          // Get COAs
          const inventoryCOA = await findOrCreateInventoryCOA(
            tank.gasStationId,
            tank.product.name,
            user!.id
          );
          const equityCOA = await findOrCreateEquityCOA(
            tank.gasStationId,
            user!.id
          );

          // Create Transaction (header)
          const transaction = await (tx as any).transaction.create({
            data: {
              gasStationId: tank.gasStationId,
              date: nowUTC(),
              description: `Penyesuaian stock awal tank ${tank.code} - ${tank.name}`,
              notes: `Otomatis dibuat saat edit tank. Stock awal: ${oldInitialStock} L → ${newInitialStock} L. Selisih: ${
                stockDifference > 0 ? "+" : ""
              }${stockDifference} L x Rp ${purchasePrice.toLocaleString(
                "id-ID"
              )} = Rp ${Math.abs(adjustmentValue).toLocaleString("id-ID")}`,
              transactionType: "ADJUSTMENT",
              approvalStatus: "APPROVED",
              approverId: null, // Auto-approved
              createdById: user!.id,
            },
          });

          // Create JournalEntry (detail) - Double entry
          if (stockDifference > 0) {
            // Stock naik: Debit Inventory, Credit Equity
            await (tx as any).journalEntry.create({
              data: {
                transactionId: transaction.id,
                coaId: inventoryCOA.id,
                debit: adjustmentValue,
                credit: 0,
                description: `Penyesuaian stock awal tank ${tank.code} (+${stockDifference} L)`,
                createdById: user!.id,
              },
            });
            await (tx as any).journalEntry.create({
              data: {
                transactionId: transaction.id,
                coaId: equityCOA.id,
                debit: 0,
                credit: adjustmentValue,
                description: `Modal untuk penyesuaian stock awal tank ${tank.code}`,
                createdById: user!.id,
              },
            });
          } else {
            // Stock turun: Debit Equity, Credit Inventory
            await (tx as any).journalEntry.create({
              data: {
                transactionId: transaction.id,
                coaId: equityCOA.id,
                debit: Math.abs(adjustmentValue),
                credit: 0,
                description: `Penyesuaian stock awal tank ${tank.code} (${stockDifference} L)`,
                createdById: user!.id,
              },
            });
            await (tx as any).journalEntry.create({
              data: {
                transactionId: transaction.id,
                coaId: inventoryCOA.id,
                debit: 0,
                credit: Math.abs(adjustmentValue),
                description: `Pengurangan stock awal tank ${
                  tank.code
                } (${Math.abs(stockDifference)} L)`,
                createdById: user!.id,
              },
            });
          }
        }
      }
    });

    // 8. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${tank.gasStationId}`);
    return { success: true, message: "Tank updated successfully" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to update tank" };
  }
}

export async function deleteTank(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. VALIDASI PREVENTIF: Cek data terkait sebelum delete
    const tank = await prisma.tank.findUnique({
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
        unloads: {
          select: {
            id: true,
            literAmount: true,
            status: true,
          },
        },
        tankReadings: {
          select: { id: true },
          take: 1, // Hanya perlu cek apakah ada
        },
        gasStation: {
          select: {
            id: true,
            name: true,
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

    if (!tank) {
      return { success: false, message: "Tank tidak ditemukan" };
    }

    // 3. VALIDASI: Cek apakah ada data terkait yang akan ikut terhapus
    const nozzleCount = tank.nozzles?.length || 0;
    const unloadCount = tank.unloads?.length || 0;
    const hasTankReadings = (tank.tankReadings?.length || 0) > 0;
    const hasNozzleReadings = (tank.nozzles || []).some(
      (n: { nozzleReadings: { id: string }[] }) => n.nozzleReadings.length > 0
    );

    // 4. BLOCK DELETE jika ada data terkait yang penting
    const hasImportantData =
      nozzleCount > 0 ||
      unloadCount > 0 ||
      hasTankReadings ||
      hasNozzleReadings;

    if (hasImportantData) {
      // Log warning dengan detail lengkap
      console.error(
        `[DELETE TANK BLOCKED] Tank "${tank.name}" (Code: ${tank.code}, ID: ${id}) TIDAK BISA DIHAPUS karena memiliki data terkait:\n` +
          `  - ${nozzleCount} Nozzle(s): ${(tank.nozzles || [])
            .map((n: { name: string; code: string }) => `${n.name} (${n.code})`)
            .join(", ")}\n` +
          `  - ${unloadCount} Unload(s): ${(tank.unloads || [])
            .map(
              (u: { id: string; literAmount: number; status: string }) =>
                `ID ${u.id} (${u.literAmount}L, ${u.status})`
            )
            .join(", ")}\n` +
          `  - ${hasTankReadings ? "Ada" : "Tidak ada"} TankReading\n` +
          `  - ${hasNozzleReadings ? "Ada" : "Tidak ada"} NozzleReading\n` +
          `  User: ${user?.username || "Unknown"} (ID: ${
            user?.id || "Unknown"
          })\n` +
          `  GasStation: ${tank.gasStation?.name || "Unknown"} (ID: ${
            tank.gasStation?.id || "Unknown"
          })\n` +
          `  Product: ${tank.product?.name || "Unknown"} (ID: ${
            tank.product?.id || "Unknown"
          })\n` +
          `\n⚠️  PENGHAPUSAN DIBLOKIR untuk mencegah cascade delete yang tidak disengaja.\n` +
          `   Jika benar-benar perlu menghapus, hapus data terkait terlebih dahulu atau hubungi developer.`
      );

      return {
        success: false,
        message:
          `Tank "${tank.name}" (${tank.code}) tidak dapat dihapus karena memiliki data terkait yang akan ikut terhapus:\n` +
          `- ${nozzleCount} Nozzle\n` +
          `- ${unloadCount} Unload\n` +
          `${hasTankReadings ? "- TankReading\n" : ""}` +
          `${hasNozzleReadings ? "- NozzleReading\n" : ""}` +
          `\n⚠️ Penghapusan diblokir untuk mencegah kehilangan data. Hapus data terkait terlebih dahulu jika benar-benar perlu menghapus Tank ini.`,
        data: {
          tankId: id,
          tankName: tank.name,
          tankCode: tank.code,
          relatedData: {
            nozzles: nozzleCount,
            unloads: unloadCount,
            hasTankReadings,
            hasNozzleReadings,
          },
        },
      };
    }

    // 5. Jika tidak ada data terkait, baru boleh delete
    await prisma.tank.delete({
      where: { id },
    });

    console.log(
      `[DELETE TANK] Tank "${tank.name}" (Code: ${
        tank.code
      }, ID: ${id}) berhasil dihapus oleh ${user?.username || "Unknown"}`
    );

    // 6. Cache invalidation
    revalidatePath("/admin");
    return {
      success: true,
      message: `Tank "${tank.name}" berhasil dihapus`,
    };
  } catch (error) {
    console.error(`[DELETE TANK] Error deleting tank ${id}:`, error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menghapus tank. Pastikan tidak ada data terkait.",
    };
  }
}

/**
 * Check related data before deletion (untuk preview di dialog)
 */
export async function checkTankRelatedData(id: string): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission(["ADMINISTRATOR"]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const tank = await prisma.tank.findUnique({
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
        unloads: {
          select: {
            id: true,
            literAmount: true,
            status: true,
          },
        },
        tankReadings: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!tank) {
      return { success: false, message: "Tank tidak ditemukan" };
    }

    const nozzleCount = tank.nozzles?.length || 0;
    const unloadCount = tank.unloads?.length || 0;
    const hasTankReadings = (tank.tankReadings?.length || 0) > 0;
    const hasNozzleReadings = (tank.nozzles || []).some(
      (n: { nozzleReadings: { id: string }[] }) => n.nozzleReadings.length > 0
    );

    const hasImportantData =
      nozzleCount > 0 ||
      unloadCount > 0 ||
      hasTankReadings ||
      hasNozzleReadings;

    return {
      success: true,
      message: "Data terkait berhasil dicek",
      data: {
        hasImportantData,
        relatedData: {
          nozzles: nozzleCount,
          unloads: unloadCount,
          hasTankReadings,
          hasNozzleReadings,
        },
      },
    };
  } catch (error) {
    console.error("Check tank related data error:", error);
    return { success: false, message: "Gagal mengecek data terkait" };
  }
}

export async function getTanks(gasStationId: string) {
  try {
    // OWNER_GROUP, ADMINISTRATOR, DEVELOPER bisa akses tanks
    // ADMINISTRATOR hanya bisa akses tanks dari gas station milik ownernya
    const { authorized } = await checkPermissionWithGasStation(
      ["DEVELOPER", "ADMINISTRATOR", "OWNER_GROUP", "FINANCE", "MANAGER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const tanks = await prisma.tank.findMany({
      where: {
        gasStationId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return {
      success: true,
      data: tanks.map((tank) => ({
        id: tank.id,
        name: tank.name,
        code: tank.code,
        product: {
          id: tank.product.id,
          name: tank.product.name,
          purchasePrice: Number(tank.product.purchasePrice),
        },
      })),
    };
  } catch (error) {
    console.error("Get tanks error:", error);
    return { success: false, message: "Gagal mengambil data tank", data: [] };
  }
}
