import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";

// GasStation
export const createGasStationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  ownerId: z.string().cuid(),
  openTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .or(z.literal("")),
  closeTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  managerCanPurchase: z.boolean().default(false),
  financeCanPurchase: z.boolean().default(false),
  hasTitipan: z.boolean().default(false),
  titipanNames: z.array(z.string().min(1).max(50)).optional().default([]),
}).refine(
  (data) => {
    // Jika hasTitipan = true, titipanNames wajib diisi minimal 1
    if (data.hasTitipan) {
      const validNames = (data.titipanNames || []).filter((name) => name.trim() !== "");
      if (validNames.length === 0) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Nama titipan wajib diisi jika fitur titipan diaktifkan",
    path: ["titipanNames"],
  }
);

export const updateGasStationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  ownerId: z.string().cuid().optional(),
  openTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .or(z.literal("")),
  closeTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  managerCanPurchase: z.boolean().optional(),
  financeCanPurchase: z.boolean().optional(),
  hasTitipan: z.boolean().optional(),
  titipanNames: z.array(z.string().min(1).max(50)).optional(),
}).refine(
  (data) => {
    // Jika hasTitipan = true, titipanNames wajib diisi minimal 1
    if (data.hasTitipan) {
      const validNames = (data.titipanNames || []).filter((name) => name.trim() !== "");
      if (validNames.length === 0) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Nama titipan wajib diisi jika fitur titipan diaktifkan",
    path: ["titipanNames"],
  }
);

// Product
export const createProductSchema = z
  .object({
    gasStationId: z.string().cuid(),
    name: z.string().min(1).max(100),
    ron: z.string().max(20).optional().nullable(),
    purchasePrice: zNumber(z.number().int().positive()),
    sellingPrice: zNumber(z.number().int().positive()),
  })
  .refine((data) => data.sellingPrice >= data.purchasePrice, {
    message: "Selling price must be greater than or equal to purchase price",
    path: ["sellingPrice"],
  });

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ron: z.string().max(20).optional().nullable(),
  purchasePrice: zNumber(z.number().int().positive().optional()),
  sellingPrice: zNumber(z.number().int().positive().optional()),
});

// Tank
export const createTankSchema = z.object({
  gasStationId: z.string().cuid(),
  productId: z.string().cuid(),
  capacity: zNumber(z.number().int().positive()),
  initialStock: zNumber(z.number().int().min(0)),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
});

export const updateTankSchema = z.object({
  productId: z.string().cuid().optional(),
  capacity: zNumber(z.number().int().positive().optional()),
  initialStock: zNumber(z.number().int().min(0).optional()),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
});

// Station
export const createStationSchema = z.object({
  gasStationId: z.string().cuid(),
  code: z.string().min(1, "Kode wajib diisi").max(20),
  name: z.string().min(1, "Nama wajib diisi").max(100),
  tankIds: z.array(z.string().cuid()).min(1, "Pilih minimal 1 tank"),
});

export const updateStationSchema = z.object({
  gasStationId: z.string().cuid().optional(),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  tankIds: z.array(z.string().cuid()).optional(),
});

// Nozzle
export const createNozzleSchema = z.object({
  stationId: z.string().cuid(),
  tankId: z.string().cuid(),
  productId: z.string().cuid(),
  code: z.string().min(1, "Kode wajib diisi").max(20),
  name: z.string().min(1, "Nama wajib diisi").max(100),
});

export const updateNozzleSchema = z.object({
  stationId: z.string().cuid().optional(),
  tankId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
});
