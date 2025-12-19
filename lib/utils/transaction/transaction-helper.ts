"use server";

import { createAutoTransaction } from "@/lib/actions/transaction.actions";
import type { Prisma } from "@prisma/client";

/**
 * Helper untuk membuat Transaction dan JournalEntry dari operasional
 * Menggunakan createAutoTransaction dari transaction.actions.ts
 */
export async function createOperationalTransaction(params: {
  gasStationId: string;
  date: Date;
  description: string;
  referenceNumber?: string | null;
  notes?: string | null;
  journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
  createdById: string;
  transactionType:
    | "UNLOAD"
    | "TANK_READING"
    | "REVENUE"
    | "COGS"
    | "DEPOSIT"
    | "ADJUSTMENT";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approverId?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    date,
    description,
    referenceNumber,
    notes,
    journalEntries,
    createdById,
    transactionType,
    approvalStatus = "APPROVED",
    approverId,
    tx,
  } = params;

  // Gunakan createAutoTransaction dari transaction.actions.ts
  return await createAutoTransaction({
    gasStationId,
    date,
    description,
    referenceNumber,
    notes,
    transactionType,
    journalEntries,
    createdById,
    approvalStatus,
    approverId,
    tx,
  });
}

