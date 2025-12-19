import { z } from "zod";

export const createCOASchema = z.object({
  gasStationId: z.string().cuid(),
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(255),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "COGS"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE").optional(),
  description: z.string().max(1000).optional().nullable(),
});

export const updateCOASchema = z.object({
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(255).optional(),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "COGS"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  description: z.string().max(1000).optional().nullable(),
});

export type CreateCOAInput = z.infer<typeof createCOASchema>;
export type UpdateCOAInput = z.infer<typeof updateCOASchema>;

