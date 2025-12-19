"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
};

/**
 * Cek dan fix unload yang product-nya tidak match dengan tank
 * Hanya untuk DEVELOPER
 */
export async function checkAndFixUnloadProductMismatch(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan fix ini",
      };
    }

    // 2. Validasi gasStationId wajib
    if (!gasStationId || !gasStationId.trim()) {
      return {
        success: false,
        message: "Gas Station ID wajib diisi",
      };
    }

    // 3. Get semua unload APPROVED untuk gas station tertentu
    const whereClause: any = {
      status: "APPROVED",
      tank: {
        gasStationId: gasStationId.trim(),
      },
    };

    const approvedUnloads = await prisma.unload.findMany({
      where: whereClause,
      include: {
        tank: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            gasStation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        purchaseTransaction: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            journalEntries: {
              include: {
                coa: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const mismatches: Array<{
      unloadId: string;
      tankId: string;
      tankName: string;
      tankProduct: string;
      purchaseProduct: string | null;
      deliveredVolume: number | null;
      literAmount: number;
      createdAt: Date;
    }> = [];

    // 3. Cek setiap unload
    for (const unload of approvedUnloads) {
      // Cek apakah productId match (lebih reliable daripada product name)
      if (unload.purchaseTransaction) {
        const purchaseProductId = unload.purchaseTransaction.productId;

        // Jika purchase transaction punya productId, bandingkan langsung
        if (purchaseProductId && purchaseProductId !== unload.tank.productId) {
          mismatches.push({
            unloadId: unload.id,
            tankId: unload.tankId,
            tankName: unload.tank.name,
            tankProduct: unload.tank.product.name,
            purchaseProduct:
              unload.purchaseTransaction.product?.name || "Unknown",
            deliveredVolume: unload.deliveredVolume,
            literAmount: unload.literAmount,
            createdAt: unload.createdAt,
          });
        } else if (!purchaseProductId) {
          // Data lama yang belum di-migrate: log warning dan skip
          console.warn(
            `Purchase transaction ${unload.purchaseTransaction.id} tidak memiliki productId. Harus di-migrate terlebih dahulu.`
          );
        }
      }
    }

    return {
      success: true,
      message: `Ditemukan ${mismatches.length} unload dengan product mismatch`,
      data: {
        mismatches,
        total: mismatches.length,
      },
    };
  } catch (error) {
    console.error("Check unload product mismatch error:", error);
    return {
      success: false,
      message: "Gagal mengecek unload product mismatch",
    };
  }
}

/**
 * Fix unload yang product-nya tidak match dengan tank
 * Akan reject unload tersebut dan rollback transaksi yang terkait
 */
export async function fixUnloadProductMismatch(
  unloadId: string,
  rejectUnload: boolean = true
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya admin/developer)
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Get unload dengan relasi lengkap
    const unload = await prisma.unload.findUnique({
      where: { id: unloadId },
      include: {
        tank: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            gasStation: {
              select: {
                id: true,
              },
            },
          },
        },
        purchaseTransaction: {
          include: {
            journalEntries: {
              include: {
                coa: true,
              },
            },
          },
        },
      },
    });

    if (!unload) {
      return { success: false, message: "Unload tidak ditemukan" };
    }

    if (unload.status !== "APPROVED") {
      return {
        success: false,
        message: `Unload sudah berstatus ${unload.status}, tidak dapat di-fix`,
      };
    }

    // 3. Validasi product mismatch
    const tankProductName = unload.tank.product.name.trim().toLowerCase();
    let purchaseProductName: string | null = null;

    if (unload.purchaseTransaction) {
      const loProductCOA = unload.purchaseTransaction.journalEntries.find(
        (entry) => entry.coa.name.startsWith("LO ") && entry.debit > 0
      );

      if (loProductCOA) {
        purchaseProductName = loProductCOA.coa.name
          .replace("LO ", "")
          .trim()
          .toLowerCase();
      }
    }

    if (!purchaseProductName || purchaseProductName === tankProductName) {
      return {
        success: false,
        message: "Unload ini tidak memiliki product mismatch",
      };
    }

    // 4. Rollback: Reject unload dan rollback transaksi
    if (rejectUnload) {
      // Cari transaksi UNLOAD yang terkait SEBELUM masuk transaction (untuk optimasi)
      const unloadTransactions = await prisma.transaction.findMany({
        where: {
          transactionType: "UNLOAD",
          gasStationId: unload.tank.gasStation.id,
          OR: [
            {
              notes: {
                contains: unload.id,
              },
            },
            {
              description: {
                contains: `Unload ${unload.tank.product.name}`,
              },
            },
          ],
        },
        select: {
          id: true,
          notes: true,
          date: true,
        },
      });

      // Filter transaksi yang benar-benar terkait dengan unload ini
      const relatedTransactionIds = unloadTransactions
        .filter((unloadTransaction) => {
          const isRelated =
            unloadTransaction.notes?.includes(unload.id) ||
            Math.abs(
              unloadTransaction.date.getTime() - unload.createdAt.getTime()
            ) <
              24 * 60 * 60 * 1000; // Dalam 24 jam
          return isRelated;
        })
        .map((tx) => tx.id);

      // Transaction dengan timeout lebih lama (30 detik)
      await prisma.$transaction(
        async (tx) => {
          // 4.1. Rollback deliveredVolume di purchase transaction
          if (unload.purchaseTransactionId && unload.deliveredVolume) {
            await tx.transaction.update({
              where: { id: unload.purchaseTransactionId },
              data: {
                deliveredVolume: {
                  decrement: unload.deliveredVolume,
                },
              },
            });
          }

          // 4.2. Hapus journal entries dan transaksi UNLOAD yang terkait
          if (relatedTransactionIds.length > 0) {
            // Hapus journal entries terlebih dahulu
            await tx.journalEntry.deleteMany({
              where: {
                transactionId: {
                  in: relatedTransactionIds,
                },
              },
            });

            // Hapus transactions
            await tx.transaction.deleteMany({
              where: {
                id: {
                  in: relatedTransactionIds,
                },
              },
            });
          }

          // 4.3. Update status unload menjadi REJECTED
          await tx.unload.update({
            where: { id: unloadId },
            data: {
              status: "REJECTED",
              updatedBy: { connect: { id: user!.id } },
              updatedAt: nowUTC(),
            },
          });
        },
        {
          timeout: 30000, // 30 detik timeout
        }
      );
    }

    return {
      success: true,
      message: `Unload ${unloadId} berhasil di-fix (status diubah menjadi REJECTED dan transaksi di-rollback)`,
      data: {
        unloadId,
        tankProduct: unload.tank.product.name,
        purchaseProduct: purchaseProductName,
        action: rejectUnload ? "REJECTED" : "CHECKED_ONLY",
      },
    };
  } catch (error) {
    console.error("Fix unload product mismatch error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal memperbaiki unload product mismatch",
    };
  }
}

