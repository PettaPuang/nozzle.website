import { z } from "zod";

// Unload
export const createUnloadSchema = z.object({
  tankId: z.string().cuid(),
  unloaderId: z.string().cuid(),
  managerId: z.string().cuid().optional(),
  literAmount: z.number().positive(),
  invoiceNumber: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  notes: z.string().max(1000).optional(),
});

export const updateUnloadSchema = z.object({
  managerId: z.string().cuid().optional(),
  literAmount: z.number().positive().optional(),
  invoiceNumber: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  notes: z.string().max(1000).optional(),
});

