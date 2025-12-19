import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";
import { normalizeDateUTC } from "@/lib/utils/datetime";

const journalEntrySchema = z.object({
  coaId: z.string().cuid(),
  debit: zNumber(z.number().int().min(0).default(0)),
  credit: zNumber(z.number().int().min(0).default(0)),
  description: z.string().max(500).optional().nullable(),
});

export const createTransactionSchema = z.object({
  gasStationId: z.string().cuid(),
  date: z.preprocess(normalizeDateUTC, z.date()),
  description: z.string().min(1).max(500),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  transactionType: z.enum(["CASH", "ADJUSTMENT"]), // PURCHASE_BBM dipindah ke purchase.actions.ts
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING").optional(),
  approverId: z.string().cuid().optional().nullable(),
  journalEntries: z
    .array(journalEntrySchema)
    .min(2, "Minimal harus ada 2 entry jurnal (debit dan kredit)"),
});

export const updateTransactionSchema = z.object({
  date: z.preprocess(normalizeDateUTC, z.date()).optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  approverId: z.string().cuid().optional().nullable(),
  journalEntries: z
    .array(journalEntrySchema)
    .min(2, "Minimal harus ada 2 entry jurnal (debit dan kredit)")
    .optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