/**
 * Fix semua unload dengan product mismatch di gas station tertentu
 * Hanya untuk DEVELOPER
 */
export async function fixAllUnloadProductMismatch(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan fix ini",
      };
    }

    // 2. Validasi gasStationId wajib
    if (!gasStationId || !gasStationId.trim()) {
      return {
        success: false,
        message: "Gas Station ID wajib diisi",
      };
    }

    // 3. Cek semua mismatch
    const checkResult = await checkAndFixUnloadProductMismatch(
      gasStationId.trim()
    );

    if (!checkResult.success || !checkResult.data) {
      return checkResult;
    }

    const data = checkResult.data as {
      mismatches: Array<{ unloadId: string }>;
    };

    // 2. Fix setiap mismatch secara sequential (untuk menghindari timeout)
    const results = [];
    for (const mismatch of data.mismatches) {
      const result = await fixUnloadProductMismatch(mismatch.unloadId, true);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      success: true,
      message: `Berhasil fix ${successCount} unload, gagal ${failCount} unload`,
      data: {
        total: data.mismatches.length,
        success: successCount,
        failed: failCount,
        results,
      },
    };
  } catch (error) {
    console.error("Fix all unload product mismatch error:", error);
    return {
      success: false,
      message: "Gagal memperbaiki semua unload product mismatch",
    };
  }
}

