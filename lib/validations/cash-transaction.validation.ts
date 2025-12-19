import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";
import { normalizeDateUTC } from "@/lib/utils/datetime";

/**
 * Validation schema untuk Cash Transaction (CASH)
 * Untuk Finance yang hanya bisa create CASH transaction
 */
export const createCashTransactionSchema = z
  .object({
    gasStationId: z.string().cuid(),
    date: z.preprocess(normalizeDateUTC, z.date()),
    description: z.string().min(1).max(500),
    referenceNumber: z.string().max(100).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    // Cash-specific fields
    cashTransactionType: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    paymentAccount: z.enum(["CASH", "BANK"]),
    bankName: z.string().max(100).optional().nullable(),
    toPaymentAccount: z.enum(["CASH", "BANK"]).optional(), // Untuk TRANSFER
    toBankName: z.string().max(100).optional().nullable(), // Untuk TRANSFER
    coaId: z.union([z.string().cuid(), z.literal("")]).optional(), // COA untuk INCOME/EXPENSE, bisa empty string jika membuat COA baru
    amount: zNumber(z.number().int().positive("Amount harus lebih dari 0")),
    // Untuk create new COA
    newCOAName: z.string().max(100).optional(),
    newCOACategory: z.enum(["ASSET", "LIABILITY", "EXPENSE"]).optional(),
    newCOADescription: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      // Jika bukan TRANSFER dan coaId kosong, maka newCOAName dan newCOACategory harus ada
      if (
        data.cashTransactionType !== "TRANSFER" &&
        (!data.coaId || data.coaId === "")
      ) {
        return !!(data.newCOAName && data.newCOACategory);
      }
      return true;
    },
    {
      message: "Jika membuat COA baru, Nama dan Kategori COA harus diisi",
      path: ["newCOAName"],
    }
  )
  .refine(
    (data) => {
      // Jika bukan TRANSFER, harus ada coaId atau newCOAName
      if (data.cashTransactionType !== "TRANSFER") {
        return !!(data.coaId || data.newCOAName);
      }
      return true;
    },
    {
      message: "COA harus dipilih atau dibuat baru",
      path: ["coaId"],
    }
  );

export type CreateCashTransactionInput = z.infer<
  typeof createCashTransactionSchema
>;
