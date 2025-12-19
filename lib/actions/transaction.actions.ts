"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validations/transaction.validation";
import { TransactionService } from "@/lib/services/transaction.service";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Validate that total debit equals total credit for journal entries
 */
function validateJournalBalance(
  journalEntries: Array<{ debit: number; credit: number }>
): { valid: boolean; totalDebit: number; totalCredit: number } {
  const totalDebit = journalEntries.reduce(
    (sum, entry) => sum + (entry.debit || 0),
    0
  );
  const totalCredit = journalEntries.reduce(
    (sum, entry) => sum + (entry.credit || 0),
    0
  );

  return {
    valid: Math.abs(totalDebit - totalCredit) < 0.01, // Allow small floating point differences
    totalDebit,
    totalCredit,
  };
}

/**
 * Create Auto Transaction
 * HANYA untuk transaction yang dibuat otomatis oleh sistem
 * Jangan digunakan untuk manual transaction (gunakan cash-transaction.actions.ts atau admin-transaction.actions.ts)
 * 
 * Auto transaction types:
 * - UNLOAD (susut perjalanan)
 * - TANK_READING (loss/profit)
 * - REVENUE (pendapatan dari deposit)
 * - COGS (HPP dari deposit)
 * - DEPOSIT (payment saat deposit di-approve)
 * - ADJUSTMENT (penyesuaian stock)
 */
export async function createAutoTransaction(params: {
  gasStationId: string;
  date: Date;
  description: string;
  referenceNumber?: string | null;
  notes?: string | null;
  transactionType: "UNLOAD" | "TANK_READING" | "REVENUE" | "COGS" | "DEPOSIT" | "ADJUSTMENT";
  journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
  createdById: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approverId?: string | null;
  tx?: any; // Prisma transaction client
}) {
  const {
    gasStationId,
    date,
    description,
    referenceNumber,
    notes,
    transactionType,
    journalEntries,
    createdById,
    approvalStatus = "APPROVED", // Auto transaction langsung APPROVED
    approverId = null,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Validate balance
  const totalDebit = journalEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = journalEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString("id-ID")}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
    );
  }

  // Create transaction
  const transaction = await prismaClient.transaction.create({
    data: {
      gasStation: {
        connect: { id: gasStationId },
      },
      date,
      description,
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      transactionType,
      approvalStatus,
      approver: approverId
        ? { connect: { id: approverId } }
        : undefined,
      createdBy: { connect: { id: createdById } },
    },
  });

  // Create journal entries
  await prismaClient.journalEntry.createMany({
    data: journalEntries.map((entry) => ({
      transactionId: transaction.id,
      coaId: entry.coaId,
      debit: entry.debit || 0,
      credit: entry.credit || 0,
      description: entry.description || null,
      createdById,
    })),
  });

  return transaction;
}

