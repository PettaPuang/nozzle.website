"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import { findOrCreateTankReadingShrinkageCOA } from "@/lib/utils/coa.utils";

/**
 * Migrate journal entries from old shrinkage COAs (Susut {productName}) to "Biaya Susut Tank Reading"
 * Then deactivate the old COAs
 */
export async function migrateOldShrinkageCOAs(): Promise<{
  success: boolean;
  message: string;
  migratedCount?: number;
  deactivatedCount?: number;
  details?: Array<{
    oldCOAName: string;
    gasStationId: string;
    journalEntriesCount: number;
  }>;
}> {
  try {
    // Cari semua COA dengan nama yang dimulai dengan "Susut " dan status ACTIVE
    const oldShrinkageCOAs = await prisma.cOA.findMany({
      where: {
        name: {
          startsWith: "Susut ",
        },
        status: "ACTIVE",
        category: "COGS", // Hanya yang kategori COGS (yang lama)
      },
      include: {
        journalEntries: {
          select: {
            id: true,
          },
        },
        gasStation: {
          select: {
            name: true,
            owner: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (oldShrinkageCOAs.length === 0) {
      return {
        success: true,
        message: "No old shrinkage COAs found. Nothing to migrate.",
        migratedCount: 0,
        deactivatedCount: 0,
      };
    }

    const details: Array<{
      oldCOAName: string;
      gasStationId: string;
      journalEntriesCount: number;
    }> = [];

    // Group by gasStationId untuk mendapatkan COA baru per gas station
    const gasStationIds = new Set(
      oldShrinkageCOAs.map((coa) => coa.gasStationId)
    );
    const newCOAMap = new Map<string, string>(); // gasStationId -> newCOAId

    // Buat atau dapatkan COA baru "Biaya Susut Tank Reading" untuk setiap gas station
    for (const gasStationId of gasStationIds) {
      const gasStation = oldShrinkageCOAs.find(
        (coa) => coa.gasStationId === gasStationId
      )?.gasStation;
      const createdById = gasStation?.owner?.id || gasStationId; // Fallback jika tidak ada owner

      const newShrinkageCOA = await findOrCreateTankReadingShrinkageCOA(
        gasStationId,
        createdById
      );
      newCOAMap.set(gasStationId, newShrinkageCOA.id);
    }

    let migratedCount = 0;

    // Update semua journal entries yang menggunakan COA lama
    for (const oldCOA of oldShrinkageCOAs) {
      const newCOAId = newCOAMap.get(oldCOA.gasStationId);
      if (!newCOAId) {
        console.warn(
          `New COA not found for gas station ${oldCOA.gasStationId}, skipping...`
        );
        continue;
      }

      // Update semua journal entries yang menggunakan COA lama
      const updateResult = await prisma.journalEntry.updateMany({
        where: {
          coaId: oldCOA.id,
        },
        data: {
          coaId: newCOAId,
        },
      });

      if (updateResult.count > 0) {
        migratedCount += updateResult.count;
        details.push({
          oldCOAName: oldCOA.name,
          gasStationId: oldCOA.gasStationId,
          journalEntriesCount: updateResult.count,
        });
      }
    }

    // Setelah migrasi, nonaktifkan semua COA lama
    const updateResult = await prisma.cOA.updateMany({
      where: {
        id: {
          in: oldShrinkageCOAs.map((coa) => coa.id),
        },
      },
      data: {
        status: "INACTIVE",
        updatedAt: nowUTC(),
      },
    });

    const deactivatedCount = updateResult.count;

    return {
      success: true,
      message: `Successfully migrated ${migratedCount} journal entries and deactivated ${deactivatedCount} old shrinkage COAs.`,
      migratedCount,
      deactivatedCount,
      details,
    };
  } catch (error) {
    console.error("Error migrating old shrinkage COAs:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to migrate old shrinkage COAs",
    };
  }
}

/**
 * Deactivate old shrinkage COAs (Susut {productName})
 * These COAs are replaced by "Biaya Susut Tank Reading"
 * @deprecated Use migrateOldShrinkageCOAs() instead to migrate balances first
 */
export async function deactivateOldShrinkageCOAs(): Promise<{
  success: boolean;
  message: string;
  deactivatedCount?: number;
  details?: Array<{
    name: string;
    gasStationId: string;
    journalEntriesCount: number;
  }>;
}> {
  try {
    // Cari semua COA dengan nama yang dimulai dengan "Susut " dan status ACTIVE
    const oldShrinkageCOAs = await prisma.cOA.findMany({
      where: {
        name: {
          startsWith: "Susut ",
        },
        status: "ACTIVE",
        category: "COGS", // Hanya yang kategori COGS (yang lama)
      },
      include: {
        journalEntries: {
          select: {
            id: true,
          },
        },
        gasStation: {
          select: {
            name: true,
          },
        },
      },
    });

    if (oldShrinkageCOAs.length === 0) {
      return {
        success: true,
        message: "No old shrinkage COAs found. Nothing to deactivate.",
        deactivatedCount: 0,
      };
    }

    // Nonaktifkan semua COA
    const updateResult = await prisma.cOA.updateMany({
      where: {
        id: {
          in: oldShrinkageCOAs.map((coa) => coa.id),
        },
      },
      data: {
        status: "INACTIVE",
        updatedAt: nowUTC(),
      },
    });

    const details = oldShrinkageCOAs.map((coa) => ({
      name: coa.name,
      gasStationId: coa.gasStationId,
      journalEntriesCount: coa.journalEntries.length,
    }));

    return {
      success: true,
      message: `Successfully deactivated ${updateResult.count} old shrinkage COAs.`,
      deactivatedCount: updateResult.count,
      details,
    };
  } catch (error) {
    console.error("Error deactivating old shrinkage COAs:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to deactivate old shrinkage COAs",
    };
  }
}

/**
 * Migrate journal entries dari "Biaya Susut Tank Reading" ke COA adjustment yang tepat
 * - Debit -> "Beban Penyesuaian Persediaan"
 * - Credit -> "Pendapatan Penyesuaian Persediaan"
 */
export async function migrateTankReadingShrinkageCOAs(): Promise<{
  success: boolean;
  message: string;
  migratedDebitCount?: number;
  migratedCreditCount?: number;
  details?: Array<{
    gasStationId: string;
    gasStationName: string;
    debitEntries: number;
    creditEntries: number;
  }>;
}> {
  try {
    // Cari semua COA "Biaya Susut Tank Reading"
    const tankReadingShrinkageCOAs = await prisma.cOA.findMany({
      where: {
        name: "Biaya Susut Tank Reading",
        status: "ACTIVE",
      },
      include: {
        journalEntries: true,
        gasStation: {
          select: {
            name: true,
            owner: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (tankReadingShrinkageCOAs.length === 0) {
      return {
        success: true,
        message:
          'No "Biaya Susut Tank Reading" COAs found. Nothing to migrate.',
        migratedDebitCount: 0,
        migratedCreditCount: 0,
      };
    }

    const details: Array<{
      gasStationId: string;
      gasStationName: string;
      debitEntries: number;
      creditEntries: number;
    }> = [];

    let totalDebitMigrated = 0;
    let totalCreditMigrated = 0;

    // Process setiap gas station
    for (const coa of tankReadingShrinkageCOAs) {
      const gasStationId = coa.gasStationId;
      const createdById = coa.gasStation.owner?.id || gasStationId;

      // Get atau create COA baru
      const expenseCOA = await prisma.cOA.upsert({
        where: {
          gasStationId_name: {
            gasStationId,
            name: "Beban Penyesuaian Persediaan",
          },
        },
        create: {
          gasStationId,
          name: "Beban Penyesuaian Persediaan",
          category: "EXPENSE",
          description:
            "Beban dari penyesuaian nilai persediaan akibat penurunan harga beli produk atau loss tank reading",
          status: "ACTIVE",
          createdById,
        },
        update: {},
      });

      const incomeCOA = await prisma.cOA.upsert({
        where: {
          gasStationId_name: {
            gasStationId,
            name: "Pendapatan Penyesuaian Persediaan",
          },
        },
        create: {
          gasStationId,
          name: "Pendapatan Penyesuaian Persediaan",
          category: "REVENUE",
          description:
            "Pendapatan dari penyesuaian nilai persediaan akibat kenaikan harga beli produk atau profit tank reading",
          status: "ACTIVE",
          createdById,
        },
        update: {},
      });

      // Pisahkan journal entries berdasarkan debit/credit
      const debitEntries = coa.journalEntries.filter((je) => je.debit > 0);
      const creditEntries = coa.journalEntries.filter((je) => je.credit > 0);

      // Migrate debit entries ke Beban Penyesuaian Persediaan
      if (debitEntries.length > 0) {
        await prisma.journalEntry.updateMany({
          where: {
            id: {
              in: debitEntries.map((je) => je.id),
            },
          },
          data: {
            coaId: expenseCOA.id,
          },
        });
        totalDebitMigrated += debitEntries.length;
      }

      // Migrate credit entries ke Pendapatan Penyesuaian Persediaan
      if (creditEntries.length > 0) {
        await prisma.journalEntry.updateMany({
          where: {
            id: {
              in: creditEntries.map((je) => je.id),
            },
          },
          data: {
            coaId: incomeCOA.id,
          },
        });
        totalCreditMigrated += creditEntries.length;
      }

      details.push({
        gasStationId,
        gasStationName: coa.gasStation.name,
        debitEntries: debitEntries.length,
        creditEntries: creditEntries.length,
      });
    }

    return {
      success: true,
      message: `Successfully migrated ${totalDebitMigrated} debit entries and ${totalCreditMigrated} credit entries from "Biaya Susut Tank Reading".`,
      migratedDebitCount: totalDebitMigrated,
      migratedCreditCount: totalCreditMigrated,
      details,
    };
  } catch (error) {
    console.error("Error migrating tank reading shrinkage COAs:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to migrate tank reading shrinkage COAs",
    };
  }
}

/**
 * Migrate journal entries dari "Penyesuaian Stock" ke COA adjustment yang tepat
 * - Debit -> "Beban Penyesuaian Persediaan"
 * - Credit -> "Pendapatan Penyesuaian Persediaan"
 */
export async function migrateStockAdjustmentCOAs(): Promise<{
  success: boolean;
  message: string;
  migratedDebitCount?: number;
  migratedCreditCount?: number;
  details?: Array<{
    gasStationId: string;
    gasStationName: string;
    debitEntries: number;
    creditEntries: number;
  }>;
}> {
  try {
    // Cari semua COA "Penyesuaian Stock"
    const stockAdjustmentCOAs = await prisma.cOA.findMany({
      where: {
        name: "Penyesuaian Stock",
        status: "ACTIVE",
      },
      include: {
        journalEntries: true,
        gasStation: {
          select: {
            name: true,
            owner: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (stockAdjustmentCOAs.length === 0) {
      return {
        success: true,
        message: 'No "Penyesuaian Stock" COAs found. Nothing to migrate.',
        migratedDebitCount: 0,
        migratedCreditCount: 0,
      };
    }

    const details: Array<{
      gasStationId: string;
      gasStationName: string;
      debitEntries: number;
      creditEntries: number;
    }> = [];

    let totalDebitMigrated = 0;
    let totalCreditMigrated = 0;

    // Process setiap gas station
    for (const coa of stockAdjustmentCOAs) {
      const gasStationId = coa.gasStationId;
      const createdById = coa.gasStation.owner?.id || gasStationId;

      // Get atau create COA baru
      const expenseCOA = await prisma.cOA.upsert({
        where: {
          gasStationId_name: {
            gasStationId,
            name: "Beban Penyesuaian Persediaan",
          },
        },
        create: {
          gasStationId,
          name: "Beban Penyesuaian Persediaan",
          category: "EXPENSE",
          description:
            "Beban dari penyesuaian nilai persediaan akibat penurunan harga beli produk atau loss tank reading",
          status: "ACTIVE",
          createdById,
        },
        update: {},
      });

      const incomeCOA = await prisma.cOA.upsert({
        where: {
          gasStationId_name: {
            gasStationId,
            name: "Pendapatan Penyesuaian Persediaan",
          },
        },
        create: {
          gasStationId,
          name: "Pendapatan Penyesuaian Persediaan",
          category: "REVENUE",
          description:
            "Pendapatan dari penyesuaian nilai persediaan akibat kenaikan harga beli produk atau profit tank reading",
          status: "ACTIVE",
          createdById,
        },
        update: {},
      });

      // Pisahkan journal entries berdasarkan debit/credit
      const debitEntries = coa.journalEntries.filter((je) => je.debit > 0);
      const creditEntries = coa.journalEntries.filter((je) => je.credit > 0);

      // Migrate debit entries ke Beban Penyesuaian Persediaan
      if (debitEntries.length > 0) {
        await prisma.journalEntry.updateMany({
          where: {
            id: {
              in: debitEntries.map((je) => je.id),
            },
          },
          data: {
            coaId: expenseCOA.id,
          },
        });
        totalDebitMigrated += debitEntries.length;
      }

      // Migrate credit entries ke Pendapatan Penyesuaian Persediaan
      if (creditEntries.length > 0) {
        await prisma.journalEntry.updateMany({
          where: {
            id: {
              in: creditEntries.map((je) => je.id),
            },
          },
          data: {
            coaId: incomeCOA.id,
          },
        });
        totalCreditMigrated += creditEntries.length;
      }

      details.push({
        gasStationId,
        gasStationName: coa.gasStation.name,
        debitEntries: debitEntries.length,
        creditEntries: creditEntries.length,
      });
    }

    return {
      success: true,
      message: `Successfully migrated ${totalDebitMigrated} debit entries and ${totalCreditMigrated} credit entries from "Penyesuaian Stock".`,
      migratedDebitCount: totalDebitMigrated,
      migratedCreditCount: totalCreditMigrated,
      details,
    };
  } catch (error) {
    console.error("Error migrating stock adjustment COAs:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to migrate stock adjustment COAs",
    };
  }
}
