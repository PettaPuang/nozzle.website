import { prisma } from "@/lib/prisma";
import { format, differenceInDays } from "date-fns";
import {
  calculateDailyReconciliation,
  calculateTankStockByCalculation,
  calculateSalesFromNozzleReadings,
  calculatePumpTestFromNozzleReadings,
} from "@/lib/utils/tank-calculations";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  startOfMonthUTC,
  nowUTC,
} from "@/lib/utils/datetime";

export class TankHistoryService {
  /**
   * Calculate sales from completed shifts for a specific tank and date range
   */
  private static async calculateSalesFromShifts(
    tankId: string,
    startDate: Date,
    endDate?: Date
  ): Promise<number> {
    const whereClause: any = {
      nozzleReadings: {
        some: {
          nozzle: {
            tankId,
          },
        },
      },
      status: "COMPLETED",
      date: {
        gte: startOfDayUTC(startDate),
      },
      deposit: {
        status: "APPROVED", // Hanya shifts yang deposit-nya sudah APPROVED
      },
    };

    if (endDate) {
      whereClause.date.lte = endOfDayUTC(endDate);
    }

    const completedShifts = await prisma.operatorShift.findMany({
      where: whereClause,
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    let totalSales = 0;
    for (const shift of completedShifts) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      totalSales += shiftSales;
    }

    return totalSales;
  }

  /**
   * Calculate pump test from completed shifts for a specific tank and date range
   */
  private static async calculatePumpTestFromShifts(
    tankId: string,
    startDate: Date,
    endDate?: Date
  ): Promise<number> {
    const whereClause: any = {
      nozzleReadings: {
        some: {
          nozzle: {
            tankId,
          },
        },
      },
      status: "COMPLETED",
      date: {
        gte: startOfDayUTC(startDate),
      },
      deposit: {
        status: "APPROVED",
      },
    };

    if (endDate) {
      whereClause.date.lte = endOfDayUTC(endDate);
    }

    const completedShifts = await prisma.operatorShift.findMany({
      where: whereClause,
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    let totalPumpTest = 0;
    for (const shift of completedShifts) {
      const shiftPumpTest = calculatePumpTestFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          pumpTest: r.pumpTest,
        }))
      );
      totalPumpTest += shiftPumpTest;
    }

