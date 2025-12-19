import { prisma } from "@/lib/prisma";
import {
  startOfDayUTC,
  todayRangeUTC,
  endOfDayUTC,
  getOperationalDateForTankReading,
  nowUTC,
} from "@/lib/utils/datetime";
import {
  calculateTankStockByCalculation,
  calculateSalesFromNozzleReadings,
} from "@/lib/utils/tank-calculations";

export class TankReadingService {
  /**
   * Calculate realtime stock for a reading at the time it was created
   */
  private static async calculateRealtimeStockForReading(
    tankId: string,
    gasStationId: string,
    readingCreatedAt: Date
  ): Promise<number> {
    // Get latest reading before this reading
    const latestReadingBefore = await prisma.tankReading.findFirst({
      where: {
        tankId,
        approvalStatus: "APPROVED",
        createdAt: {
          lt: readingCreatedAt,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        literValue: true,
        createdAt: true,
      },
    });

    if (latestReadingBefore) {
      // Calculate from latest reading + unloads - sales
      const unloadsSinceBase = await prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: latestReadingBefore.createdAt,
            lte: readingCreatedAt,
          },
        },
        select: { literAmount: true },
      });

      const shiftsSinceBase = await prisma.operatorShift.findMany({
        where: {
          gasStationId,
          status: "COMPLETED",
          deposit: {
            status: "APPROVED",
          },
          createdAt: {
            gte: latestReadingBefore.createdAt,
            lte: readingCreatedAt,
          },
          nozzleReadings: {
            some: {
              nozzle: { tankId },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: { tankId },
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

      return calculateTankStockByCalculation({
        stockOpen: latestReadingBefore.literValue,
        unloads: unloadsTotal,
        sales: salesSinceBase,
      });
    } else {
      // No reading before, use initialStock + unloads - sales
      const tank = await prisma.tank.findUnique({
        where: { id: tankId },
        select: { initialStock: true },
      });

      const unloadsSinceBase = await prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            lte: readingCreatedAt,
          },
        },
        select: { literAmount: true },
      });

      const shiftsSinceBase = await prisma.operatorShift.findMany({
        where: {
          gasStationId,
          status: "COMPLETED",
          deposit: {
            status: "APPROVED",
          },
          createdAt: {
            lte: readingCreatedAt,
          },
          nozzleReadings: {
            some: {
              nozzle: { tankId },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: { tankId },
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

      return calculateTankStockByCalculation({
        stockOpen: tank?.initialStock || 0,
        unloads: unloadsTotal,
        sales: salesSinceBase,
      });
    }
  }

  static async findByGasStation(gasStationId: string, approvalStatus?: string) {
    const readings = await prisma.tankReading.findMany({
      where: {
        tank: {
          gasStationId,
        },
        ...(approvalStatus && {
          approvalStatus: approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
        }),
      },
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
          },
        },
        loader: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
    });

    return readings;
  }

  static async findByGasStationForClient(
    gasStationId: string,
    approvalStatus?: string
  ) {
    const readings = await this.findByGasStation(gasStationId, approvalStatus);

    // Gunakan snapshot stockRealtime jika ada, jika tidak baru hitung ulang
    const readingsWithRealtime = await Promise.all(
      readings.map(async (reading) => {
        if (!reading.tank) {
          throw new Error(`Tank not found for reading ${reading.id}`);
        }
        
        // Priority: gunakan snapshot stockRealtime jika ada (data baru)
        // Fallback: hitung ulang untuk backward compatibility dengan data lama
        let realtimeStock: number;
        if (reading.stockRealtime !== null && reading.stockRealtime !== undefined) {
          realtimeStock = reading.stockRealtime;
        } else {
          // Fallback: hitung ulang untuk data lama yang tidak punya snapshot
          realtimeStock = await this.calculateRealtimeStockForReading(
            reading.tankId,
            reading.tank.gasStationId,
            reading.createdAt
          );
        }

        // Hapus marker variance dari notes untuk ditampilkan
        const cleanNotes =
          reading.notes?.replace(/\s*\[VAR:[-\d.]+\]\s*/g, "").trim() || null;

        return {
          ...reading,
          literValue: reading.literValue,
          realtimeStock,
          stockOpen: reading.stockOpen, // Include stockOpen snapshot
          notes: cleanNotes, // Notes tanpa marker variance
          createdAt: reading.createdAt.toISOString(),
          updatedAt: reading.updatedAt.toISOString(),
        };
      })
    );

    return readingsWithRealtime;
  }

  static async findPendingByGasStation(gasStationId: string) {
    return this.findByGasStationForClient(gasStationId, "PENDING");
  }

  static async countPendingByGasStation(gasStationId: string) {
    return await prisma.tankReading.count({
      where: {
        tank: {
          gasStationId,
        },
        approvalStatus: "PENDING",
      },
    });
  }

  static async hasPendingByTank(tankId: string): Promise<boolean> {
    const count = await prisma.tankReading.count({
      where: {
        tankId,
        approvalStatus: "PENDING",
      },
    });
    return count > 0;
  }

  static async hasTankReadingToday(
    tankId: string,
    openTime: string | null,
    closeTime: string | null
  ): Promise<boolean> {
    // Hitung tanggal operasional hari ini berdasarkan waktu saat ini dan jam operasional
    const now = nowUTC();
    const operationalDateToday = getOperationalDateForTankReading(
      now,
      openTime,
      closeTime
    );

    const count = await prisma.tankReading.count({
      where: {
        tankId,
        date: operationalDateToday, // Gunakan tanggal operasional hari ini, bukan tanggal UTC
        approvalStatus: {
          in: ["PENDING", "APPROVED"], // Hanya cek PENDING dan APPROVED, REJECTED bisa diinput ulang
        },
      },
    });
    return count > 0;
  }

  static async findHistoryByGasStation(gasStationId: string) {
    // Ambil yang APPROVED dan REJECTED untuk history
    const approvedReadings = await this.findByGasStationForClient(
      gasStationId,
      "APPROVED"
    );
    const rejectedReadings = await this.findByGasStationForClient(
      gasStationId,
      "REJECTED"
    );

    // Gabungkan dan urutkan berdasarkan createdAt (terbaru dulu)
    const allReadings = [...approvedReadings, ...rejectedReadings];
    return allReadings.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export type TankReadingWithRelations = Awaited<
  ReturnType<typeof TankReadingService.findByGasStation>
>[number];