export async function updateTransaction(
  id: string,
  input: z.infer<typeof updateTransactionSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = updateTransactionSchema.parse(input);

    // 3. Check if transaction exists
    const existing = await prisma.transaction.findUnique({
      where: { id },
      include: {
        journalEntries: true,
      },
    });

    if (!existing) {
      return { success: false, message: "Transaksi tidak ditemukan" };
    }

    // 3.5. Check if MANAGER can only approve PURCHASE_BBM and CASH transactions with PENDING status
    if (user!.roleCode === "MANAGER" && validated.approvalStatus) {
      // Manager hanya bisa approve/reject transaksi yang masih PENDING
      if (existing.approvalStatus !== "PENDING") {
        return {
          success: false,
          message: "Hanya bisa approve/reject transaksi yang masih PENDING",
        };
      }
      
      // Manager hanya bisa approve transaksi CASH (PURCHASE_BBM sudah auto-approved oleh OWNER_GROUP)
      if (
        existing.transactionType !== "CASH"
      ) {
        return {
          success: false,
          message: "Manager hanya bisa approve transaksi CASH",
        };
      }
    }

    // 4. Validate journal entries exist and balance if approving
    if (validated.approvalStatus === "APPROVED") {
      if (!existing.journalEntries || existing.journalEntries.length === 0) {
        return {
          success: false,
          message: "Transaksi tidak memiliki journal entries. Tidak dapat diapprove.",
        };
      }

      // Validate journal balance
      const balanceValidation = validateJournalBalance(
        existing.journalEntries.map((e) => ({
          debit: Number(e.debit),
          credit: Number(e.credit),
        }))
      );
      if (!balanceValidation.valid) {
        return {
          success: false,
          message: `Jurnal tidak balance! Total Debit: Rp ${balanceValidation.totalDebit.toLocaleString("id-ID")}, Total Kredit: Rp ${balanceValidation.totalCredit.toLocaleString("id-ID")}`,
        };
      }

      // Validate journal entries
      for (const entry of existing.journalEntries) {
        const debit = Number(entry.debit);
        const credit = Number(entry.credit);
        if (debit === 0 && credit === 0) {
          return {
            success: false,
            message: "Setiap entry jurnal harus memiliki debit atau kredit",
          };
        }
        if (debit > 0 && credit > 0) {
          return {
            success: false,
            message: "Setiap entry jurnal tidak boleh memiliki debit dan kredit sekaligus",
          };
        }
      }
    }

    // 5. Validate journal balance if journal entries are being updated
    if (validated.journalEntries) {
      const balanceValidation = validateJournalBalance(
        validated.journalEntries
      );
      if (!balanceValidation.valid) {
        return {
          success: false,
          message: `Jurnal tidak balance! Total Debit: Rp ${balanceValidation.totalDebit.toLocaleString("id-ID")}, Total Kredit: Rp ${balanceValidation.totalCredit.toLocaleString("id-ID")}`,
        };
      }

      // Validate journal entries
      for (const entry of validated.journalEntries) {
        if (entry.debit === 0 && entry.credit === 0) {
          return {
            success: false,
            message: "Setiap entry jurnal harus memiliki debit atau kredit",
          };
        }
        if (entry.debit > 0 && entry.credit > 0) {
          return {
            success: false,
            message: "Setiap entry jurnal tidak boleh memiliki debit dan kredit sekaligus",
          };
        }
      }

      // Check if all COAs exist
      const coaIds = validated.journalEntries.map((e) => e.coaId);
      const coas = await prisma.cOA.findMany({
        where: {
          id: { in: coaIds },
          gasStationId: existing.gasStationId,
          status: "ACTIVE",
        },
      });

      if (coas.length !== coaIds.length) {
        return {
          success: false,
          message: "Salah satu atau lebih COA tidak ditemukan atau tidak aktif",
        };
      }
    }

    // 5. Database + Audit trail - Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update transaction header
      await tx.transaction.update({
        where: { id },
        data: {
          ...(validated.date && { date: validated.date }),
          ...(validated.description && { description: validated.description }),
          ...(validated.referenceNumber !== undefined && {
            referenceNumber: validated.referenceNumber,
          }),
          ...(validated.notes !== undefined && { notes: validated.notes }),
          ...(validated.approvalStatus && {
            approvalStatus: validated.approvalStatus,
          }),
          ...(validated.approverId !== undefined
            ? {
                approver: validated.approverId
                  ? { connect: { id: validated.approverId } }
                  : { disconnect: true },
              }
            : validated.approvalStatus === "APPROVED" && !existing.approverId
            ? {
                // Auto-set approver jika approve dan belum ada approver
                approver: { connect: { id: user!.id } },
              }
            : {}),
          updatedBy: { connect: { id: user!.id } },
          updatedAt: nowUTC(),
        },
      });

      // Update journal entries if provided
      if (validated.journalEntries) {
        // Delete existing entries
        await tx.journalEntry.deleteMany({
          where: { transactionId: id },
        });

        // Create new entries
        await tx.journalEntry.createMany({
          data: validated.journalEntries.map((entry) => ({
            transactionId: id,
            coaId: entry.coaId,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            description: entry.description || null,
            createdById: user!.id,
          })),
        });
      }
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${existing.gasStationId}`);
    return { success: true, message: "Transaksi berhasil diupdate" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Update transaction error:", error);
    return { success: false, message: "Failed to update transaction" };
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check - hanya ADMINISTRATOR dan DEVELOPER
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Check if transaction exists dengan createdBy untuk validasi manual
    const existing = await prisma.transaction.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, message: "Transaksi tidak ditemukan" };
    }

    // 3. Validasi: hanya transaksi manual yang bisa dihapus
    // CASH: selalu manual (dibuat oleh FINANCE via cash-transaction.actions.ts)
    // ADJUSTMENT: hanya yang dibuat manual oleh ADMINISTRATOR atau DEVELOPER
    const allowedTypes = ["ADJUSTMENT", "CASH"];
    if (!allowedTypes.includes(existing.transactionType)) {
      return {
        success: false,
        message: `Transaksi tipe ${existing.transactionType} tidak dapat dihapus. Hanya transaksi manual yang dapat dihapus.`,
      };
    }

    // 4. Untuk ADJUSTMENT, pastikan dibuat oleh ADMINISTRATOR atau DEVELOPER (manual)
    // ADJUSTMENT auto dibuat oleh sistem (role bukan ADMINISTRATOR/DEVELOPER) tidak bisa dihapus
    if (
      existing.transactionType === "ADJUSTMENT" &&
      existing.createdBy &&
      existing.createdBy.role !== "ADMINISTRATOR" &&
      existing.createdBy.role !== "DEVELOPER"
    ) {
      return {
        success: false,
        message: "Transaksi ADJUSTMENT ini dibuat otomatis oleh sistem dan tidak dapat dihapus. Hanya transaksi manual yang dapat dihapus.",
      };
    }

    // 5. Delete transaction (cascade will delete journal entries)
    await prisma.transaction.delete({
      where: { id },
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${existing.gasStationId}`);
    return { success: true, message: "Transaksi berhasil dihapus" };
  } catch (error) {
    console.error("Delete transaction error:", error);
    return { success: false, message: "Failed to delete transaction" };
  }
}

export async function getTransactions(gasStationId: string) {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
      },
      include: {
        journalEntries: {
          include: {
            coa: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

// getPurchaseTransactions dipindah ke purchase.actions.ts

/**
 * Get transaction by ID
 */
export async function getTransactionById(id: string) {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: null };
    }

    const transaction = await TransactionService.getTransactionById(id);

    if (!transaction) {
      return { success: false, message: "Transaction not found", data: null };
    }

    return {
      success: true,
      data: transaction,
    };
  } catch (error) {
    console.error("Get transaction by ID error:", error);
    return { success: false, message: "Gagal mengambil data", data: null };
  }
}

// Export validation helper
export { validateJournalBalance };