    return totalPumpTest;
  }

  /**
   * Get daily report for tank with reconciliation
   * Shows: Stock by reading, Stock by calculation, Sales, Variance
   * Default: current month (from 1st to end of month)
   */
  static async getTankDailyReport(
    tankId: string,
    startDateParam?: Date,
    endDateParam?: Date,
    days?: number
  ) {
    const endDate = endDateParam
      ? endOfDayUTC(endDateParam)
      : endOfDayUTC(nowUTC());

    // Default: current month (from 1st to today)
    let startDate: Date;
    let daysCount: number;

    if (startDateParam && endDateParam) {
      // Use specified date range
      startDate = startOfDayUTC(startDateParam);
      daysCount =
        differenceInDays(
          endOfDayUTC(endDateParam),
          startOfDayUTC(startDateParam)
        ) + 1;
    } else if (days !== undefined) {
      // Use specified days
      startDate = startOfDayUTC(addDaysUTC(endDate, -days));
      daysCount = days;
    } else {
      // Use current month
      startDate = startOfMonthUTC(endDate);
      daysCount = differenceInDays(endDate, startDate) + 1; // +1 to include today
    }

    // Fetch all data in parallel
    const [unloads, tankReadings] = await Promise.all([
      // Unloads
      // PENTING: Filter unload berdasarkan createdAt dalam range startDate sampai endDate
      // Jangan hanya >= startDate karena akan mengambil semua unload setelah startDate
      prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: startDate,
            lte: endDate, // Tambahkan batas atas untuk memastikan hanya unload dalam periode yang diambil
          },
        },
        select: {
          id: true,
          literAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // Tank Readings
      // PENTING: Gunakan date field (operational date) untuk konsistensi dengan snapshot
      // Filter berdasarkan date field, bukan createdAt, karena date adalah tanggal operasional
      prisma.tankReading.findMany({
        where: {
          tankId,
          approvalStatus: "APPROVED",
          date: {
            gte: startOfDayUTC(startDate),
            lte: endOfDayUTC(endDate),
          },
        },
        select: {
          id: true,
          literValue: true,
          createdAt: true,
          date: true, // Include date field for grouping
          stockRealtime: true, // Include snapshot for comparison
          variance: true, // Include snapshot variance
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    // Group data by date
    const dateMap = new Map<
      string,
      {
        date: Date;
        openingStock: number;
        tankReading: number | null;
        unloads: number;
        sales: number;
        pumpTest: number;
        salesDetails: Array<{
          nozzle: string;
          station: string;
          amount: number;
        }>;
        stockByCalculation: number;
        variance: number | null;
        totalVariance: number | null;
        estimatedLoss: number | null;
      }
    >();

    // Initialize dates
    for (let i = 0; i < daysCount; i++) {
      const date = addDaysUTC(endDate, -i);
      const dateKey = format(startOfDayUTC(date), "yyyy-MM-dd");

      dateMap.set(dateKey, {
        date: startOfDayUTC(date),
        openingStock: 0,
        tankReading: null,
        unloads: 0,
        sales: 0,
        pumpTest: 0,
        salesDetails: [],
        stockByCalculation: 0,
        variance: null,
        totalVariance: null,
        estimatedLoss: null,
      });
    }

    // Process tank readings - get latest reading per operational date
    // PENTING: Gunakan date field (operational date) bukan createdAt untuk konsistensi dengan snapshot
    const readingsByDate = new Map<string, (typeof tankReadings)[0] | null>();

    tankReadings.forEach((reading) => {
      // Use operational date (date field) instead of createdAt date
      const dateKey = format(startOfDayUTC(reading.date), "yyyy-MM-dd");

      // Keep the latest reading for each operational date (by createdAt within same operational date)
      if (
        !readingsByDate.has(dateKey) ||
        (readingsByDate.get(dateKey) &&
          reading.createdAt > readingsByDate.get(dateKey)!.createdAt)
      ) {
        readingsByDate.set(dateKey, reading);
      }
    });

    // Apply readings to records
    readingsByDate.forEach((reading, dateKey) => {
      const record = dateMap.get(dateKey);
      if (record && reading) {
        record.tankReading = reading.literValue;
      }
    });

    // Process unloads
    unloads.forEach((unload) => {
      const dateKey = format(startOfDayUTC(unload.createdAt), "yyyy-MM-dd");
      const record = dateMap.get(dateKey);

      if (record) {
        record.unloads += unload.literAmount;
      }
    });

    // Batch fetch all completed shifts for the date range once
    // Query berdasarkan nozzleReadings yang memiliki nozzle dengan tankId tersebut
    // Hanya include shifts yang deposit-nya sudah APPROVED (untuk memastikan sales hanya dihitung setelah approval)
    // Ini memastikan shifts lama tetap ditemukan meskipun nozzle sudah dipindahkan ke station lain
    // PENTING: Gunakan date (tanggal shift) bukan createdAt untuk konsistensi dengan transaksi dan deposit history
    const allCompletedShifts = await prisma.operatorShift.findMany({
      where: {
        nozzleReadings: {
          some: {
            nozzle: {
              tankId,
            },
          },
        },
        status: "COMPLETED",
        date: {
          gte: startOfDayUTC(startDate),
          lte: endOfDayUTC(endDate),
        },
        deposit: {
          status: "APPROVED", // Hanya shifts yang deposit-nya sudah APPROVED
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // Group shifts by date for efficient lookup
    const shiftsByDate = new Map<string, typeof allCompletedShifts>();
    allCompletedShifts.forEach((shift) => {
      const shiftDateKey = format(startOfDayUTC(shift.date), "yyyy-MM-dd");
      if (!shiftsByDate.has(shiftDateKey)) {
        shiftsByDate.set(shiftDateKey, []);
      }
      shiftsByDate.get(shiftDateKey)!.push(shift);
    });

    // Calculate sales and pump test per day using grouped shifts
    for (const dateKey of Array.from(dateMap.keys())) {
      const record = dateMap.get(dateKey)!;
      const dayShifts = shiftsByDate.get(dateKey) || [];

      // Calculate sales and pump test for this specific day from shifts
      let daySales = 0;
      let dayPumpTest = 0;
      for (const shift of dayShifts) {
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
        daySales += shiftSales;
        dayPumpTest += shiftPumpTest;
      }
      record.sales = daySales;
      record.pumpTest = dayPumpTest;
    }

    // Get tank initialStock and createdAt for fallback
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      select: { initialStock: true, createdAt: true },
    });
    const initialStock = tank ? tank.initialStock : 0;
    const tankCreatedAt = tank ? tank.createdAt : null;

    // Calculate stock by calculation and variances
    const sortedDates = Array.from(dateMap.keys()).sort();
    let previousTankStock: number | null = null; // Start with null, will be set based on tank creation date

    // Untuk tanggal pertama dalam range, hitung openingStock menggunakan getOpeningStockForDate
    // Ini memastikan openingStock dihitung dengan benar berdasarkan data sebelum tanggal tersebut
    // bukan hanya menggunakan initialStock
    if (sortedDates.length > 0) {
      const firstDateKey = sortedDates[0];
      const firstRecord = dateMap.get(firstDateKey)!;
      const firstRecordDate = startOfDayUTC(firstRecord.date);

      // Check if this date is before tank creation
      if (tankCreatedAt) {
        const tankCreatedDate = startOfDayUTC(tankCreatedAt);
        if (firstRecordDate >= tankCreatedDate) {
          // Import OperationalService untuk menghitung openingStock dengan benar
          const { OperationalService } = await import("./operational.service");
          try {
            previousTankStock = await OperationalService.getOpeningStockForDate(
              tankId,
              firstRecordDate
            );
          } catch (error) {
            // Fallback ke initialStock jika error
            previousTankStock = initialStock;
          }
        }
      } else {
        // No tank data, start with 0
        previousTankStock = 0;
      }
    }

    sortedDates.forEach((dateKey) => {
      const record = dateMap.get(dateKey)!;
      const recordDate = startOfDayUTC(record.date);

      // Check if this date is before tank creation
      if (tankCreatedAt) {
        const tankCreatedDate = startOfDayUTC(tankCreatedAt);
        if (recordDate < tankCreatedDate) {
          // This is before tank creation, set all values to 0/null and skip calculation
          record.openingStock = 0;
          record.tankReading = null;
          record.unloads = 0;
          record.sales = 0;
          record.pumpTest = 0;
          record.stockByCalculation = 0; // Set to 0 to indicate no tank existed yet
          record.variance = null;
          record.totalVariance = null;
          record.estimatedLoss = null;
          return; // Skip calculation for dates before tank creation
        }
      }

      // Jika previousTankStock masih null, set berdasarkan tank creation date
      if (previousTankStock === null && tankCreatedAt) {
        const tankCreatedDate = startOfDayUTC(tankCreatedAt);
        if (recordDate >= tankCreatedDate) {
          // This is the first day on or after tank creation, use initialStock
          previousTankStock = initialStock;
        }
      } else if (previousTankStock === null) {
        // No tank data, start with 0
        previousTankStock = 0;
      }

      // Assign openingStock sebelum reconciliation
      record.openingStock = previousTankStock ?? 0;

      // Use centralized calculation utility
      const reconciliation = calculateDailyReconciliation({
        tankStockYesterday: previousTankStock,
        unloads: record.unloads,
        sales: record.sales,
        pumpTest: record.pumpTest,
        tankReading: record.tankReading,
      });

      // Apply calculated values
      record.stockByCalculation = reconciliation.tankStockCalculation;
      record.variance = reconciliation.variance;
      record.totalVariance = reconciliation.totalVariance;
      record.estimatedLoss = reconciliation.estimatedLoss;

      // Update for next iteration
      // Priority: Tank Reading > Tank Stock Calculation
      if (record.tankReading !== null) {
        // If there's a tank reading, use it for next day's base
        previousTankStock = record.tankReading;
      } else {
        // If no tank reading, use calculated stock for next day's base
        previousTankStock = record.stockByCalculation;
      }
    });

    // Convert to array and reverse (newest first)
    const dailyReport = Array.from(dateMap.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    return dailyReport;
  }

  static async getTankDailyReportForClient(
    tankId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const report = await this.getTankDailyReport(tankId, startDate, endDate);

    // Convert dates to ISO strings for client
    return report.map((record) => ({
      ...record,
      date: record.date.toISOString(),
    }));
  }

  // Get summary statistics
  static async getTankSummary(tankId: string) {
    const now = nowUTC();
    const startOfMonth = startOfMonthUTC(now);
    const startToday = startOfDayUTC(now);
    const endToday = endOfDayUTC(now);

    // Parallel fetch: daily report, unload aggregate, titipan aggregate, sales, today readings, latest reading, tank info
    const [
      dailyReport,
      totalUnload,
      totalTitipan,
      totalSalesThisMonth,
      totalPumpTestThisMonth,
      todayReadings,
      latestReading,
      tank,
    ] = await Promise.all([
      // Get daily report for this month to calculate total variance
      this.getTankDailyReport(tankId, undefined, undefined, 30),
      // Total unload biasa this month (exclude titipan)
      prisma.unload.aggregate({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: startOfMonth,
          },
          OR: [
            {
              notes: null,
            },
            {
              notes: {
                not: {
                  contains: "Isi titipan dari",
                },
              },
            },
          ],
        },
        _sum: {
          literAmount: true,
        },
      }),
      // Total titipan this month
      prisma.unload.aggregate({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: startOfMonth,
          },
          notes: {
            contains: "Isi titipan dari",
          },
        },
        _sum: {
          literAmount: true,
        },
      }),
      // Total sales this month (from completed shifts)
      this.calculateSalesFromShifts(tankId, startOfMonth),
      // Total pump test this month (from completed shifts)
      this.calculatePumpTestFromShifts(tankId, startOfMonth),
      // Get today's readings
      prisma.tankReading.findMany({
        where: {
          tankId,
          approvalStatus: "APPROVED",
          createdAt: {
            gte: startToday,
            lte: endToday,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          literValue: true,
          createdAt: true,
        },
      }),
      // Get latest reading (reuse for both calculation and display)
      prisma.tankReading.findFirst({
        where: {
          tankId,
          approvalStatus: "APPROVED",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          literValue: true,
          createdAt: true,
        },
      }),
      // Get tank info
      prisma.tank.findUnique({
        where: { id: tankId },
        select: { initialStock: true, createdAt: true },
      }),
    ]);

    // Filter for current month only
    const thisMonthReport = dailyReport.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= startOfMonth;
    });

    // Sum total variance from daily report
    const totalVariance = thisMonthReport.reduce((sum, record) => {
      return sum + (record.totalVariance || 0);
    }, 0);

    const todayOpenReading = todayReadings.length > 0 ? todayReadings[0] : null;
    const todayCloseReading =
      todayReadings.length > 0 ? todayReadings[todayReadings.length - 1] : null;

    // Calculate REAL-TIME current stock
    let currentStock = 0;

    // Priority 1: Use today's CLOSE reading (most accurate)
    if (todayCloseReading) {
      currentStock = todayCloseReading.literValue;
    }
    // Priority 2: Calculate realtime if OPEN exists
    else if (todayOpenReading) {
      // Get today's unloads, sales, and pump test
      const [unloadsToday, salesToday, pumpTestToday] = await Promise.all([
        prisma.unload.aggregate({
          where: {
            tankId,
            status: "APPROVED",
            createdAt: {
              gte: startToday,
              lte: endToday,
            },
          },
          _sum: {
            literAmount: true,
          },
        }),
        // Calculate sales today from completed shifts
        this.calculateSalesFromShifts(tankId, startToday, endToday),
        // Calculate pump test today from completed shifts
        this.calculatePumpTestFromShifts(tankId, startToday, endToday),
      ]);

      const openStock = todayOpenReading.literValue;
      const unloads = unloadsToday._sum.literAmount || 0;
      const sales = salesToday;
      const pumpTest = pumpTestToday;

      currentStock = calculateTankStockByCalculation({
        stockOpen: openStock,
        unloads,
        sales,
        pumpTest,
      });
    }
    // Priority 3: Fallback to latest reading (any day) or initialStock
    else {
      if (latestReading) {
        // Get unloads, sales, and pump test since latest reading
        const [unloadsSinceReading, salesSinceReading, pumpTestSinceReading] = await Promise.all([
          prisma.unload.aggregate({
            where: {
              tankId,
              status: "APPROVED",
              createdAt: {
                gte: latestReading.createdAt,
              },
            },
            _sum: {
              literAmount: true,
            },
          }),
          this.calculateSalesFromShifts(tankId, latestReading.createdAt),
          this.calculatePumpTestFromShifts(tankId, latestReading.createdAt),
        ]);

        const lastStock = latestReading.literValue;
        const unloads = unloadsSinceReading._sum.literAmount || 0;
        const sales = salesSinceReading;
        const pumpTest = pumpTestSinceReading;

        currentStock = calculateTankStockByCalculation({
          stockOpen: lastStock,
          unloads,
          sales,
          pumpTest,
        });
      } else if (tank) {
        // No reading at all, use initialStock as base
        const salesStartDate = tank.createdAt || new Date(0);

        const [allUnloads, allSales, allPumpTest] = await Promise.all([
          prisma.unload.aggregate({
            where: {
              tankId,
              status: "APPROVED",
            },
            _sum: {
              literAmount: true,
            },
          }),
          this.calculateSalesFromShifts(tankId, salesStartDate),
          this.calculatePumpTestFromShifts(tankId, salesStartDate),
        ]);

        const initialStock = tank.initialStock;
        const unloads = allUnloads._sum.literAmount || 0;
        const sales = allSales;
        const pumpTest = allPumpTest;

        currentStock = calculateTankStockByCalculation({
          stockOpen: initialStock,
          unloads,
          sales,
          pumpTest,
        });
      }
    }

    return {
      currentStock,
      totalUnloadThisMonth: totalUnload._sum.literAmount || 0,
      totalTitipanThisMonth: totalTitipan._sum.literAmount || 0,
      totalSalesThisMonth,
      totalPumpTestThisMonth,
      totalVariance,
      latestReading: latestReading
        ? {
            literValue: latestReading.literValue,
            date: latestReading.createdAt,
          }
        : null,
    };
  }

  static async getTankSummaryForClient(tankId: string) {
    return await this.getTankSummary(tankId);
  }
}

export type TankDailyReportItem = Awaited<
  ReturnType<typeof TankHistoryService.getTankDailyReportForClient>
>[number];

export type TankSummary = Awaited<
  ReturnType<typeof TankHistoryService.getTankSummaryForClient>
>;