/**
 * Fix deliveredVolume di purchase transactions agar sesuai dengan jumlah unload APPROVED yang sebenarnya
 * Digunakan setelah menghapus unload yang error secara manual
 * Hanya untuk DEVELOPER
 */
export async function fixPurchaseTransactionDeliveredVolume(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan fix ini",
      };
    }

    // 2. Validasi gasStationId wajib
    if (!gasStationId || !gasStationId.trim()) {
      return {
        success: false,
        message: "Gas Station ID wajib diisi",
      };
    }

    // 3. Get semua purchase transactions untuk gas station tertentu
    const whereClause: any = {
      gasStationId: gasStationId.trim(),
      transactionType: "PURCHASE_BBM",
      approvalStatus: "APPROVED",
      purchaseVolume: {
        not: null,
      },
    };

    const purchaseTransactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        purchaseUnloads: {
          where: {
            status: "APPROVED",
          },
          select: {
            id: true,
            deliveredVolume: true,
            literAmount: true,
          },
        },
      },
    });

    const fixes: Array<{
      transactionId: string;
      oldDeliveredVolume: number;
      newDeliveredVolume: number;
      difference: number;
    }> = [];

    // 3. Hitung deliveredVolume yang benar dari unload APPROVED
    for (const tx of purchaseTransactions) {
      // Hitung deliveredVolume dari unload APPROVED yang ada
      const actualDeliveredVolume = tx.purchaseUnloads.reduce(
        (sum, u) => sum + (u.deliveredVolume || u.literAmount || 0),
        0
      );

      const currentDeliveredVolume = tx.deliveredVolume || 0;

      // Jika berbeda, perlu di-fix
      if (actualDeliveredVolume !== currentDeliveredVolume) {
        fixes.push({
          transactionId: tx.id,
          oldDeliveredVolume: currentDeliveredVolume,
          newDeliveredVolume: actualDeliveredVolume,
          difference: actualDeliveredVolume - currentDeliveredVolume,
        });
      }
    }

    // 4. Cari transaksi UNLOAD yang tidak memiliki unload terkait (orphan transactions)
    const orphanTransactions: Array<{
      id: string;
      description: string;
      gasStationId: string;
    }> = [];

    // Cari transaksi UNLOAD untuk gas station tertentu
    const unloadTransactions = await prisma.transaction.findMany({
      where: {
        gasStationId: gasStationId.trim(),
        transactionType: "UNLOAD",
        approvalStatus: "APPROVED",
      },
      select: {
        id: true,
        gasStationId: true,
        description: true,
        notes: true,
        createdAt: true,
      },
    });

    // Cek setiap transaksi UNLOAD apakah masih ada unload yang terkait
    for (const unloadTx of unloadTransactions) {
      // Cari unload APPROVED yang dibuat sekitar waktu yang sama (±1 jam)
      const txDate = new Date(unloadTx.createdAt);
      const startDate = new Date(txDate);
      startDate.setHours(startDate.getHours() - 1);
      const endDate = new Date(txDate);
      endDate.setHours(endDate.getHours() + 1);

      // Cek apakah ada unload APPROVED yang dibuat sekitar waktu yang sama
      const relatedUnloads = await prisma.unload.findMany({
        where: {
          tank: { gasStationId: unloadTx.gasStationId },
          status: "APPROVED",
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { id: true },
      });

      // Jika tidak ada unload terkait, berarti transaksi ini orphan
      if (relatedUnloads.length === 0) {
        orphanTransactions.push({
          id: unloadTx.id,
          description: unloadTx.description,
          gasStationId: unloadTx.gasStationId,
        });
      }
    }

    // 5. Update deliveredVolume di purchase transactions dan hapus orphan transactions
    await prisma.$transaction(
      async (tx) => {
        // 5.1. Update deliveredVolume
        for (const fix of fixes) {
          await tx.transaction.update({
            where: { id: fix.transactionId },
            data: {
              deliveredVolume: fix.newDeliveredVolume,
              updatedBy: { connect: { id: user!.id } },
              updatedAt: nowUTC(),
            },
          });
        }

        // 5.2. Hapus orphan transactions (transaksi UNLOAD yang tidak memiliki unload terkait)
        if (orphanTransactions.length > 0) {
          const orphanIds = orphanTransactions.map((tx) => tx.id);

          // Hapus journal entries terlebih dahulu (batch delete lebih cepat)
          await tx.journalEntry.deleteMany({
            where: {
              transactionId: {
                in: orphanIds,
              },
            },
          });

          // Hapus transactions (batch delete lebih cepat)
          await tx.transaction.deleteMany({
            where: {
              id: {
                in: orphanIds,
              },
            },
          });
        }
      },
      {
        timeout: 30000, // 30 detik timeout
      }
    );

    return {
      success: true,
      message: `Berhasil fix ${fixes.length} purchase transaction(s)${
        orphanTransactions.length > 0
          ? ` dan hapus ${orphanTransactions.length} orphan transaction(s)`
          : ""
      }`,
      data: {
        total: fixes.length,
        fixes,
        orphanTransactions:
          orphanTransactions.length > 0 ? orphanTransactions : undefined,
        orphanCount: orphanTransactions.length,
      },
    };
  } catch (error) {
    console.error("Fix purchase transaction deliveredVolume error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal memperbaiki deliveredVolume di purchase transactions",
    };
  }
}

