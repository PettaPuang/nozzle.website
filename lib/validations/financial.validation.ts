import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";

// Deposit
export const createDepositSchema = z.object({
  operatorShiftId: z.string().cuid(),
  adminFinanceId: z.string().cuid().optional(),
  totalAmount: z.number().int().nonnegative(),
  operatorDeclaredAmount: z.number().int().nonnegative(),
  adminReceivedAmount: z.number().int().nonnegative().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  notes: z.string().max(1000).optional(),
});

export const updateDepositSchema = z.object({
  adminFinanceId: z.string().cuid().optional(),
  adminReceivedAmount: z.number().int().nonnegative().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  notes: z.string().max(1000).optional(),
});

// DepositDetail
export const createDepositDetailSchema = z.object({
  depositId: z.string().cuid(),
  paymentAccount: z.enum(["CASH", "BANK"]),
  paymentMethod: z
    .enum(["QRIS", "TRANSFER", "DEBIT_CARD", "CREDIT_CARD", "MY_PERTAMINA", "COUPON", "ETC"])
    .optional(),
  bankName: z.string().max(50).optional(), // Optional: untuk multiple bank accounts
  operatorAmount: z.number().int(), // Jumlah dalam Rupiah (bulat), bisa negatif untuk COUPON (contra entry tip)
  adminAmount: z.number().int().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateDepositDetailSchema = z.object({
  adminAmount: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

// Operator Deposit (untuk operator input setoran di office)
export const createOperatorDepositSchema = z.object({
  operatorShiftId: z.string().cuid(),
  paymentDetails: z
    .array(
      z.object({
        paymentAccount: z.enum(["CASH", "BANK"]),
        paymentMethod: z
          .enum([
            "QRIS",
            "TRANSFER",
            "DEBIT_CARD",
            "CREDIT_CARD",
            "MY_PERTAMINA",
            "ETC",
          ])
          .optional(),
        bankName: z.string().max(50).optional(),
        amount: zNumber(z.number().int()),
      })
    )
    .min(0),
  notes: z.string().max(1000).optional(),
  isFreeFuel: z.boolean().default(false), // Checkbox free fuel
  freeFuelAmount: zNumber(z.number().int()).optional(), // Nilai free fuel
  freeFuelReason: z.string().max(500).optional(), // Alasan free fuel
  titipanProducts: z
    .array(
      z.object({
        coaId: z.string().cuid(),
        amount: zNumber(z.number().int().nonnegative()),
      })
    )
    .optional()
    .default([]), // Array titipan products: [{coaId, amount}, ...]
});

export type CreateOperatorDepositInput = z.infer<
  typeof createOperatorDepositSchema
>;
