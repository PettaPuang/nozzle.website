import { prisma } from "@/lib/prisma";
import { TankHistoryService } from "./tank-history.service";
import {
  startOfDayUTC,
  endOfDayUTC,
  getDateRangeBetweenUTC,
} from "@/lib/utils/datetime";

export type NozzleBreakdown = {
  stationCode: string;
  stationName: string;
  nozzleCode: string;
  nozzleName: string;
  totalizerOpen: number;
  totalizerClose: number;
  pumpTest: number;
  volume: number;
  price: number;
  transactionCount: number;
  amount: number;
  purchasePrice: number;
  margin: number;
  grossProfit: number;
};

export type ProductSalesData = {
  productId: string;
  productName: string;
  totalVolume: number;
  price: number;
  totalAmount: number;
  percentage: number;
  purchasePrice: number;
  totalMargin: number;
  totalGrossProfit: number;
  totalVariance: number;
  variancePercentage: number;
  varianceValue: number;
  netProfit: number;
  nozzleBreakdown: NozzleBreakdown[];
};

export type ComprehensiveSalesReport = {
  summary: {
    totalVolume: number;
    totalAmount: number;
    totalTransactions: number;
    dateRange: { start: Date; end: Date };
  };
  byProduct: ProductSalesData[];
};

export class ReportSalesService {
  /**
   * Get comprehensive sales report with detailed breakdown
   */
  static async getComprehensiveSalesReport(
    gasStationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComprehensiveSalesReport> {
    const startDateTime = startOfDayUTC(startDate);
    const endDateTime = endOfDayUTC(endDate);

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
      },
      include: {
        gasStation: true,
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
                station: {
                  include: {
                    gasStation: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // Query semua products untuk gas station ini
    const products = await prisma.product.findMany({
      where: { gasStationId },
      select: { id: true, name: true },
    });

    const productNameToIdMap = new Map<string, string>();
    products.forEach((p) => productNameToIdMap.set(p.name, p.id));

    // Query ProductPriceHistory untuk deteksi perubahan harga
    const { start: startUTC, end: endUTC } = getDateRangeBetweenUTC(
      startDate,
      endDate
    );

    const priceHistoryMap = new Map<string, Date[]>();
    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const priceHistories = await prisma.productPriceHistory.findMany({
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
        },
        orderBy: {
          changeDate: "asc",
        },
      });

      // Group by productId dan deduplicate dates
      for (const history of priceHistories) {
        if (!priceHistoryMap.has(history.productId)) {
          priceHistoryMap.set(history.productId, []);
        }
        const dates = priceHistoryMap.get(history.productId)!;
        const timestamp = history.changeDate.getTime();
        if (!dates.some((d) => d.getTime() === timestamp)) {
          dates.push(history.changeDate);
        }
      }
    }

    // Query adjustment transactions untuk mendapatkan purchasePrice berdasarkan tanggal
    const adjustmentTransactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "ADJUSTMENT",
        approvalStatus: "APPROVED",
        date: {
          lte: endDateTime,
        },
        journalEntries: {
          some: {
            coa: {
              name: "Penyesuaian Stock",
            },
          },
        },
      },
      include: {
        journalEntries: {
          where: {
            coa: {
              name: {
                startsWith: "Persediaan ",
              },
            },
          },
          include: {
            coa: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Build map: productId -> adjustment date -> newPurchasePrice
    const adjustmentMap = new Map<
      string,
      Array<{ date: Date; newPurchasePrice: number; oldPurchasePrice: number }>
    >();

    for (const adjTx of adjustmentTransactions) {
      // Extract productName dari COA name "Persediaan {productName}"
      const inventoryEntry = adjTx.journalEntries.find((je) =>
        je.coa.name.startsWith("Persediaan ")
      );
      if (!inventoryEntry) continue;

      const productName = inventoryEntry.coa.name.replace("Persediaan ", "");
      const productId = productNameToIdMap.get(productName);
      if (!productId) continue;

      // Extract oldPurchasePrice dan newPurchasePrice dari notes
      const notes = adjTx.notes || "";
      const oldPriceMatch = notes.match(/dari Rp ([\d.,]+)/);
      const newPriceMatch = notes.match(/menjadi Rp ([\d.,]+)/);

      if (!oldPriceMatch || !newPriceMatch) continue;

      const oldPurchasePrice = parseFloat(
        oldPriceMatch[1].replace(/\./g, "").replace(",", ".")
      );
      const newPurchasePrice = parseFloat(
        newPriceMatch[1].replace(/\./g, "").replace(",", ".")
      );

      if (!adjustmentMap.has(productId)) {
        adjustmentMap.set(productId, []);
      }

      adjustmentMap.get(productId)!.push({
        date: adjTx.date,
        newPurchasePrice,
        oldPurchasePrice,
      });
    }

    // Helper function untuk mendapatkan purchasePrice berdasarkan tanggal transaksi
    const getPurchasePriceForDate = (
      productId: string,
      transactionDate: Date,
      currentPurchasePrice: number
    ): number => {
      const adjustments = adjustmentMap.get(productId);
      if (!adjustments || adjustments.length === 0) {
        return currentPurchasePrice;
      }

      // Cari adjustment terakhir sebelum atau pada tanggal transaksi
      const relevantAdjustments = adjustments.filter(
        (adj) => adj.date <= transactionDate
      );
      if (relevantAdjustments.length === 0) {
        // Tidak ada adjustment sebelum transaksi, gunakan purchasePrice awal sebelum semua adjustment
        const firstAdjustment = adjustments[0];
        return firstAdjustment.oldPurchasePrice;
      }

      // Gunakan newPurchasePrice dari adjustment terakhir sebelum atau pada tanggal transaksi
      const lastAdjustment =
        relevantAdjustments[relevantAdjustments.length - 1];
      return lastAdjustment.newPurchasePrice;
    };

    const productPriceDataMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        price: number;
        purchasePrice: number;
        totalVolume: number;
        totalAmount: number;
        totalPumpTest: number;
        transactionCount: number;
        totalizerOpen: number;
        totalizerClose: number;
        nozzleMap: Map<
          string,
          {
            stationCode: string;
            stationName: string;
            code: string;
            name: string;
            totalizerOpen: number;
            totalizerClose: number;
            pumpTest: number;
            volume: number;
            transactionCount: number;
            amount: number;
          }
        >;
      }
    >();

    let grandTotalVolume = 0;
    let grandTotalAmount = 0;
    let totalTransactions = 0;

    for (const shift of shifts) {
      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      for (const closeReading of closeReadings) {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const volume =
            closeReading.totalizerReading -
            openReading.totalizerReading -
            closeReading.pumpTest;

          if (volume > 0) {
            const amount = volume * closeReading.priceSnapshot;
            const product = closeReading.nozzle.product;
            const nozzle = closeReading.nozzle;
            const price = closeReading.priceSnapshot;

            // Tentukan purchasePrice berdasarkan tanggal transaksi
            const transactionDate = closeReading.createdAt;
            const purchasePrice = getPurchasePriceForDate(
              product.id,
              transactionDate,
              product.purchasePrice
            );

            // Key sekarang include purchasePrice juga
            const productPriceKey = `${product.id}-${price}-${purchasePrice}`;

            if (!productPriceDataMap.has(productPriceKey)) {
              productPriceDataMap.set(productPriceKey, {
                productId: product.id,
                productName: product.name,
                price: price,
                purchasePrice: purchasePrice,
                totalVolume: 0,
                totalAmount: 0,
                totalPumpTest: 0,
                transactionCount: 0,
                totalizerOpen: 0,
                totalizerClose: 0,
                nozzleMap: new Map(),
              });
            }

            const productData = productPriceDataMap.get(productPriceKey)!;
            productData.totalVolume += volume;
            productData.totalAmount += amount;
            productData.totalPumpTest += closeReading.pumpTest;
            productData.transactionCount += 1;

            productData.totalizerOpen += openReading.totalizerReading;
            productData.totalizerClose += closeReading.totalizerReading;

            const nozzlePriceKey = `${nozzle.id}-${price}`;
            if (!productData.nozzleMap.has(nozzlePriceKey)) {
              productData.nozzleMap.set(nozzlePriceKey, {
                stationCode: nozzle.station?.code || "N/A",
                stationName: nozzle.station?.name || "N/A",
                code: nozzle.code,
                name: nozzle.name,
                totalizerOpen: openReading.totalizerReading,
                totalizerClose: closeReading.totalizerReading,
                pumpTest: closeReading.pumpTest,
                volume: 0,
                transactionCount: 0,
                amount: 0,
              });
            } else {
              const nozzleData = productData.nozzleMap.get(nozzlePriceKey)!;
              nozzleData.totalizerOpen = Math.min(
                nozzleData.totalizerOpen,
                openReading.totalizerReading
              );
              nozzleData.totalizerClose = Math.max(
                nozzleData.totalizerClose,
                closeReading.totalizerReading
              );
              nozzleData.pumpTest += closeReading.pumpTest;
            }

            const nozzleData = productData.nozzleMap.get(nozzlePriceKey)!;
            nozzleData.volume += volume;
            nozzleData.amount += amount;
            nozzleData.transactionCount += 1;

            grandTotalVolume += volume;
            grandTotalAmount += amount;
            totalTransactions += 1;
          }
        }
      }
    }

    // Fetch tank variance
    const tankVarianceMap = new Map<string, number>();
    const tanks = await prisma.tank.findMany({
      where: { gasStationId },
      select: { id: true, productId: true },
    });

    const tankDailyReports = await Promise.all(
      tanks.map((tank) =>
        TankHistoryService.getTankDailyReport(
          tank.id,
          startDateTime,
          endDateTime
        ).then((report) => ({
          tankId: tank.id,
          productId: tank.productId,
          report,
        }))
      )
    );

    // Process variance for all tanks
    for (const { tankId, productId, report } of tankDailyReports) {
      let tankTotalVariance = 0;
      for (const record of report) {
        const recordDate = new Date(record.date);
        if (recordDate >= startDateTime && recordDate <= endDateTime) {
          tankTotalVariance += record.totalVariance || 0;
        }
      }

      const currentVariance = tankVarianceMap.get(productId) || 0;
      tankVarianceMap.set(productId, currentVariance + tankTotalVariance);
    }

    // Get all products that have variance but no sales
    const productsWithVariance = new Map<
      string,
      {
        productId: string;
        productName: string;
        purchasePrice: number;
        sellingPrice: number;
      }
    >();

    const productIdsWithVariance = Array.from(tankVarianceMap.keys());
    if (productIdsWithVariance.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIdsWithVariance },
          gasStationId,
        },
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          sellingPrice: true,
        },
      });

      products.forEach((product) => {
        const variance = tankVarianceMap.get(product.id);
        if (variance !== undefined && variance !== 0) {
          const hasSales = Array.from(productPriceDataMap.values()).some(
            (data) => data.productId === product.id
          );

          if (!hasSales) {
            productsWithVariance.set(product.id, {
              productId: product.id,
              productName: product.name,
              purchasePrice: product.purchasePrice,
              sellingPrice: product.sellingPrice,
            });
          }
        }
      });
    }

    // Map produk yang ada penjualan
    const byProduct: ProductSalesData[] = Array.from(
      productPriceDataMap.values()
    ).map((data) => {
      const margin = data.price - data.purchasePrice;
      const grossProfit = data.totalVolume * margin;
      const totalVariance = tankVarianceMap.get(data.productId) || 0;
      const variancePercentage =
        data.totalVolume > 0 ? (totalVariance / data.totalVolume) * 100 : 0;
      const varianceValue = totalVariance * data.purchasePrice;
      const netProfit =
        totalVariance >= 0
          ? grossProfit + varianceValue
          : grossProfit - Math.abs(varianceValue);

      return {
        productId: data.productId,
        productName: data.productName,
        totalVolume: data.totalVolume,
        price: data.price,
        totalAmount: data.totalAmount,
        percentage:
          grandTotalAmount > 0
            ? (data.totalAmount / grandTotalAmount) * 100
            : 0,
        purchasePrice: data.purchasePrice,
        totalMargin: margin * data.totalVolume,
        totalGrossProfit: grossProfit,
        totalVariance,
        variancePercentage,
        varianceValue,
        netProfit,
        nozzleBreakdown: Array.from(data.nozzleMap.values()).map((nozzle) => {
          const nozzleMargin = data.price - data.purchasePrice;
          const nozzleGrossProfit = nozzle.volume * nozzleMargin;

          return {
            stationCode: nozzle.stationCode,
            stationName: nozzle.stationName,
            nozzleCode: nozzle.code,
            nozzleName: nozzle.name,
            totalizerOpen: nozzle.totalizerOpen,
            totalizerClose: nozzle.totalizerClose,
            pumpTest: nozzle.pumpTest,
            volume: nozzle.volume,
            price: data.price,
            transactionCount: nozzle.transactionCount,
            amount: nozzle.amount,
            purchasePrice: data.purchasePrice,
            margin: nozzleMargin,
            grossProfit: nozzleGrossProfit,
          };
        }),
      };
    });

    // Tambahkan produk yang ada variance tapi tidak ada penjualan
    productsWithVariance.forEach((product) => {
      const totalVariance = tankVarianceMap.get(product.productId) || 0;
      const varianceValue = totalVariance * product.purchasePrice;
      const netProfit =
        totalVariance >= 0 ? varianceValue : -Math.abs(varianceValue);

      byProduct.push({
        productId: product.productId,
        productName: product.productName,
        totalVolume: 0,
        price: product.sellingPrice,
        totalAmount: 0,
        percentage: 0,
        purchasePrice: product.purchasePrice,
        totalMargin: 0,
        totalGrossProfit: 0,
        totalVariance,
        variancePercentage: 0,
        varianceValue,
        netProfit,
        nozzleBreakdown: [],
      });
    });

    byProduct.sort((a, b) => {
      if (a.productName !== b.productName) {
        return a.productName.localeCompare(b.productName);
      }
      return a.price - b.price;
    });

    return {
      summary: {
        totalVolume: grandTotalVolume,
        totalAmount: grandTotalAmount,
        totalTransactions,
        dateRange: { start: startDateTime, end: endDateTime },
      },
      byProduct,
    };
  }

  /**
   * Get list of available products
   */
  static async getAvailableProducts(
    gasStationId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const products = await prisma.product.findMany({
      where: {
        gasStationId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return products;
  }
}

