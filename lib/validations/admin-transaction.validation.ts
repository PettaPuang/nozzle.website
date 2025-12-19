import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";
import { normalizeDateUTC } from "@/lib/utils/datetime";

const journalEntrySchema = z.object({
  coaId: z.union([z.string().cuid(), z.literal(""), z.literal("NEW")]).optional(), // Optional jika membuat COA baru, bisa empty string atau "NEW"
  debit: zNumber(z.number().int().min(0).default(0)),
  credit: zNumber(z.number().int().min(0).default(0)),
  description: z.string().max(500).optional().nullable(),
  // Untuk create new COA
  newCOAName: z.string().max(100).optional(),
  newCOACategory: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"]).optional(),
  newCOADescription: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    // Jika coaId tidak ada, empty string, atau "NEW", maka newCOAName dan newCOACategory harus ada
    if (!data.coaId || data.coaId === "" || data.coaId === "NEW") {
      return !!(data.newCOAName && data.newCOACategory);
    }
    return true;
  },
  {
    message: "Jika membuat COA baru, Nama dan Kategori COA harus diisi",
    path: ["newCOAName"],
  }
).refine(
  (data) => {
    // Harus ada coaId atau newCOAName
    return !!(data.coaId || data.newCOAName);
  },
  {
    message: "COA harus dipilih atau dibuat baru",
    path: ["coaId"],
  }
);

/**
 * Validation schema untuk Admin Transaction
 * ADMIN hanya bisa create ADJUSTMENT/MANUAL
 * CASH handle via cash-transaction.validation.ts (Finance)
 * PURCHASE handle via purchase.validation.ts (OwnerGroup)
 */
export const createAdminTransactionSchema = z.object({
  gasStationId: z.string().cuid(),
  date: z.preprocess(normalizeDateUTC, z.date()),
  description: z.string().min(1).max(500),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  transactionType: z.enum(["ADJUSTMENT", "MANUAL"]).default("ADJUSTMENT"), // MANUAL = ADJUSTMENT
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("APPROVED").optional(),
  approverId: z.string().cuid().optional().nullable(),
  journalEntries: z
    .array(journalEntrySchema)
    .min(2, "Minimal harus ada 2 entry jurnal (debit dan kredit)"),
});

export type CreateAdminTransactionInput = z.infer<typeof createAdminTransactionSchema>;

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

