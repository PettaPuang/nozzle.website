import { ReportSalesService } from "./report-sales.service";
import { prisma } from "@/lib/prisma";
import {
  getDateRangeBetweenUTC,
  startOfDayUTC,
  endOfDayUTC,
} from "@/lib/utils/datetime";
import { calculateSalesFromNozzleReadings } from "@/lib/utils/tank-calculations";

/**
 * Service untuk Income Report - Product & Volume dengan breakdown per periode harga
 */
export class IncomeReportService {
  /**
   * Helper: Get change dates dari ProductPriceHistory
   */
  private static async getPriceHistoryChangeDates(
    gasStationId: string,
    productId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Date[]> {
    const { start: startUTC, end: endUTC } = getDateRangeBetweenUTC(
      startDate,
      endDate
    );

    const priceHistory = await prisma.productPriceHistory.findMany({
      where: {
        gasStationId,
        productId,
        changeDate: {
          gte: startUTC,
          lte: endUTC,
        },
      },
      select: {
        changeDate: true,
      },
      orderBy: {
        changeDate: "asc",
      },
    });

    // Deduplicate dates dengan same timestamp
    const uniqueDates = Array.from(
      new Set(priceHistory.map((p) => p.changeDate.getTime()))
    ).map((timestamp) => new Date(timestamp));

    return uniqueDates;
  }

  /**
   * Helper: Create periods dari change dates
   * Mengkonversi changeDate ke tanggal lokal untuk menentukan batas periode breakdown
   * Asumsi timezone lokal adalah UTC+8
   */
  private static createPeriods(
    changeDates: Date[],
    startDate: Date,
    endDate: Date
  ): Array<{ startDate: Date; endDate: Date }> {
    const { start: startUTC, end: endUTC } = getDateRangeBetweenUTC(
      startDate,
      endDate
    );

    if (changeDates.length === 0) {
      return [{ startDate: startUTC, endDate: endUTC }];
    }

    const periods: Array<{ startDate: Date; endDate: Date }> = [];
    let periodStart = startUTC;

    // Timezone offset untuk UTC+8 (dalam milliseconds)
    const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;

    for (const changeDateUTC of changeDates) {
      // Konversi changeDate UTC ke tanggal lokal
      // Contoh: 30 Nov 19:00 UTC → tambah 8 jam → 1 Des 03:00 (waktu lokal)
      // Ambil tanggal lokal: 1 Desember
      const changeDateLocalTime = changeDateUTC.getTime() + TIMEZONE_OFFSET_MS;
      const changeDateLocalObj = new Date(changeDateLocalTime);
      const changeDateLocalYear = changeDateLocalObj.getUTCFullYear();
      const changeDateLocalMonth = changeDateLocalObj.getUTCMonth();
      const changeDateLocalDay = changeDateLocalObj.getUTCDate();

      // Buat start of day untuk tanggal lokal (dalam UTC)
      // Start of day lokal 1 Des = 30 Nov 16:00 UTC (karena UTC+8)
      const changeDateLocalStartOfDayUTC = new Date(
        Date.UTC(
          changeDateLocalYear,
          changeDateLocalMonth,
          changeDateLocalDay,
          0,
          0,
          0,
          0
        )
      );
      // Kurangi offset untuk mendapatkan waktu UTC yang benar
      const changeDateLocalStartOfDay = new Date(
        changeDateLocalStartOfDayUTC.getTime() - TIMEZONE_OFFSET_MS
      );

      if (changeDateLocalStartOfDay > periodStart) {
        periods.push({
          startDate: periodStart,
          endDate: new Date(changeDateLocalStartOfDay.getTime() - 1), // 1ms sebelum tanggal perubahan lokal
        });
      }
      periodStart = changeDateLocalStartOfDay;
    }

    // Periode terakhir
    if (periodStart <= endUTC) {
      periods.push({
        startDate: periodStart,
        endDate: endUTC,
      });
    }

    return periods;
  }

  /**
   * Helper: Get volume dari NozzleReading dalam periode berdasarkan tanggal shift
   * FOKUS: Hanya filter berdasarkan tanggal shift dan productId, TIDAK filter berdasarkan harga
   * Konsistensi: menggunakan data yang sama dengan getComprehensiveSalesReport
   */
  private static async getVolumeFromNozzleReadings(
    gasStationId: string,
    productId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const startDateTime = startOfDayUTC(periodStart);
    const endDateTime = endOfDayUTC(periodEnd);

    // Query shifts yang completed dalam periode dengan productId yang sesuai
    // Konsistensi: hanya shifts yang deposit-nya sudah APPROVED (sama dengan getComprehensiveSalesReport)
    // TIDAK filter berdasarkan priceSnapshot - fokus ke volume saja
    const shifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "COMPLETED",
        date: {
          gte: startDateTime,
          lte: endDateTime,
        },
        deposit: {
          status: "APPROVED",
        },
        nozzleReadings: {
          some: {
            nozzle: {
              productId,
            },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              productId,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    let totalVolume = 0;
    for (const shift of shifts) {
      const volume = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      totalVolume += volume;
    }

    return totalVolume;
  }

  /**
   * Get income report dengan breakdown per periode harga
   */
  static async getIncomeReport(
    gasStationId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Get sales report
    const salesReport = await ReportSalesService.getComprehensiveSalesReport(
      gasStationId,
      startDate,
      endDate
    );

    // Group products by productId dan sum totalVolume (karena bisa ada beberapa entry dengan harga berbeda)
    const productsByProductId = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalVolume: number;
      }
    >();

    for (const product of salesReport.byProduct) {
      if (!productsByProductId.has(product.productId)) {
        productsByProductId.set(product.productId, {
          productId: product.productId,
          productName: product.productName,
          totalVolume: 0,
        });
      }
      const data = productsByProductId.get(product.productId)!;
      data.totalVolume += product.totalVolume;
    }

    // Batch query semua products sekaligus untuk menghindari N+1 query
    const productIds = Array.from(productsByProductId.keys());
    const productsData = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        sellingPrice: true,
        purchasePrice: true,
      },
    });
    const productsMap = new Map(productsData.map((p) => [p.id, p]));

