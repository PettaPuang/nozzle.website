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
 * Rollback purchase transaction yang sudah di-approve
 * Hanya untuk DEVELOPER
 *
 * Proses:
 * 1. Reverse transaction yang dibuat saat approval
 * 2. Update status purchase menjadi REJECTED
 * 3. Validasi ketat: tidak boleh ada unload yang terkait
 */
export async function rollbackPurchaseApproval(
  purchaseTransactionId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (DEVELOPER only)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message: message || "Unauthorized: Hanya DEVELOPER yang bisa rollback",
      };
    }

    // 2. Get purchase transaction data dengan SEMUA unload (semua status)
    const purchaseTransaction = await prisma.transaction.findUnique({
      where: { id: purchaseTransactionId },
      include: {
        gasStation: {
          select: {
            id: true,
          },
        },
        journalEntries: {
          include: {
            coa: true,
          },
        },
        purchaseUnloads: {
          // Include SEMUA unload (semua status) untuk validasi ketat
          select: {
            id: true,
            status: true,
            deliveredVolume: true,
            literAmount: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!purchaseTransaction) {
      return {
        success: false,
        message: "Purchase transaction tidak ditemukan",
      };
    }

    // 3. Validasi: Transaction harus PURCHASE_BBM dan APPROVED
    if (purchaseTransaction.transactionType !== "PURCHASE_BBM") {
      return {
        success: false,
        message: "Hanya bisa rollback purchase transaction (PURCHASE_BBM)",
      };
    }

    if (purchaseTransaction.approvalStatus !== "APPROVED") {
      return {
        success: false,
        message:
          "Hanya bisa rollback purchase transaction yang sudah di-approve",
      };
    }

    // 4. Validasi KETAT: Tidak boleh ada unload apapun yang terkait (semua status)
    if (purchaseTransaction.purchaseUnloads.length > 0) {
      const approvedUnloads = purchaseTransaction.purchaseUnloads.filter(
        (u) => u.status === "APPROVED"
      );
      const pendingUnloads = purchaseTransaction.purchaseUnloads.filter(
        (u) => u.status === "PENDING"
      );
      const rejectedUnloads = purchaseTransaction.purchaseUnloads.filter(
        (u) => u.status === "REJECTED"
      );

      // Jika ada unload APPROVED, tidak boleh di-rollback
      if (approvedUnloads.length > 0) {
        const totalDelivered = approvedUnloads.reduce(
          (sum, unload) => sum + (unload.deliveredVolume || unload.literAmount || 0),
          0
        );
        return {
          success: false,
          message: `Tidak bisa rollback purchase transaction yang sudah ada unload APPROVED (${approvedUnloads.length} unload, total delivered: ${totalDelivered.toLocaleString("id-ID")}L). Rollback unload terlebih dahulu.`,
        };
      }

      // Jika ada unload PENDING, tidak boleh di-rollback
      if (pendingUnloads.length > 0) {
        return {
          success: false,
          message: `Tidak bisa rollback purchase transaction yang sudah ada unload PENDING (${pendingUnloads.length} unload). Tolak atau rollback unload terlebih dahulu.`,
        };
      }

      // Jika ada unload REJECTED, tetap tidak boleh di-rollback untuk konsistensi data
      // Karena unload REJECTED masih memiliki relasi dengan purchase transaction
      if (rejectedUnloads.length > 0) {
        return {
          success: false,
          message: `Tidak bisa rollback purchase transaction yang sudah pernah digunakan untuk unload (${rejectedUnloads.length} unload REJECTED). Hapus unload REJECTED terlebih dahulu jika diperlukan.`,
        };
      }
    }

    // 5. Validasi tambahan: Cek deliveredVolume
    // Jika deliveredVolume > 0, berarti sudah ada unload yang menggunakan purchase ini
    if (purchaseTransaction.deliveredVolume > 0) {
      return {
        success: false,
        message: `Tidak bisa rollback purchase transaction yang sudah memiliki deliveredVolume (${purchaseTransaction.deliveredVolume.toLocaleString("id-ID")}L). Pastikan tidak ada unload yang terkait.`,
      };
    }

    // 5. Proses rollback dalam transaction
    await prisma.$transaction(
      async (tx) => {
        // 5.1. Reverse transaction yang dibuat saat approval
        const reverseJournalEntries = purchaseTransaction.journalEntries.map(
          (entry) => ({
            coaId: entry.coaId,
            debit: entry.credit,
            credit: entry.debit,
            description: `ROLLBACK: ${entry.description || ""}`,
          })
        );

        const { createAutoTransaction } = await import(
          "@/lib/actions/transaction.actions"
        );

        await createAutoTransaction({
          gasStationId: purchaseTransaction.gasStationId,
          date: nowUTC(),
          description: `ROLLBACK: Purchase BBM - Membatalkan approval purchase transaction ID: ${purchaseTransactionId}`,
          referenceNumber: purchaseTransaction.referenceNumber || null,
          notes: `Rollback transaction untuk membatalkan approval purchase transaction ID: ${purchaseTransactionId}`,
          journalEntries: reverseJournalEntries,
          createdById: user!.id,
          transactionType: "ADJUSTMENT",
          approvalStatus: "APPROVED",
          approverId: null,
          tx,
        });

        // 5.2. Update status purchase menjadi REJECTED
        await tx.transaction.update({
          where: { id: purchaseTransactionId },
          data: {
            approvalStatus: "REJECTED",
            updatedBy: { connect: { id: user!.id } },
            updatedAt: nowUTC(),
          },
        });
      },
      {
        timeout: 30000,
      }
    );

    revalidatePath(`/gas-stations/${purchaseTransaction.gasStationId}`);

    return {
      success: true,
      message: `Purchase transaction ${purchaseTransactionId} berhasil di-rollback (status diubah menjadi REJECTED dan transaksi di-reverse)`,
      data: {
        purchaseTransactionId,
        previousStatus: "APPROVED",
        newStatus: "REJECTED",
      },
    };
  } catch (error) {
    console.error("Rollback purchase approval error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal melakukan rollback purchase approval",
    };
  }
}

