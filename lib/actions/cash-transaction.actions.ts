"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import {
  createCashTransactionSchema,
  type CreateCashTransactionInput,
} from "@/lib/validations/cash-transaction.validation";
import { findOrCreatePaymentCOA } from "@/lib/utils/coa.utils";
import { createCOA } from "@/lib/actions/coa.actions";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Create Cash Transaction (CASH)
 * Untuk FINANCE, ADMINISTRATOR, dan DEVELOPER
 * Semua transaksi kas harus melalui flow approval MANAGER (status PENDING)
 */
export async function createCashTransaction(
  input: CreateCashTransactionInput
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // FINANCE, ADMINISTRATOR, dan DEVELOPER bisa create CASH transaction
    const { authorized, user, message } = await checkPermission([
      "FINANCE",
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createCashTransactionSchema.parse(input);

    // 3. Check gas station access
    const { authorized: hasAccess } = await checkPermissionWithGasStation(
      ["FINANCE", "ADMINISTRATOR", "DEVELOPER"],
      validated.gasStationId
    );
    if (!hasAccess) {
      return {
        success: false,
        message: "Forbidden: No access to this gas station",
      };
    }

    // 4. Semua transaksi kas harus melalui flow approval
    // Tidak peduli siapa yang input, semua status PENDING dan perlu approval MANAGER
    const approvalStatus = "PENDING";
    const approverId = null;

    // 5. Handle create new COA jika diperlukan (hanya untuk INCOME/EXPENSE, bukan TRANSFER)
    let finalCoaId = validated.coaId;
    if (
      validated.cashTransactionType !== "TRANSFER" &&
      (validated.coaId === "NEW" || !validated.coaId)
    ) {
      if (!validated.newCOAName || !validated.newCOACategory) {
        return {
          success: false,
          message: "Nama dan Kategori COA harus diisi",
        };
      }

      const createCOAResult = await createCOA({
        gasStationId: validated.gasStationId,
        name: validated.newCOAName,
        category: validated.newCOACategory,
        description: validated.newCOADescription || "",
      });

      if (!createCOAResult.success) {
        return {
          success: false,
          message: createCOAResult.message || "Gagal membuat COA",
        };
      }

      finalCoaId = (createCOAResult.data as any)?.id;
      if (!finalCoaId) {
        return {
          success: false,
          message: "Gagal mendapatkan ID COA baru",
        };
      }
    }

    // 6. Database + Audit trail - Create transaction and journal entries
    await prisma.$transaction(async (tx) => {
      // Get COAs
      const coas = await tx.cOA.findMany({
        where: {
          gasStationId: validated.gasStationId,
          status: "ACTIVE",
        },
      });

      const paymentCOA = await findOrCreatePaymentCOA(
        validated.gasStationId,
        validated.paymentAccount,
        user.id
      );

      let journalEntries: Array<{
        coaId: string;
        debit: number;
        credit: number;
        description?: string | null;
      }> = [];

      if (validated.cashTransactionType === "TRANSFER") {
        // Transfer antar kas
        if (!validated.toPaymentAccount) {
          throw new Error("Tujuan transfer harus dipilih");
        }

        const toPaymentCOA = await findOrCreatePaymentCOA(
          validated.gasStationId,
          validated.toPaymentAccount,
          user.id
        );

        if (paymentCOA.id === toPaymentCOA.id) {
          throw new Error("Transfer tidak boleh ke rekening yang sama");
        }

        journalEntries = [
          {
            coaId: toPaymentCOA.id,
            debit: validated.amount,
            credit: 0,
            description: `Transfer dari ${paymentCOA.name}`,
          },
          {
            coaId: paymentCOA.id,
            debit: 0,
            credit: validated.amount,
            description: `Transfer ke ${toPaymentCOA.name}`,
          },
        ];
      } else {
        // INCOME atau EXPENSE - harus ada COA
        if (!finalCoaId) {
          throw new Error(
            "COA harus dipilih untuk transaksi pemasukan/pengeluaran"
          );
        }

        const coa = await tx.cOA.findUnique({
          where: { id: finalCoaId },
        });

        if (!coa) {
          throw new Error("COA tidak ditemukan");
        }

        if (validated.cashTransactionType === "INCOME") {
          journalEntries = [
            {
              coaId: paymentCOA.id,
              debit: validated.amount,
              credit: 0,
              description: `Pemasukan dari ${paymentCOA.name}`,
            },
            {
              coaId: coa.id,
              debit: 0,
              credit: validated.amount,
              description: `Pendapatan: ${coa.name}`,
            },
          ];
        } else {
          // EXPENSE
          journalEntries = [
            {
              coaId: coa.id,
              debit: validated.amount,
              credit: 0,
              description: `Pengeluaran: ${coa.name}`,
            },
            {
              coaId: paymentCOA.id,
              debit: 0,
              credit: validated.amount,
              description: `Pembayaran dari ${paymentCOA.name}`,
            },
          ];
        }
      }

      // Validate balance
      const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);
      if (totalDebit !== totalCredit) {
        throw new Error(
          `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
            "id-ID"
          )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
        );
      }

      // Create transaction header
      const transaction = await tx.transaction.create({
        data: {
          gasStation: {
            connect: { id: validated.gasStationId },
          },
          date: validated.date,
          description: validated.description,
          referenceNumber: validated.referenceNumber || null,
          notes: validated.notes || null,
          transactionType: "CASH",
          approvalStatus,
          approver: approverId ? { connect: { id: approverId } } : undefined,
          createdBy: { connect: { id: user.id } },
        },
      });

      // Create journal entries
      await tx.journalEntry.createMany({
        data: journalEntries.map((entry) => ({
          transactionId: transaction.id,
          coaId: entry.coaId,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          description: entry.description || null,
          createdById: user.id,
        })),
      });
    });

    // 6. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return { success: true, message: "Transaksi kas berhasil dibuat" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create cash transaction error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create cash transaction",
    };
  }
}
