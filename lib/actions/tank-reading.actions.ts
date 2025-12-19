"use server";

import { prisma } from "@/lib/prisma";
import {
  todayRangeUTC,
  startOfDayUTC,
  endOfDayUTC,
  nowUTC,
  getOperationalDateForTankReading,
} from "@/lib/utils/datetime";
import { format } from "date-fns";
import {
  createTankReadingSchema,
  updateTankReadingSchema,
} from "@/lib/validations/operational.validation";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import { hasPermission } from "@/lib/utils/permissions";
import type { z } from "zod";
import {
  createTankReadingLossTransaction,
  createTankReadingProfitTransaction,
} from "@/lib/utils/operational-transaction.utils";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createTankReading(
  input: z.infer<typeof createTankReadingSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
      "UNLOADER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createTankReadingSchema.parse(input);

    // 3. Check tank exists dengan product info dan gas station info
    const tank = await prisma.tank.findUnique({
      where: { id: validated.tankId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            purchasePrice: true,
          },
        },
        gasStation: {
          select: {
            id: true,
            openTime: true,
            closeTime: true,
          },
        },
      },
    });

    if (!tank) {
      return { success: false, message: "Tank not found" };
    }

    // 4. Authorization: Check user has access to this gas station
    const hasAccess = await prisma.userGasStation.findFirst({
      where: {
        gasStationId: tank.gasStationId,
        userId: user!.id,
        status: "ACTIVE",
      },
    });

    if (
      !hasAccess &&
      !hasPermission(user!.roleCode as any, ["DEVELOPER", "ADMINISTRATOR"])
    ) {
      return {
        success: false,
        message: "You don't have access to this gas station",
      };
    }

    // 5. Tentukan tanggal operasional untuk reading ini
    // Tank reading dilakukan di luar jam operasional untuk menutup operasional hari sebelumnya
    const serverTime = nowUTC(); // Server time (bisa UTC atau timezone lain)
    const timezoneOffset = validated.timezoneOffset || 0; // Dari client dalam menit
    
    // Convert ke waktu lokal user
    // timezoneOffset negatif untuk timezone di depan UTC (misal: WIB = -420)
    // Formula: userLocalTime = serverTime - timezoneOffset
    const readingCreatedAt = new Date(
      serverTime.getTime() - (timezoneOffset * 60000)
    );
    
    const operationalDate = getOperationalDateForTankReading(
      readingCreatedAt,
      tank.gasStation.openTime,
      tank.gasStation.closeTime
    );

    // Check if there's already a reading for this tank on the same operational date (hanya PENDING atau APPROVED)
    // REJECTED bisa diinput ulang
    const existingReading = await prisma.tankReading.findFirst({
      where: {
        tankId: validated.tankId,
        date: operationalDate,
        approvalStatus: {
          in: ["PENDING", "APPROVED"],
        },
      },
    });

    if (existingReading) {
      return {
        success: false,
        message: `Reading untuk tank ini sudah diinput untuk tanggal operasional ${
          operationalDate.toISOString().split("T")[0]
        }`,
      };
    }

    // 6. Calculate snapshot values untuk konsistensi data
    // Menghitung stockOpen (stock awal) dan stockRealtime (realtime stock saat ini)
    const { OperationalService } = await import(
      "@/lib/services/operational.service"
    );
    const { TankReadingService } = await import(
      "@/lib/services/tank-reading.service"
    );

    // Hitung stockOpen dan stockRealtime: KONSISTEN DENGAN TANK HISTORY
    // stockOpen = stock awal tanggal operasional yang ditutup oleh reading ini
    // Menggunakan OperationalService.getOpeningStockForDate untuk konsistensi dengan Tank History
    // Logika: Stock Awal = Stock Closing hari sebelumnya (Reading kemarin ATAU Stock Realtime kemarin)
    // KONSISTEN DENGAN TANK HISTORY: Gunakan tank history service dengan range yang sama dengan UI
    // UI query dengan range 30 hari terakhir, jadi kita perlu query dengan range yang cukup
    // untuk mendapatkan opening stock yang konsisten dengan perhitungan iteratif
    let stockOpen: number;
    try {
      // Query tank history dengan range yang cukup (30 hari terakhir seperti UI)
      // Ini memastikan opening stock dihitung secara iteratif dari awal range
      // sama seperti yang ditampilkan di tank history table
      const todayLocalUTC = new Date();
      todayLocalUTC.setUTCHours(0, 0, 0, 0);
      const rangeStart = new Date(todayLocalUTC);
      rangeStart.setDate(rangeStart.getDate() - 29); // 30 hari terakhir
      
      const { TankHistoryService } = await import("@/lib/services/tank-history.service");
      const dailyReport = await TankHistoryService.getTankDailyReportForClient(
        validated.tankId,
        rangeStart,
        operationalDate
      );

      // Cari record untuk operational date
      const record = dailyReport.find((r) => {
        const recordDate = new Date(r.date);
        const targetDate = startOfDayUTC(operationalDate);
        return format(recordDate, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
      });

      if (record) {
        stockOpen = record.openingStock;
      } else {
        // Fallback ke getOpeningStockForDate jika tidak ada record
        stockOpen = await OperationalService.getOpeningStockForDate(
          validated.tankId,
          operationalDate
        );
      }
    } catch (error) {
      // Fallback jika error
      console.error("Error getting opening stock:", error);
      try {
        stockOpen = await OperationalService.getOpeningStockForDate(
          validated.tankId,
          operationalDate
        );
      } catch (fallbackError) {
        const latestReadingBefore = await prisma.tankReading.findFirst({
          where: {
            tankId: validated.tankId,
            approvalStatus: "APPROVED",
            date: {
              lt: operationalDate,
            },
          },
          orderBy: { date: "desc" },
          select: { literValue: true, date: true },
        });

        if (latestReadingBefore) {
          stockOpen = latestReadingBefore.literValue;
        } else {
          stockOpen = tank.initialStock || 0;
        }
      }
    }

    // Hitung stockRealtime: realtime stock saat reading dibuat
    // KONSISTEN DENGAN TANK HISTORY: Gunakan date (tanggal operasional) untuk semua perhitungan
    // Unloads dan sales dihitung untuk tanggal operasional reading ini saja (hari ini)
    let stockRealtime: number;

    // KONSISTEN DENGAN TANK HISTORY:
    // - Unloads: filter berdasarkan createdAt dalam range tanggal operasional hari ini
    // - Sales: filter berdasarkan date (tanggal shift) dalam range tanggal operasional hari ini
    const yesterdayDate = new Date(operationalDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayDateUTC = startOfDayUTC(yesterdayDate);
    const currentReadingDateStart = startOfDayUTC(operationalDate);
    const currentReadingDateEnd = endOfDayUTC(operationalDate);

    // KONSISTEN DENGAN TANK HISTORY: Filter unloads berdasarkan createdAt dalam range tanggal operasional hari ini
    // Unloads tidak punya field date, jadi tetap pakai createdAt tapi filter berdasarkan tanggal operasional
    const unloadsSinceBase = await prisma.unload.findMany({
      where: {
        tankId: validated.tankId,
        status: "APPROVED",
        createdAt: {
          gte: currentReadingDateStart,
          lte: currentReadingDateEnd,
        },
      },
      select: { literAmount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // KONSISTEN DENGAN TANK HISTORY: Filter sales berdasarkan date (tanggal shift) untuk tanggal operasional hari ini saja
    const shiftsSinceBase = await prisma.operatorShift.findMany({
      where: {
        gasStationId: tank.gasStationId,
        status: "COMPLETED",
        deposit: {
          status: "APPROVED",
        },
        // Gunakan date (tanggal shift) untuk konsistensi dengan transaksi dan deposit history
        // Ambil shifts dengan tanggal = tanggal operasional reading ini (hari ini)
        date: {
          gte: currentReadingDateStart,
          lte: currentReadingDateEnd,
        },
        nozzleReadings: {
          some: {
            nozzle: { tankId: validated.tankId },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: { tankId: validated.tankId },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "asc" },
    });

    const {
      calculateTankStockByCalculation,
      calculateSalesFromNozzleReadings,
      calculatePumpTestFromNozzleReadings,
    } = await import("@/lib/utils/tank-calculations");

    // KONSISTEN DENGAN TANK HISTORY: Hitung sales dan pumpTest secara terpisah
    // Sales sudah dikurangi pumpTest di dalam calculateSalesFromNozzleReadings
    // Tapi pumpTest juga perlu dikurangi secara terpisah di calculateTankStockByCalculation
    let salesSinceBase = 0;
    let pumpTestSinceBase = 0;
    
    for (const shift of shiftsSinceBase) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      const shiftPumpTest = calculatePumpTestFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          pumpTest: r.pumpTest,
        }))
      );
      salesSinceBase += shiftSales;
      pumpTestSinceBase += shiftPumpTest;
    }

    const unloadsTotal = unloadsSinceBase.reduce(
      (sum, u) => sum + u.literAmount,
      0
    );

    // Gunakan stockOpen yang sudah dihitung dengan getOpeningStockForDate (konsisten dengan Tank History)
    // KONSISTEN DENGAN TANK HISTORY: Include pumpTest sebagai parameter terpisah
    stockRealtime = calculateTankStockByCalculation({
      stockOpen: stockOpen,
      unloads: unloadsTotal,
      sales: salesSinceBase,
      pumpTest: pumpTestSinceBase,
    });

    // Hitung variance
    const tankReadingValue = validated.literValue;
    const variance = tankReadingValue - stockRealtime;

    // Simpan variance di notes dengan format khusus untuk backward compatibility
    // Format: [VAR:123.45] di akhir notes
    const varianceMarker = `[VAR:${variance.toFixed(2)}]`;
    const notesWithVariance = validated.notes
      ? `${validated.notes} ${varianceMarker}`
      : varianceMarker;

    // 7. Database insert - simpan snapshot values untuk konsistensi data
    // Convert imageUrl array to comma-separated string if needed
    const imageUrlString = Array.isArray(validated.imageUrl)
      ? validated.imageUrl.join(",")
      : validated.imageUrl;

    let tankReading;
    await prisma.$transaction(async (tx) => {
      tankReading = await tx.tankReading.create({
        data: {
          tankId: validated.tankId,
          literValue: validated.literValue, // Sudah Int
          imageUrl: imageUrlString,
          notes: notesWithVariance, // Simpan variance di notes untuk backward compatibility
          loaderId: user!.id,
          approvalStatus: "PENDING", // Perlu approval manager
          createdById: user!.id,
          // Snapshot fields untuk konsistensi data
          date: operationalDate, // Tanggal operasional yang ditutup oleh reading ini (bukan tanggal saat dibuat)
          stockOpen: Math.round(stockOpen), // Stock awal tanggal operasional yang ditutup (bulat)
          stockRealtime: Math.round(stockRealtime), // Realtime stock saat reading dibuat (bulat)
          variance: Math.round(variance), // Variance yang sudah dihitung (bulat)
        },
      });

      // Tidak ada transaksi atau perubahan stock di sini
      // Semua akan dilakukan saat approve
    });

    // 8. Cache invalidation
    revalidatePath(`/gas-stations/${tank.gasStationId}`);
    revalidatePath(`/gas-stations/${tank.gasStationId}/tank-history`);

    return {
      success: true,
      message: "Tank reading berhasil disimpan",
      data: {
        id: tankReading!.id,
        literValue: validated.literValue,
        variance,
      },
    };
  } catch (error) {
    console.error("createTankReading error:", error);
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to create tank reading" };
  }
}

