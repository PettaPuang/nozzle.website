import { z } from "zod";
import { zNumber } from "@/lib/utils/form-types";
import { normalizeDateUTC, normalizeDateTimeUTC } from "@/lib/utils/datetime";

// OperatorShift
export const createOperatorShiftSchema = z.object({
  operatorId: z.string().cuid(),
  stationId: z.string().cuid(),
  gasStationId: z.string().cuid(),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  date: z.preprocess(normalizeDateUTC, z.date()),
  startTime: z.preprocess(normalizeDateTimeUTC, z.date()).optional(),
  endTime: z.preprocess(normalizeDateTimeUTC, z.date()).optional(),
  status: z
    .enum(["PENDING", "STARTED", "COMPLETED", "CANCELLED"])
    .default("PENDING"),
  notes: z.string().max(1000).optional(),
});

export const updateOperatorShiftSchema = z.object({
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]).optional(),
  startTime: z.preprocess(normalizeDateTimeUTC, z.date()).optional(),
  endTime: z.preprocess(normalizeDateTimeUTC, z.date()).optional(),
  status: z.enum(["PENDING", "STARTED", "COMPLETED", "CANCELLED"]).optional(),
  notes: z.string().max(1000).optional(),
});

// NozzleReading
export const createNozzleReadingSchema = z.object({
  operatorShiftId: z.string().cuid(),
  nozzleId: z.string().cuid(),
  readingType: z.enum(["OPEN", "CLOSE"]),
  totalizerReading: z.number().int().nonnegative(),
  pumpTest: z.number().int().nonnegative().default(0),
  priceSnapshot: z.number().int().positive(),
  imageUrl: z.union([
    z.string().url(),
    z.array(z.string().url())
  ]).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateNozzleReadingSchema = z.object({
  totalizerReading: z.number().int().nonnegative().optional(),
  pumpTest: z.number().int().nonnegative().optional(),
  priceSnapshot: z.number().int().positive().optional(),
  imageUrl: z.union([
    z.string().url(),
    z.array(z.string().url())
  ]).optional(),
  notes: z.string().max(1000).optional(),
});

// TankReading (untuk form input - tanpa approval manager)
export const createTankReadingSchema = z.object({
  tankId: z.string().min(1, "Tank ID is required"),
  literValue: zNumber(z.number().int().min(0, "Volume tidak boleh negatif").max(999999, "Volume terlalu besar")),
  imageUrl: z.union([
    z.string().min(1, "Foto bukti wajib diisi").url("Foto bukti harus berupa URL yang valid"),
    z.array(z.string().url("Foto bukti harus berupa URL yang valid")).min(1, "Foto bukti wajib diisi")
  ]),
  notes: z.string().max(1000, "Catatan maksimal 1000 karakter").optional(),
  timezoneOffset: z.number().optional(), // User timezone offset dalam menit (untuk convert UTC ke local time)
});

export const updateTankReadingSchema = z.object({
  literValue: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
  approverId: z.string().cuid().optional(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

// Unload
export const createUnloadSchema = z.object({
  tankId: z.string().cuid(),
  purchaseTransactionId: z.string().cuid().optional().nullable(), // Akan di-set saat approve (FIFO)
  initialOrderVolume: zNumber(z.number().int().min(0).optional().nullable()), // Legacy, tidak digunakan lagi
  deliveredVolume: zNumber(z.number().int().min(1, "Volume delivered harus lebih dari 0")), // Volume yang di-deliver (wajib untuk mengurangi LO)
  literAmount: zNumber(z.number().int().min(1, "Jumlah liter harus lebih dari 0")), // Real volume masuk tank
  invoiceNumber: z.string().max(100).optional(),
  imageUrl: z.union([
    z.string().min(1, "Foto bukti wajib diisi").url("Foto bukti harus berupa URL yang valid"),
    z.array(z.string().url("Foto bukti harus berupa URL yang valid")).min(1, "Foto bukti wajib diisi")
  ]),
  notes: z.string().max(1000).optional(),
}).refine((data) => {
  // literAmount harus <= deliveredVolume (real volume tidak boleh lebih dari delivered)
  if (data.deliveredVolume && data.deliveredVolume > 0) {
    return data.literAmount <= data.deliveredVolume;
  }
  return true;
}, {
  message: "Volume real tidak boleh lebih besar dari volume delivered",
  path: ["literAmount"],
});

export const updateUnloadSchema = z.object({
  literAmount: zNumber(z.number().int().positive().optional()),
  invoiceNumber: z.string().max(100).optional(),
  imageUrl: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

// Check In / Check Out (untuk operator shift actions)
export const checkInSchema = z.object({
  stationId: z.string().min(1),
  gasStationId: z.string().min(1),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  date: z.preprocess(normalizeDateUTC, z.date()),
});

export const checkOutSchema = z.object({
  operatorShiftId: z.string().min(1),
  notes: z.string().optional(),
});

// Bulk Nozzle Reading (untuk input reading sekaligus semua nozzle)
export const bulkCreateNozzleReadingSchema = z.object({
  operatorShiftId: z.string().min(1),
  readingType: z.enum(["OPEN", "CLOSE"]),
  readings: z
    .array(
      z.object({
        nozzleId: z.string().min(1),
        totalizerReading: z.number().int().min(0),
        pumpTest: z.number().int().min(0).default(0),
        priceSnapshot: z.number().int().min(0),
        imageUrl: z.union([
          z.string().url(),
          z.array(z.string().url())
        ]).optional(),
        notes: z.string().optional(),
      })
    )
    .min(1),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type BulkCreateNozzleReadingInput = z.infer<
  typeof bulkCreateNozzleReadingSchema
>;