    // Batch query semua ProductPriceHistory sekaligus
    const { start: startUTC, end: endUTC } = getDateRangeBetweenUTC(
      startDate,
      endDate
    );
    const allPriceHistory = await prisma.productPriceHistory.findMany({
      where: {
        gasStationId,
        productId: { in: productIds },
        changeDate: {
          gte: startUTC,
          lte: endUTC,
        },
      },
      select: {
        productId: true,
        changeDate: true,
        oldSellingPrice: true,
        oldPurchasePrice: true,
        newSellingPrice: true,
        newPurchasePrice: true,
      },
      orderBy: {
        changeDate: "asc",
      },
    });

    // Group price history by productId
    const priceHistoryByProduct = new Map<string, typeof allPriceHistory>();
    for (const history of allPriceHistory) {
      if (!priceHistoryByProduct.has(history.productId)) {
        priceHistoryByProduct.set(history.productId, []);
      }
      priceHistoryByProduct.get(history.productId)!.push(history);
    }

    const incomeByProduct = [];

    for (const product of productsByProductId.values()) {
      // Get change dates dari priceHistoryByProduct (sudah di-query batch)
      const productPriceHistory =
        priceHistoryByProduct.get(product.productId) || [];
      const priceHistoryDates = Array.from(
        new Set(productPriceHistory.map((p) => p.changeDate.getTime()))
      ).map((timestamp) => new Date(timestamp));

      // Get product data dari map (sudah di-query batch)
      const currentProduct = productsMap.get(product.productId);
      const currentSellingPrice = currentProduct?.sellingPrice || 0;
      const currentPurchasePrice = currentProduct?.purchasePrice || 0;

      // Jika tidak ada perubahan harga
      if (priceHistoryDates.length === 0) {
        incomeByProduct.push({
          productId: product.productId,
          productName: product.productName,
          volumeWithoutPriceChange: product.totalVolume,
          volumeWithPriceChange: 0,
          hasBreakdown: false,
          breakdowns: [],
          sellingPrice: currentSellingPrice,
          purchasePrice: currentPurchasePrice,
        });
        continue;
      }

      // Jika ada perubahan harga, breakdown per periode
      // Breakdown volume harus sesuai dengan total volume dari salesReport
      const periods = this.createPeriods(priceHistoryDates, startDate, endDate);
      const breakdowns = [];

      // Map harga ke periode berdasarkan ProductPriceHistory (sudah di-query batch)
      const priceToPeriodIndexMap = new Map<number, number>(); // price -> period index

      // Periode pertama: harga sebelum perubahan pertama
      if (priceHistoryDates.length > 0 && periods.length > 0) {
        const firstChangeDate = priceHistoryDates[0];
        const firstChange = productPriceHistory.find(
          (h) => h.changeDate.getTime() === firstChangeDate.getTime()
        );
        if (firstChange?.oldSellingPrice) {
          priceToPeriodIndexMap.set(firstChange.oldSellingPrice, 0);
        }
      }

      // Periode setelah perubahan: harga baru
      for (let i = 0; i < priceHistoryDates.length; i++) {
        const changeDate = priceHistoryDates[i];
        const change = productPriceHistory.find(
          (h) => h.changeDate.getTime() === changeDate.getTime()
        );
        if (change?.newSellingPrice && periods.length > i + 1) {
          priceToPeriodIndexMap.set(change.newSellingPrice, i + 1);
        }
      }

      // Group salesReport.byProduct berdasarkan periode
      const volumeByPeriod = new Map<number, number>(); // period index -> volume

      for (const salesProduct of salesReport.byProduct) {
        if (salesProduct.productId !== product.productId) continue;

        const periodIndex = priceToPeriodIndexMap.get(salesProduct.price);
        if (periodIndex !== undefined) {
          volumeByPeriod.set(
            periodIndex,
            (volumeByPeriod.get(periodIndex) || 0) + salesProduct.totalVolume
          );
        }
      }

      // Buat breakdown dari volume yang sudah di-group dengan harga
      // Tambahkan harga jual dan harga beli dari ProductPriceHistory untuk setiap periode (sudah di-query batch)
      const sellingPriceByPeriod = new Map<number, number>(); // period index -> sellingPrice
      const purchasePriceByPeriod = new Map<number, number>(); // period index -> purchasePrice

      // Periode pertama: harga sebelum perubahan pertama (oldSellingPrice dan oldPurchasePrice)
      if (priceHistoryDates.length > 0 && periods.length > 0) {
        const firstChangeDate = priceHistoryDates[0];
        const firstChange = productPriceHistory.find(
          (h) => h.changeDate.getTime() === firstChangeDate.getTime()
        );
        if (firstChange) {
          if (
            firstChange.oldSellingPrice !== null &&
            firstChange.oldSellingPrice !== undefined
          ) {
            sellingPriceByPeriod.set(0, firstChange.oldSellingPrice);
          }
          // oldPurchasePrice selalu ada (tidak nullable), jadi langsung set
          if (
            firstChange.oldPurchasePrice !== null &&
            firstChange.oldPurchasePrice !== undefined
          ) {
            purchasePriceByPeriod.set(0, firstChange.oldPurchasePrice);
          }
        }
      }

      // Periode setelah perubahan: harga baru (newSellingPrice dan newPurchasePrice)
      for (let i = 0; i < priceHistoryDates.length; i++) {
        const changeDate = priceHistoryDates[i];
        const change = productPriceHistory.find(
          (h) => h.changeDate.getTime() === changeDate.getTime()
        );
        if (change && periods.length > i + 1) {
          if (
            change.newSellingPrice !== null &&
            change.newSellingPrice !== undefined
          ) {
            sellingPriceByPeriod.set(i + 1, change.newSellingPrice);
          }
          // newPurchasePrice selalu ada (tidak nullable), jadi langsung set
          if (
            change.newPurchasePrice !== null &&
            change.newPurchasePrice !== undefined
          ) {
            purchasePriceByPeriod.set(i + 1, change.newPurchasePrice);
          }
        }
      }

      for (let i = 0; i < periods.length; i++) {
        const volume = volumeByPeriod.get(i) || 0;
        if (volume > 0) {
          // Ambil purchasePrice dari map, jika tidak ada gunakan currentPurchasePrice sebagai fallback
          const periodPurchasePrice = purchasePriceByPeriod.has(i)
            ? purchasePriceByPeriod.get(i)!
            : currentPurchasePrice;

          breakdowns.push({
            periodStart: periods[i].startDate,
            periodEnd: periods[i].endDate,
            volume,
            sellingPrice: sellingPriceByPeriod.get(i) || 0,
            purchasePrice: periodPurchasePrice,
          });
        }
      }

      // Pastikan total breakdown volume sama dengan total volume
      const breakdownTotal = breakdowns.reduce((sum, b) => sum + b.volume, 0);
      if (breakdownTotal !== product.totalVolume && breakdowns.length > 0) {
        // Adjust breakdown terakhir jika ada selisih (rounding atau edge case)
        const diff = product.totalVolume - breakdownTotal;
        if (Math.abs(diff) < 1) {
          // Selisih kecil (< 1L), adjust breakdown terakhir
          breakdowns[breakdowns.length - 1].volume += diff;
        }
      }

      // Ambil harga jual dan harga beli untuk main row (gunakan harga dari breakdown pertama atau current)
      const mainSellingPrice =
        breakdowns.length > 0 && breakdowns[0].sellingPrice
          ? breakdowns[0].sellingPrice
          : currentSellingPrice;
      const mainPurchasePrice =
        breakdowns.length > 0 && breakdowns[0].purchasePrice
          ? breakdowns[0].purchasePrice
          : currentPurchasePrice;

      // Total volume tetap dari salesReport (konsisten dengan sales-table)
      incomeByProduct.push({
        productId: product.productId,
        productName: product.productName,
        volumeWithoutPriceChange: 0,
        volumeWithPriceChange: product.totalVolume, // Gunakan dari salesReport
        hasBreakdown: true,
        breakdowns,
        sellingPrice: mainSellingPrice,
        purchasePrice: mainPurchasePrice,
      });
    }

    return {
      byProduct: incomeByProduct,
    };
  }
}
