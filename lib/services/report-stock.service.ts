import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC, addDaysUTC } from "@/lib/utils/datetime";
import { TankHistoryService } from "./tank-history.service";

export class ReportStockService {
  /**
   * Get stock report - Using data from TankHistoryService for consistency
   */
  static async getStockReport(
    gasStationId: string,
    startDate: Date,
    endDate: Date
  ) {
    const startDateTime = startOfDayUTC(startDate);
    const endDateTime = endOfDayUTC(endDate);

    const tanks = await prisma.tank.findMany({
      where: { gasStationId },
      select: {
        id: true,
        name: true,
        code: true,
        capacity: true,
        initialStock: true,
        createdAt: true,
        productId: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Batch fetch daily reports for all tanks in parallel
    const reportStartDate = addDaysUTC(startDateTime, -1);
    const tankDailyReportsMap = new Map<
      string,
      Awaited<ReturnType<typeof TankHistoryService.getTankDailyReport>>
    >();

    await Promise.all(
      tanks.map(async (tank) => {
        const dailyReport = await TankHistoryService.getTankDailyReport(
          tank.id,
          reportStartDate,
          endDateTime
        );
        tankDailyReportsMap.set(tank.id, dailyReport);
      })
    );

    const tankReports = await Promise.all(
      tanks.map(async (tank) => {
        // Get daily report from map
        const dailyReport = tankDailyReportsMap.get(tank.id)!;

        // Filter records within date range
        const periodRecords = dailyReport.filter((record) => {
          const recordDate = new Date(record.date);
          return recordDate >= startDateTime && recordDate <= endDateTime;
        });

        if (periodRecords.length === 0) {
          // No data in this period, use initialStock
          const initialStock = tank.initialStock;
          return {
            tankId: tank.id,
            tankName: tank.name,
            productId: tank.productId,
            productName: tank.product.name,
            capacity: tank.capacity,
            openingStock: initialStock,
            totalUnload: 0,
            totalSales: 0,
            totalPumpTest: 0,
            totalOut: 0,
            closingStock: initialStock,
            totalVariance: 0,
            fillPercentage: (initialStock / tank.capacity) * 100,
          };
        }

        // Sort by date (oldest first)
        const sortedRecords = [...periodRecords].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Filter hanya records yang benar-benar punya data
        const recordsWithData = sortedRecords.filter((record) => {
          return (
            record.tankReading !== null ||
            record.unloads > 0 ||
            record.sales > 0 ||
            record.pumpTest > 0 ||
            record.stockByCalculation > 0
          );
        });

        // Opening stock
        let openingStock: number = tank.initialStock;

        if (recordsWithData.length > 0) {
          const firstRecordWithData = recordsWithData[0];
          openingStock = firstRecordWithData.openingStock;
        } else if (sortedRecords.length > 0) {
          openingStock = sortedRecords[0].openingStock;
        }

        // Closing stock
        let closingStock: number = tank.initialStock;

        if (recordsWithData.length > 0) {
          const lastRecord = recordsWithData[recordsWithData.length - 1];
          closingStock =
            lastRecord.tankReading ?? lastRecord.stockByCalculation;
        }

        // Sum totals from all records in period
        const totalUnload = periodRecords.reduce(
          (sum, r) => sum + (r.unloads || 0),
          0
        );
        const totalSales = periodRecords.reduce(
          (sum, r) => sum + (r.sales || 0),
          0
        );
        const totalPumpTest = periodRecords.reduce(
          (sum, r) => sum + (r.pumpTest || 0),
          0
        );
        const totalOut = totalSales + totalPumpTest;

        // Total variance
        const totalVariance = periodRecords.reduce(
          (sum, r) => sum + (r.totalVariance ?? 0),
          0
        );

        const fillPercentage = (closingStock / tank.capacity) * 100;

        return {
          tankId: tank.id,
          tankName: tank.name,
          productId: tank.productId,
          productName: tank.product.name,
          capacity: tank.capacity,
          openingStock,
          totalUnload,
          totalSales,
          totalPumpTest,
          totalOut,
          closingStock,
          totalVariance,
          fillPercentage,
        };
      })
    );

    const summary = {
      totalCapacity: tankReports.reduce((sum, t) => sum + t.capacity, 0),
      totalOpeningStock: tankReports.reduce(
        (sum, t) => sum + t.openingStock,
        0
      ),
      totalUnload: tankReports.reduce((sum, t) => sum + t.totalUnload, 0),
      totalSales: tankReports.reduce((sum, t) => sum + t.totalSales, 0),
      totalPumpTest: tankReports.reduce((sum, t) => sum + t.totalPumpTest, 0),
      totalOut: tankReports.reduce((sum, t) => sum + t.totalOut, 0),
      totalClosingStock: tankReports.reduce(
        (sum, t) => sum + t.closingStock,
        0
      ),
      totalVariance: tankReports.reduce((sum, t) => sum + t.totalVariance, 0),
    };

    return {
      tanks: tankReports,
      summary,
    };
  }
}