export async function updateTankReading(
  id: string,
  input: z.infer<typeof updateTankReadingSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = updateTankReadingSchema.parse(input);

    // 3. Check reading exists
    const reading = await prisma.tankReading.findUnique({
      where: { id },
      include: {
        tank: { select: { gasStationId: true } },
      },
    });

    if (!reading) {
      return { success: false, message: "Tank reading not found" };
    }

    // 4. Database update + Audit trail
    const updated = await prisma.tankReading.update({
      where: { id },
      data: {
        ...validated,
        literValue: validated.literValue, // Sudah Int
        updatedById: user!.id,
      },
    });

    // 5. Cache invalidation
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}`);
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}/tank-history`);

    return {
      success: true,
      message: "Tank reading updated successfully",
      data: updated,
    };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to update tank reading" };
  }
}

export async function approveTankReading(
  id: string,
  approved: boolean
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (manager role)
    const { authorized, user, message } = await checkPermission([
      "MANAGER",
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Get tank reading dengan tank dan product info
    const reading = await prisma.tankReading.findUnique({
      where: { id },
      include: {
        tank: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
              },
            },
            gasStation: {
              select: {
                id: true,
                openTime: true,
                closeTime: true,
              },
            },
          },
        },
      },
    });

    if (!reading) {
      return { success: false, message: "Tank reading not found" };
    }

    // 3. Validasi: Cek apakah sudah pernah diproses
    if (reading.approvalStatus !== "PENDING") {
      return {
        success: false,
        message: `Tank reading sudah ${
          reading.approvalStatus === "APPROVED" ? "approved" : "rejected"
        } sebelumnya`,
      };
    }

    // 4. Ambil variance yang sudah dihitung saat input (dari snapshot field atau notes)
    // Priority: gunakan snapshot field jika ada, fallback ke notes untuk backward compatibility
    let variance: number = 0;

    if (reading.variance !== null && reading.variance !== undefined) {
      // Gunakan variance dari snapshot field (data baru)
      variance = reading.variance; // Sudah Int
    } else {
      // Fallback: ambil dari notes untuk backward compatibility dengan data lama
      const varianceMatch = reading.notes?.match(/\[VAR:([-\d.]+)\]/);

      if (varianceMatch) {
        variance = parseFloat(varianceMatch[1]);
      } else {
        // Fallback terakhir: hitung ulang dengan realtime saat input
        // Ini untuk backward compatibility dengan data lama yang tidak punya snapshot
        // Gunakan date field untuk konsistensi jika ada
        const readingDate = reading.date || reading.createdAt;
        const latestReadingBefore = await prisma.tankReading.findFirst({
          where: {
            tankId: reading.tankId,
            approvalStatus: "APPROVED",
            date: {
              lt: readingDate, // Gunakan date jika ada, fallback ke createdAt
            },
          },
          orderBy: {
            date: "desc", // Order by date untuk konsistensi
            createdAt: "desc", // Secondary sort
          },
          select: {
            literValue: true,
            date: true,
            createdAt: true,
          },
        });

        let stockForVariance: number;

        if (latestReadingBefore) {
          const {
            calculateTankStockByCalculation,
            calculateSalesFromNozzleReadings,
          } = await import("@/lib/utils/tank-calculations");

          const unloadsSinceBase = await prisma.unload.findMany({
            where: {
              tankId: reading.tankId,
              status: "APPROVED",
              createdAt: {
                gte: latestReadingBefore.createdAt,
                lte: reading.createdAt,
              },
            },
            select: { literAmount: true },
          });

          const shiftsSinceBase = await prisma.operatorShift.findMany({
            where: {
              gasStationId: reading.tank.gasStationId,
              status: "COMPLETED",
              deposit: {
                status: "APPROVED",
              },
              createdAt: {
                gte: latestReadingBefore.createdAt,
                lte: reading.createdAt,
              },
              nozzleReadings: {
                some: {
                  nozzle: { tankId: reading.tankId },
                },
              },
            },
            include: {
              nozzleReadings: {
                where: {
                  nozzle: { tankId: reading.tankId },
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          });

          let salesSinceBase = 0;
          for (const shift of shiftsSinceBase) {
            const shiftSales = calculateSalesFromNozzleReadings(
              shift.nozzleReadings.map((r) => ({
                nozzleId: r.nozzleId,
                readingType: r.readingType,
                literValue: r.totalizerReading,
                pumpTest: r.pumpTest,
              }))
            );
            salesSinceBase += shiftSales;
          }

          const unloadsTotal = unloadsSinceBase.reduce(
            (sum, u) => sum + u.literAmount,
            0
          );

          stockForVariance = calculateTankStockByCalculation({
            stockOpen: latestReadingBefore.literValue,
            unloads: unloadsTotal,
            sales: salesSinceBase,
          });
        } else {
          const { OperationalService } = await import(
            "@/lib/services/operational.service"
          );
          stockForVariance = await OperationalService.getOpeningStockForDate(
            reading.tankId,
            reading.createdAt
          );
        }

        variance = reading.literValue - stockForVariance;
      }
    }

    // 5. Update status dan trigger transaction HANYA jika approved
    // Jika rejected, hanya update status saja, tidak ada perubahan apapun
    await prisma.$transaction(async (tx) => {
      // Update status
      await tx.tankReading.update({
        where: { id },
        data: {
          approvalStatus: approved ? "APPROVED" : "REJECTED",
          approverId: user!.id,
          updatedById: user!.id,
        },
      });

      // HANYA jika approved: buat transaction loss/profit
      // Transaksi ini akan mempengaruhi stock di tank dan history
      // Threshold 1 liter karena menggunakan Int (bulat)
      if (approved && Math.abs(variance) >= 1) {
        const purchasePrice = reading.tank.product.purchasePrice;

        if (variance < 0) {
          // Loss: Debit Susut, Credit Persediaan
          await createTankReadingLossTransaction({
            tankReadingId: id,
            gasStationId: reading.tank.gasStationId,
            productName: reading.tank.product.name,
            lossAmount: Math.abs(variance),
            purchasePrice,
            createdById: user!.id,
            tx,
          });
        } else if (variance > 0) {
          // Profit: Debit Persediaan, Credit COGS
          await createTankReadingProfitTransaction({
            tankReadingId: id,
            gasStationId: reading.tank.gasStationId,
            productName: reading.tank.product.name,
            profitAmount: variance,
            purchasePrice,
            createdById: user!.id,
            tx,
          });
        }
      }
      // Jika rejected: tidak ada transaksi, tidak ada perubahan stock
    });

    // 6. Cache invalidation
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}`);
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}/tank-history`);

    return {
      success: true,
      message: `Tank reading berhasil ${approved ? "disetujui" : "ditolak"}`,
    };
  } catch (error) {
    console.error("approveTankReading error:", error);
    return {
      success: false,
      message: `Failed to ${approved ? "approve" : "reject"} tank reading`,
    };
  }
}