/**
 * Cek dan fix data inconsistencies untuk gas station tertentu
 * Hanya untuk DEVELOPER
 *
 * Checks:
 * 1. Purchase transactions dengan deliveredVolume > purchaseVolume
 * 2. Unload dengan deliveredVolume > literAmount
 * 3. Unload APPROVED tanpa transaction terkait
 * 4. Purchase transactions APPROVED tanpa journal entries
 */
export async function checkDataInconsistencies(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan check ini",
      };
    }

    // 2. Validasi gasStationId wajib
    if (!gasStationId || !gasStationId.trim()) {
      return {
        success: false,
        message: "Gas Station ID wajib diisi",
      };
    }

    const inconsistencies: Array<{
      type: string;
      id: string;
      description: string;
      severity: "error" | "warning";
    }> = [];

    // 3. Check purchase transactions dengan deliveredVolume > purchaseVolume
    const purchaseTransactions = await prisma.transaction.findMany({
      where: {
        gasStationId: gasStationId.trim(),
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
      },
      select: {
        id: true,
        purchaseVolume: true,
        deliveredVolume: true,
        referenceNumber: true,
      },
    });

    for (const tx of purchaseTransactions) {
      if (
        tx.purchaseVolume &&
        tx.deliveredVolume &&
        tx.deliveredVolume > tx.purchaseVolume
      ) {
        inconsistencies.push({
          type: "purchase_delivered_exceeds_purchase",
          id: tx.id,
          description: `Purchase Transaction ${tx.id} (${
            tx.referenceNumber || "N/A"
          }): deliveredVolume (${tx.deliveredVolume}L) > purchaseVolume (${
            tx.purchaseVolume
          }L)`,
          severity: "error",
        });
      }
    }

    // 4. Check unload dengan deliveredVolume > literAmount
    const unloads = await prisma.unload.findMany({
      where: {
        tank: {
          gasStationId: gasStationId.trim(),
        },
        status: "APPROVED",
      },
      select: {
        id: true,
        deliveredVolume: true,
        literAmount: true,
        invoiceNumber: true,
      },
    });

    for (const unload of unloads) {
      if (
        unload.deliveredVolume &&
        unload.literAmount &&
        unload.deliveredVolume > unload.literAmount
      ) {
        inconsistencies.push({
          type: "unload_delivered_exceeds_real",
          id: unload.id,
          description: `Unload ${unload.id} (${
            unload.invoiceNumber || "N/A"
          }): deliveredVolume (${unload.deliveredVolume}L) > literAmount (${
            unload.literAmount
          }L)`,
          severity: "error",
        });
      }
    }

    // 5. Check unload APPROVED tanpa transaction terkait
    for (const unload of unloads) {
      const relatedTransactions = await prisma.transaction.findMany({
        where: {
          gasStationId: gasStationId.trim(),
          transactionType: "UNLOAD",
          approvalStatus: "APPROVED",
          notes: {
            contains: unload.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (relatedTransactions.length === 0) {
        inconsistencies.push({
          type: "unload_no_transaction",
          id: unload.id,
          description: `Unload ${unload.id} (${
            unload.invoiceNumber || "N/A"
          }): APPROVED tapi tidak ada transaction terkait`,
          severity: "warning",
        });
      }
    }

    // 6. Check purchase transactions APPROVED tanpa journal entries
    const purchaseTxsWithoutEntries = await prisma.transaction.findMany({
      where: {
        gasStationId: gasStationId.trim(),
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
        journalEntries: {
          none: {},
        },
      },
      select: {
        id: true,
        referenceNumber: true,
      },
    });

    for (const tx of purchaseTxsWithoutEntries) {
      inconsistencies.push({
        type: "purchase_no_journal_entries",
        id: tx.id,
        description: `Purchase Transaction ${tx.id} (${
          tx.referenceNumber || "N/A"
        }): APPROVED tapi tidak ada journal entries`,
        severity: "error",
      });
    }

    return {
      success: true,
      message: `Ditemukan ${inconsistencies.length} data inconsistency`,
      data: {
        total: inconsistencies.length,
        errors: inconsistencies.filter((i) => i.severity === "error").length,
        warnings: inconsistencies.filter((i) => i.severity === "warning")
          .length,
        inconsistencies,
      },
    };
  } catch (error) {
    console.error("Check data inconsistencies error:", error);
    return {
      success: false,
      message: "Gagal mengecek data inconsistencies",
    };
  }
}

/**
 * Fix semua data inconsistencies untuk gas station tertentu
 * Hanya untuk DEVELOPER
 *
 * Fixes:
 * 1. Purchase transactions dengan deliveredVolume > purchaseVolume → set deliveredVolume = purchaseVolume
 * 2. Unload dengan deliveredVolume > literAmount → set deliveredVolume = literAmount
 * 3. Unload APPROVED tanpa transaction terkait → rollback unload (reject)
 * 4. Purchase transactions APPROVED tanpa journal entries → rollback purchase (reject)
 */
export async function fixDataInconsistencies(
  gasStationId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan fix ini",
      };
    }

    // 2. Validasi gasStationId wajib
    if (!gasStationId || !gasStationId.trim()) {
      return {
        success: false,
        message: "Gas Station ID wajib diisi",
      };
    }

    // 3. Cek inconsistencies terlebih dahulu
    const checkResult = await checkDataInconsistencies(gasStationId.trim());
    if (!checkResult.success || !checkResult.data) {
      return checkResult;
    }

    const data = checkResult.data as {
      inconsistencies: Array<{
        type: string;
        id: string;
        description: string;
        severity: "error" | "warning";
      }>;
    };

    const fixes: Array<{
      type: string;
      id: string;
      action: string;
      success: boolean;
      message: string;
    }> = [];

    // 4. Fix setiap inconsistency secara sequential
    for (const inconsistency of data.inconsistencies) {
      try {
        if (inconsistency.type === "purchase_delivered_exceeds_purchase") {
          // Fix: Set deliveredVolume = purchaseVolume
          const purchaseTx = await prisma.transaction.findUnique({
            where: { id: inconsistency.id },
            select: {
              id: true,
              purchaseVolume: true,
              deliveredVolume: true,
            },
          });

          if (purchaseTx && purchaseTx.purchaseVolume !== null) {
            await prisma.$transaction(
              async (tx) => {
                await tx.transaction.update({
                  where: { id: inconsistency.id },
                  data: {
                    deliveredVolume: purchaseTx.purchaseVolume!,
                    updatedBy: { connect: { id: user!.id } },
                    updatedAt: nowUTC(),
                  },
                });
              },
              { timeout: 30000 }
            );

            fixes.push({
              type: inconsistency.type,
              id: inconsistency.id,
              action: `Set deliveredVolume dari ${purchaseTx.deliveredVolume}L menjadi ${purchaseTx.purchaseVolume}L`,
              success: true,
              message: "Berhasil",
            });
          }
        } else if (inconsistency.type === "unload_delivered_exceeds_real") {
          // Fix: Rollback unload karena deliveredVolume melebihi real volume
          const { rollbackUnloadApproval } = await import(
            "@/lib/actions/rollback"
          );
          const result = await rollbackUnloadApproval(inconsistency.id);

          fixes.push({
            type: inconsistency.type,
            id: inconsistency.id,
            action: "Rollback unload (deliveredVolume melebihi real volume)",
            success: result.success,
            message: result.message,
          });
        } else if (inconsistency.type === "unload_no_transaction") {
          // Fix: Rollback unload (reject)
          const { rollbackUnloadApproval } = await import(
            "@/lib/actions/rollback"
          );
          const result = await rollbackUnloadApproval(inconsistency.id);

          fixes.push({
            type: inconsistency.type,
            id: inconsistency.id,
            action: "Rollback unload (reject)",
            success: result.success,
            message: result.message,
          });
        } else if (inconsistency.type === "purchase_no_journal_entries") {
          // Fix: Rollback purchase (reject)
          const { rollbackPurchaseApproval } = await import(
            "@/lib/actions/rollback"
          );
          const result = await rollbackPurchaseApproval(inconsistency.id);

          fixes.push({
            type: inconsistency.type,
            id: inconsistency.id,
            action: "Rollback purchase (reject)",
            success: result.success,
            message: result.message,
          });
        }
      } catch (error) {
        console.error(`Fix inconsistency ${inconsistency.type} error:`, error);
        fixes.push({
          type: inconsistency.type,
          id: inconsistency.id,
          action: "Fix attempt",
          success: false,
          message:
            error instanceof Error ? error.message : "Gagal melakukan fix",
        });
      }
    }

    const successCount = fixes.filter((f) => f.success).length;
    const failCount = fixes.filter((f) => !f.success).length;

    // 5. Cache invalidation
    revalidatePath(`/gas-stations/${gasStationId.trim()}`);

    return {
      success: true,
      message: `Berhasil fix ${successCount} inconsistency, gagal ${failCount} inconsistency`,
      data: {
        total: fixes.length,
        success: successCount,
        failed: failCount,
        fixes,
      },
    };
  } catch (error) {
    console.error("Fix data inconsistencies error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal melakukan fix data inconsistencies",
    };
  }
}

