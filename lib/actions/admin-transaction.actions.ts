"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import {
  createAdminTransactionSchema,
  type CreateAdminTransactionInput,
} from "@/lib/validations/admin-transaction.validation";
import { createCOA } from "@/lib/actions/coa.actions";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Create Admin Transaction (ADJUSTMENT saja)
 * Hanya untuk ADMINISTRATOR role
 * ADMIN hanya bisa create ADJUSTMENT/MANUAL
 * CASH handle via cash-transaction.actions.ts (Finance)
 * PURCHASE handle via purchase.actions.ts (OwnerGroup)
 */
export async function createAdminTransaction(
  input: CreateAdminTransactionInput
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // Hanya ADMINISTRATOR yang bisa create admin transaction
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createAdminTransactionSchema.parse(input);

    // 3. Check gas station access
    const { authorized: hasAccess } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR"],
      validated.gasStationId
    );
    if (!hasAccess) {
      return {
        success: false,
        message: "Forbidden: No access to this gas station",
      };
    }

    // 4. Admin hanya handle ADJUSTMENT, tidak perlu auto-generate journal entries
    // Journal entries sudah diisi manual oleh admin
    let finalJournalEntries = validated.journalEntries;

    // 5. Handle create new COA jika diperlukan
    for (let i = 0; i < finalJournalEntries.length; i++) {
      const entry = finalJournalEntries[i];
      if (!entry.coaId || entry.coaId === "" || entry.coaId === "NEW") {
        // Perlu create new COA
        if (!entry.newCOAName || !entry.newCOACategory) {
          return {
            success: false,
            message: `Entry ${
              i + 1
            }: Nama dan Kategori COA harus diisi jika membuat COA baru`,
          };
        }

        const createCOAResult = await createCOA({
          gasStationId: validated.gasStationId,
          name: entry.newCOAName,
          category: entry.newCOACategory,
          description: entry.newCOADescription || "",
        });

        if (!createCOAResult.success) {
          return {
            success: false,
            message:
              createCOAResult.message || `Entry ${i + 1}: Gagal membuat COA`,
          };
        }

        const newCoaId = (createCOAResult.data as any)?.id;
        if (!newCoaId) {
          return {
            success: false,
            message: `Entry ${i + 1}: Gagal mendapatkan ID COA baru`,
          };
        }

        // Update entry dengan COA ID yang baru dibuat
        finalJournalEntries[i] = {
          ...entry,
          coaId: newCoaId,
        };
      }
    }

    // 6. Validate journal balance
    const totalDebit = finalJournalEntries.reduce(
      (sum, e) => sum + (e.debit || 0),
      0
    );
    const totalCredit = finalJournalEntries.reduce(
      (sum, e) => sum + (e.credit || 0),
      0
    );
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        message: `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
          "id-ID"
        )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`,
      };
    }

    // 7. Validate journal entries
    for (const entry of finalJournalEntries) {
      if (entry.debit === 0 && entry.credit === 0) {
        return {
          success: false,
          message: "Setiap entry jurnal harus memiliki debit atau kredit",
        };
      }
      if (entry.debit > 0 && entry.credit > 0) {
        return {
          success: false,
          message:
            "Setiap entry jurnal tidak boleh memiliki debit dan kredit sekaligus",
        };
      }
    }

    // 8. Validate semua journal entries sudah punya COA
    for (let i = 0; i < finalJournalEntries.length; i++) {
      const entry = finalJournalEntries[i];
      if (!entry.coaId || entry.coaId === "") {
        return {
          success: false,
          message: `Entry ${i + 1}: COA harus dipilih`,
        };
      }
    }

    // 9. Check if all COAs exist
    const coaIds = finalJournalEntries
      .map((e) => e.coaId)
      .filter((id): id is string => !!id);
    const coas = await prisma.cOA.findMany({
      where: {
        id: { in: coaIds },
        gasStationId: validated.gasStationId,
        status: "ACTIVE",
      },
    });

    if (coas.length !== coaIds.length) {
      return {
        success: false,
        message: "Salah satu atau lebih COA tidak ditemukan atau tidak aktif",
      };
    }

    // 9. Database + Audit trail - Create transaction and journal entries
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          gasStation: {
            connect: { id: validated.gasStationId },
          },
          date: validated.date,
          description: validated.description,
          referenceNumber: validated.referenceNumber || null,
          notes: validated.notes || null,
          transactionType:
            validated.transactionType === "MANUAL"
              ? "ADJUSTMENT"
              : validated.transactionType,
          approvalStatus: validated.approvalStatus || "APPROVED", // Admin langsung APPROVED
          approver: validated.approverId
            ? { connect: { id: validated.approverId } }
            : validated.approvalStatus === "APPROVED"
            ? { connect: { id: user.id } } // Admin yang create = approver
            : undefined,
          createdBy: { connect: { id: user.id } },
        },
      });

      // Create journal entries
      await tx.journalEntry.createMany({
        data: finalJournalEntries
          .filter((entry) => entry.coaId && entry.coaId !== "")
          .map((entry) => ({
            transactionId: transaction.id,
            coaId: entry.coaId!,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            description: entry.description || null,
            createdById: user.id,
          })),
      });
    });

    // 10. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return { success: true, message: "Transaksi berhasil dibuat" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create admin transaction error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create admin transaction",
    };
  }
}