export async function getPendingTankReadings(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized, message } = await checkPermissionWithGasStation(
      ["MANAGER", "ADMINISTRATOR"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message };
    }

    const { TankReadingService } = await import(
      "@/lib/services/tank-reading.service"
    );
    const readings = await TankReadingService.findPendingByGasStation(
      gasStationId
    );

    return {
      success: true,
      message: "Pending tank readings retrieved successfully",
      data: readings,
    };
  } catch (error) {
    console.error("Get pending tank readings error:", error);
    return {
      success: false,
      message: "Failed to retrieve pending tank readings",
    };
  }
}

export async function getTankReadingHistory(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized, message } = await checkPermissionWithGasStation(
      ["MANAGER", "ADMINISTRATOR"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message };
    }

    const { TankReadingService } = await import(
      "@/lib/services/tank-reading.service"
    );
    const readings = await TankReadingService.findHistoryByGasStation(
      gasStationId
    );

    return {
      success: true,
      message: "Tank reading history retrieved successfully",
      data: readings,
    };
  } catch (error) {
    console.error("Get tank reading history error:", error);
    return {
      success: false,
      message: "Failed to retrieve tank reading history",
    };
  }
}

export async function hasPendingTankReadingByTank(
  tankId: string
): Promise<ActionResult> {
  try {
    // Cek permission - minimal UNLOADER untuk bisa input tank reading
    const { authorized, message } = await checkPermission([
      "UNLOADER",
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    const { TankReadingService } = await import(
      "@/lib/services/tank-reading.service"
    );
    const hasPending = await TankReadingService.hasPendingByTank(tankId);

    return {
      success: true,
      message: "Pending tank reading check completed",
      data: { hasPending },
    };
  } catch (error) {
    console.error("Has pending tank reading error:", error);
    return {
      success: false,
      message: "Failed to check pending tank reading",
    };
  }
}

export async function canInputTankReadingToday(
  tankId: string
): Promise<ActionResult> {
  try {
    // Cek permission - minimal UNLOADER untuk bisa input tank reading
    const { authorized, message } = await checkPermission([
      "UNLOADER",
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // Ambil info tank dengan gas station untuk mendapatkan openTime dan closeTime
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      select: {
        gasStation: {
          select: {
            openTime: true,
            closeTime: true,
          },
        },
      },
    });

    if (!tank) {
      return { success: false, message: "Tank not found" };
    }

    const { TankReadingService } = await import(
      "@/lib/services/tank-reading.service"
    );
    const hasReadingToday = await TankReadingService.hasTankReadingToday(
      tankId,
      tank.gasStation.openTime,
      tank.gasStation.closeTime
    );

    return {
      success: true,
      message: "Tank reading today check completed",
      data: { canInput: !hasReadingToday, hasReadingToday },
    };
  } catch (error) {
    console.error("Can input tank reading today error:", error);
    return {
      success: false,
      message: "Failed to check tank reading today",
    };
  }
}

export async function deleteTankReading(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, message } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Check reading exists
    const reading = await prisma.tankReading.findUnique({
      where: { id },
      include: {
        tank: { select: { gasStationId: true } },
      },
    });

    if (!reading) {
      return { success: false, message: "Tank reading not found" };
    }

    // 3. Database delete
    await prisma.tankReading.delete({
      where: { id },
    });

    // 4. Cache invalidation
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}`);
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}/tank-history`);

    return { success: true, message: "Tank reading deleted successfully" };
  } catch (error) {
    return { success: false, message: "Failed to delete tank reading" };
  }
}