/**
 * Reset deliveredVolume menjadi 0 untuk purchase transactions yang tidak memiliki unload records
 * Kasus: unload sudah dihapus dari database, tapi deliveredVolume masih menggantung
 * Hanya untuk DEVELOPER
 */
export async function resetOrphanDeliveredVolume(
  gasStationId?: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (hanya DEVELOPER)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER yang bisa menjalankan fix ini",
      };
    }

    const whereClause: any = {
      transactionType: "PURCHASE_BBM",
      approvalStatus: "APPROVED",
      purchaseVolume: { not: null },
      deliveredVolume: { gt: 0 }, // Hanya yang deliveredVolume > 0
    };

    if (gasStationId && gasStationId.trim()) {
      whereClause.gasStationId = gasStationId.trim();
    }

    // 2. Get semua purchase transactions dengan deliveredVolume > 0
    const purchaseTransactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        purchaseUnloads: {
          // Include SEMUA unload (semua status)
          select: {
            id: true,
            status: true,
            deliveredVolume: true,
            literAmount: true,
          },
        },
        gasStation: {
          select: { id: true, name: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // 3. Filter yang TIDAK memiliki unload records sama sekali
    const orphanTransactions = purchaseTransactions.filter(
      (tx) => tx.purchaseUnloads.length === 0
    );

    if (orphanTransactions.length === 0) {
      return {
        success: true,
        message:
          "Tidak ada orphan transactions ditemukan. Semua purchase transactions memiliki unload records.",
        data: {
          total: 0,
          changes: [],
        },
      };
    }

    // 4. Prepare changes untuk display
    const changes: Array<{
      transactionId: string;
      gasStation: string;
      product: string;
      purchaseVolume: number;
      currentDeliveredVolume: number;
      remainingVolume: number;
      date: Date;
    }> = [];

    for (const tx of orphanTransactions) {
      const purchaseVolume = tx.purchaseVolume || 0;
      const currentDeliveredVolume = tx.deliveredVolume || 0;
      const remainingVolume = purchaseVolume - currentDeliveredVolume;

      changes.push({
        transactionId: tx.id,
        gasStation: tx.gasStation?.name || "N/A",
        product: tx.product?.name || "N/A",
        purchaseVolume,
        currentDeliveredVolume,
        remainingVolume,
        date: tx.date,
      });
    }

    // 5. Execute reset dalam transaction
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ transactionId: string; error: string }> = [];

    await prisma.$transaction(
      async (tx) => {
        for (const change of changes) {
          try {
            await tx.transaction.update({
              where: { id: change.transactionId },
              data: {
                deliveredVolume: 0,
              },
            });
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push({
              transactionId: change.transactionId,
              error: error.message || "Unknown error",
            });
          }
        }
      },
      { timeout: 30000 }
    );

    // 6. Revalidate paths
    if (gasStationId && gasStationId.trim()) {
      revalidatePath(`/gas-stations/${gasStationId}`);
    }
    // Note: /admin/fix-data route tidak di-revalidate karena folder di-ignore untuk production

    const totalDeliveredVolume = changes.reduce(
      (sum, c) => sum + c.currentDeliveredVolume,
      0
    );

    return {
      success: true,
      message: `Berhasil reset ${successCount} orphan transaction(s). Total delivered volume yang di-reset: ${totalDeliveredVolume.toLocaleString(
        "id-ID"
      )} L${errorCount > 0 ? `. ${errorCount} gagal.` : ""}`,
      data: {
        total: changes.length,
        success: successCount,
        failed: errorCount,
        totalDeliveredVolume,
        changes: changes.map((c) => ({
          transactionId: c.transactionId,
          gasStation: c.gasStation,
          product: c.product,
          purchaseVolume: c.purchaseVolume,
          oldDeliveredVolume: c.currentDeliveredVolume,
          newDeliveredVolume: 0,
          oldRemainingVolume: c.remainingVolume,
          newRemainingVolume: c.purchaseVolume,
          date: c.date,
        })),
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    console.error("Reset orphan delivered volume error:", error);
    return {
      success: false,
      message: "Gagal reset orphan delivered volume",
    };
  }
}
