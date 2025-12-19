import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";
import { normalizeDateUTC } from "@/lib/utils/datetime";

/**
 * Validation schema untuk Purchase Transaction (PURCHASE_BBM)
 * Terpisah dari transaction umum karena memiliki logic khusus
 */
export const createPurchaseSchema = z.object({
  gasStationId: z.string().cuid(),
  date: z.preprocess(normalizeDateUTC, z.date()),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // Purchase-specific fields
  purchaseVolume: zNumber(z.number().int().positive("Purchase volume harus lebih dari 0")),
  productId: z.string().cuid("Product ID tidak valid"),
  bankName: z.string().max(100).optional().nullable(), // Nama bank untuk payment COA
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

