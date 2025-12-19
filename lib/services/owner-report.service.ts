import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";
import { FinancialReportService } from "./financial-report.service";
import { IncomeReportService } from "./income-report.service";

export type OwnerReportSummary = {
  gasStations: Array<{
    id: string;
    name: string;
    totalSales: number; // Total penjualan BBM
    hpp: number; // Harga Pokok Penjualan
    grossProfit: number; // Laba kotor (Total Sales - Total HPP)
    totalExpenses: number; // Pengeluaran (expenses)
    netProfit: number; // Laba bersih (grossProfit - totalExpenses)
    margin: number; // Margin (%)
    contribution: number; // Kontribusi (%)
  }>;
  totals: {
    totalSales: number;
    totalHpp: number;
    totalGrossProfit: number;
    totalExpenses: number;
    totalNetProfit: number;
  };
};

export class OwnerReportService {
  /**
   * Get owner report summary (rekap semua gas station milik owner)
   * Optimized version - batch query untuk semua gas stations sekaligus
   */
  static async getOwnerReportSummary(
    ownerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OwnerReportSummary> {
    const startDateTime = startOfDayUTC(startDate);
    const endDateTime = endOfDayUTC(endDate);

    // Get all gas stations owned by owner
    const gasStations = await prisma.gasStation.findMany({
      where: {
        ownerId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (gasStations.length === 0) {
      return {
        gasStations: [],
        totals: {
          totalSales: 0,
          totalHpp: 0,
          totalGrossProfit: 0,
          totalExpenses: 0,
          totalNetProfit: 0,
        },
      };
    }

    const gasStationIds = gasStations.map((gs) => gs.id);

    // Batch query: Get all expenses untuk semua gas stations sekaligus
    const expenseJournalEntries = await prisma.journalEntry.findMany({
      where: {
        transaction: {
          gasStationId: { in: gasStationIds },
          approvalStatus: "APPROVED",
          date: {
            gte: startDateTime,
            lte: endDateTime,
          },
        },
        coa: {
          category: "EXPENSE",
        },
      },
      select: {
        transaction: {
          select: {
            gasStationId: true,
          },
        },
        coa: {
          select: {
            name: true,
          },
        },
        debit: true,
        credit: true,
      },
    });

    // Calculate sales per gas station menggunakan FinancialReportService
    // Ini konsisten dengan income-table.tsx yang menggunakan financial-report.service.ts
    // FinancialReportService sudah menghitung purchasePrice berdasarkan tanggal transaksi (adjustment history)
    const salesByGasStation = new Map<
      string,
      {
        totalSales: number;
        totalCost: number;
        totalGrossProfit: number;
      }
    >();

    // Fetch financial report untuk setiap gas station (menggunakan purchasePrice saat penjualan)
    await Promise.all(
      gasStationIds.map(async (gasStationId) => {
        try {
          const financialReport =
            await FinancialReportService.getFinancialReport(
              gasStationId,
              startDate,
              endDate
            );

          salesByGasStation.set(gasStationId, {
            totalSales: financialReport.income.totalSales,
            totalCost: financialReport.income.totalCost,
            totalGrossProfit: financialReport.income.totalGrossProfit,
          });
        } catch (error) {
          console.error(
            `Error fetching financial report for gas station ${gasStationId}:`,
            error
          );
          // Fallback: set to 0 jika error
          salesByGasStation.set(gasStationId, {
            totalSales: 0,
            totalCost: 0,
            totalGrossProfit: 0,
          });
        }
      })
    );

    // Calculate expenses per gas station
    const expensesByGasStation = new Map<string, number>();
    expenseJournalEntries.forEach((entry) => {
      const gasStationId = entry.transaction.gasStationId;
      const amount = entry.debit - entry.credit;

      // Untuk "Biaya Susut Tank Reading": debit = positif, credit = negatif
      // Untuk expense lainnya: gunakan nilai absolut
      const expenseAmount =
        entry.coa.name === "Biaya Susut Tank Reading"
          ? amount // Debit positif, credit negatif
          : Math.abs(amount); // Expense lainnya selalu positif

      expensesByGasStation.set(
        gasStationId,
        (expensesByGasStation.get(gasStationId) || 0) + expenseAmount
      );
    });

    // Build reports
    const gasStationReports = await Promise.all(
      gasStations.map(async (gasStation) => {
        const sales = salesByGasStation.get(gasStation.id) || {
          totalSales: 0,
          totalCost: 0,
          totalGrossProfit: 0,
        };
        const totalExpenses = expensesByGasStation.get(gasStation.id) || 0;

        const totalSales = sales.totalSales;

        // Hitung Laba Kotor menggunakan perhitungan yang sama dengan income-table.tsx
        // Laba Kotor = Total Sales - (Total Modal + Pump Test + Susut)
        // Dimana Total Modal = Σ(purchasePrice × volume) untuk setiap produk
        // Pump Test dan Susut diambil dari stockValues
        const financialReport = await FinancialReportService.getFinancialReport(
          gasStation.id,
          startDate,
          endDate
        );

        // Get income report untuk mendapatkan purchasePrice dan volume per produk
        const incomeReport = await IncomeReportService.getIncomeReport(
          gasStation.id,
          startDate,
          endDate
        );

        // Hitung Total Modal sama seperti di income-table.tsx
        // Total Modal = Σ(purchasePrice × volume) untuk setiap produk
        let totalModal = 0;
        for (const product of incomeReport.byProduct) {
          if (product.hasBreakdown && product.breakdowns) {
            // Produk dengan breakdown: jumlahkan volume × purchasePrice dari setiap breakdown
            const productModal = product.breakdowns.reduce(
              (sum, b) =>
                sum +
                (b.purchasePrice && b.purchasePrice > 0 && b.volume > 0
                  ? b.volume * b.purchasePrice
                  : 0),
              0
            );
            totalModal += productModal;
          } else {
            // Produk tanpa breakdown: volume × purchasePrice
            const displayVolume =
              product.volumeWithPriceChange > 0
                ? product.volumeWithPriceChange
                : product.volumeWithoutPriceChange;
            const productModal =
              product.purchasePrice &&
              product.purchasePrice > 0 &&
              displayVolume > 0
                ? displayVolume * product.purchasePrice
                : 0;
            totalModal += productModal;
          }
        }

        const totalPumpTestValue =
          financialReport.stockValues?.totalPumpTestValue || 0;
        const totalShrinkageValue =
          financialReport.stockValues?.totalShrinkageValue || 0;
        const totalHPP = totalModal + totalPumpTestValue + totalShrinkageValue;
        const grossProfit = totalSales - totalHPP; // Laba kotor sesuai dengan income-table.tsx
        const hpp = totalHPP;

        // Laba Bersih = Laba Kotor - Pengeluaran
        const netProfit = grossProfit - totalExpenses;
        const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        return {
          id: gasStation.id,
          name: gasStation.name,
          totalSales,
          hpp,
          grossProfit,
          totalExpenses,
          netProfit,
          margin,
          contribution: 0, // Will be calculated after all reports are done
        };
      })
    );

    // Calculate total gross profit for contribution calculation
    const totalGrossProfit = gasStationReports.reduce(
      (sum, report) => sum + report.grossProfit,
      0
    );

    // Calculate contribution for each gas station (berdasarkan grossProfit)
    const reportsWithContribution = gasStationReports.map((report) => ({
      ...report,
      contribution: totalGrossProfit > 0 ? (report.grossProfit / totalGrossProfit) * 100 : 0,
    }));

    // Calculate totals
    const totals = {
      totalSales: reportsWithContribution.reduce(
        (sum, report) => sum + report.totalSales,
        0
      ),
      totalHpp: reportsWithContribution.reduce(
        (sum, report) => sum + report.hpp,
        0
      ),
      totalGrossProfit: reportsWithContribution.reduce(
        (sum, report) => sum + report.grossProfit,
        0
      ),
      totalExpenses: reportsWithContribution.reduce(
        (sum, report) => sum + report.totalExpenses,
        0
      ),
      totalNetProfit: reportsWithContribution.reduce(
        (sum, report) => sum + report.netProfit,
        0
      ),
    };

    return {
      gasStations: reportsWithContribution,
      totals,
    };
  }
}
