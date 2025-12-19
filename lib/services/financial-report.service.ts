import { prisma } from "@/lib/prisma";
import { ReportSalesService } from "./report-sales.service";
import { ReportStockService } from "./report-stock.service";
import {
  startOfDayUTC,
  endOfDayUTC,
  getDateRangeBetweenUTC,
} from "@/lib/utils/datetime";

/**
 * Helper function to get pump test volume and value for a product
 * Mengambil total pump test volume dari nozzle readings dalam periode
 */
async function getPumpTestValue(
  gasStationId: string,
  productId: string,
  startDate: Date,
  endDate: Date
): Promise<{ volume: number; value: number }> {
  const { start: startUTC, end: endUTC } = getDateRangeBetweenUTC(
    startDate,
    endDate
  );

  // Get all completed shifts dengan deposit approved dalam periode
  const shifts = await prisma.operatorShift.findMany({
    where: {
      gasStationId,
      status: "COMPLETED",
      deposit: {
        status: "APPROVED",
      },
      createdAt: {
        gte: startUTC,
        lte: endUTC,
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
        include: {
          nozzle: {
            include: {
              product: {
                select: {
                  purchasePrice: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let totalPumpTestVolume = 0;
  let totalPumpTestValue = 0;

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
        const pumpTestVolume = Number(closeReading.pumpTest) || 0;
        if (pumpTestVolume > 0) {
          const purchasePrice = closeReading.nozzle.product?.purchasePrice || 0;
          totalPumpTestVolume += pumpTestVolume;
          totalPumpTestValue += pumpTestVolume * purchasePrice;
        }
      }
    }
  }

  return {
    volume: totalPumpTestVolume,
    value: totalPumpTestValue,
  };
}

/**
 * Helper function to get purchase price snapshot at a specific date
 * Menggunakan harga beli terakhir dari purchase transactions sebelum tanggal tertentu
 *
 * Logika:
 * 1. Cari purchase transaction terakhir yang sudah di-unload sebelum atau pada tanggal tersebut
 * 2. Ambil harga beli dari journal entry LO (debit / purchaseVolume)
 * 3. Jika tidak ada purchase transaction, return 0 (akan di-handle dengan fallback ke product.purchasePrice)
 *
 * Catatan: Untuk openingValue, gunakan tanggal tepat sebelum startDate (bukan <= startDate)
 *          Untuk closingValue, gunakan tanggal <= endDate
 */
async function getPurchasePriceSnapshotAtDate(
  gasStationId: string,
  productId: string,
  atDate: Date
): Promise<number> {
  // Cari purchase transaction terakhir yang sudah di-unload sebelum atau pada tanggal tersebut
  // Ambil harga beli dari journal entry LO (debit / purchaseVolume)
  const lastPurchaseTransaction = await prisma.transaction.findFirst({
    where: {
      gasStationId,
      transactionType: "PURCHASE_BBM",
      approvalStatus: "APPROVED",
      productId,
      purchaseVolume: { not: null },
      date: {
        lte: atDate,
      },
      purchaseUnloads: {
        some: {
          status: "APPROVED",
          createdAt: {
            lte: atDate,
          },
        },
      },
    },
    include: {
      journalEntries: {
        where: {
          coa: {
            name: {
              startsWith: "LO ",
            },
          },
          debit: {
            gt: 0,
          },
        },
        select: {
          debit: true,
        },
        take: 1,
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  // Jika ada purchase transaction, gunakan harga beli dari transaction tersebut
  if (lastPurchaseTransaction) {
    const txPurchaseVolume = lastPurchaseTransaction.purchaseVolume || 0;
    const loEntry = lastPurchaseTransaction.journalEntries[0];

    if (loEntry && txPurchaseVolume > 0) {
      const purchasePrice = loEntry.debit / txPurchaseVolume;
      return purchasePrice;
    }
  }

  // Jika tidak ada purchase transaction, return 0 (akan di-handle dengan fallback ke product.purchasePrice)
  return 0;
}

/**
 * Helper function to get purchase value from approved unloads
 * Mengambil nilai pembelian dari debit persediaan di journal entries unload yang APPROVED
 * Nilai ini sudah memperhitungkan susut perjalanan dan mencerminkan nilai real yang masuk ke inventory
 */
async function getPurchaseValueFromApprovedUnloads(
  gasStationId: string,
  productName: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Query unload yang APPROVED dalam periode
  const approvedUnloads = await prisma.unload.findMany({
    where: {
      tank: {
        gasStationId,
        product: {
          name: productName,
        },
      },
      status: "APPROVED",
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      literAmount: true,
      tank: {
        select: {
          product: {
            select: {
              purchasePrice: true,
            },
          },
        },
      },
    },
  });

  // Hitung total purchase value dari unload yang approved
  // purchaseValue = literAmount * purchasePrice
  const totalPurchaseValue = approvedUnloads.reduce((sum, unload) => {
    const purchaseValue =
      unload.literAmount * (unload.tank.product?.purchasePrice || 0);
    return sum + purchaseValue;
  }, 0);

  return totalPurchaseValue;
}

export class FinancialReportService {
  /**
   * Get financial report (income from sales + expenses)
   */
  static async getFinancialReport(
    gasStationId: string,
    startDate: Date,
    endDate: Date,
    options?: { useFullHistoryForBalanceSheet?: boolean }
  ) {
    const startDateTime = startOfDayUTC(startDate);
    const endDateTime = endOfDayUTC(endDate);

    // Untuk balance sheet, gunakan startDate sejak awal (tank creation) jika option di-set
    let stockReportStartDate = startDate;
    if (options?.useFullHistoryForBalanceSheet) {
      // Cari tank creation date terawal untuk gas station ini
      const earliestTank = await prisma.tank.findFirst({
        where: { gasStationId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (earliestTank) {
        stockReportStartDate = earliestTank.createdAt;
      }
    }

    // Get comprehensive sales report for income
    const salesReport = await ReportSalesService.getComprehensiveSalesReport(
      gasStationId,
      startDate,
      endDate
    );

    // Transform sales data to financial income format
    // NOTE: totalCost akan dihitung ulang setelah stockValues tersedia
    // karena perlu menggunakan stock movement method: openingValue + purchaseValue - closingValue
    const incomeByProduct = salesReport.byProduct.map(
      (product: {
        productId: string;
        productName: string;
        totalVolume: number;
        totalAmount: number;
        purchasePrice: number;
        totalGrossProfit: number;
        totalVariance: number;
        variancePercentage: number;
      }) => ({
        productId: product.productId,
        productName: product.productName,
        totalVolume: product.totalVolume,
        totalSales: product.totalAmount,
        purchasePrice: product.purchasePrice,
        totalCost: 0, // Akan dihitung setelah stockValues tersedia
        grossProfit: product.totalGrossProfit,
        totalVariance: product.totalVariance,
        variancePercentage: product.variancePercentage,
      })
    );

    const totalSales = salesReport.summary.totalAmount;

    // totalCost akan dihitung setelah stockValues tersedia menggunakan stock movement method
    // Sementara set ke 0, akan diupdate setelah stockValuesByProduct tersedia
    let totalCost = 0;

    // totalGrossProfit akan dihitung ulang setelah stockValues tersedia
    let totalGrossProfit = 0;
    const totalVariance = incomeByProduct.reduce(
      (sum: number, p: { totalVariance: number }) => sum + p.totalVariance,
      0
    );

    // Get stock report for stock volumes
    // Untuk balance sheet, gunakan startDate sejak awal agar openingStock akurat
    const stockReport = await ReportStockService.getStockReport(
      gasStationId,
      stockReportStartDate,
      endDate
    );

    // Get all unique products from stockReport (bukan hanya dari incomeByProduct)
    // Karena bisa ada product yang tidak ada penjualan tapi ada stock
    const productsFromStock = new Map<
      string,
      { productId: string; productName: string }
    >();

    // Collect products from stockReport tanks
    stockReport.tanks.forEach((tank: any) => {
      if (tank.productId && tank.productName) {
        if (!productsFromStock.has(tank.productId)) {
          productsFromStock.set(tank.productId, {
            productId: tank.productId,
            productName: tank.productName,
          });
        }
      }
    });

    // Combine products from incomeByProduct and stockReport
    // Priority: use productName from incomeByProduct if exists (lebih update)
    const allProducts = new Map<
      string,
      { productId: string; productName: string }
    >();

    // Add from incomeByProduct first (prioritas)
    incomeByProduct.forEach(
      (product: { productId: string; productName: string }) => {
        allProducts.set(product.productId, {
          productId: product.productId,
          productName: product.productName,
        });
      }
    );

    // Add from stockReport if not already in allProducts
    productsFromStock.forEach((product, productId) => {
      if (!allProducts.has(productId)) {
        allProducts.set(productId, product);
      }
    });

    // Get stock values using volume from stock report * product price
    // Sederhana: ambil langsung volume dari stockReport yang sudah lengkap, lalu kalikan dengan product price
    // Aggregate all tanks per product (1 product can have multiple tanks)

    // Hitung pump test value untuk semua produk
    const pumpTestValuesByProduct = await Promise.all(
      Array.from(allProducts.values()).map(async (product) => {
        const pumpTest = await getPumpTestValue(
          gasStationId,
          product.productId,
          startDate,
          endDate
        );
        return {
          productId: product.productId,
          pumpTestVolume: pumpTest.volume,
          pumpTestValue: pumpTest.value,
        };
      })
    );

    const pumpTestValueMap = new Map(
      pumpTestValuesByProduct.map((p) => [p.productId, p])
    );

    // Hitung stockValues terlebih dahulu untuk mendapatkan purchaseValue yang akurat
    const stockValuesByProduct = await Promise.all(
      Array.from(allProducts.values()).map(async (product) => {
        try {
          // Filter all tanks for this product by productId (lebih reliable daripada productName)
          let productTanks = stockReport.tanks.filter(
            (t: any) => t.productId === product.productId
          );

          // FALLBACK: Jika tidak ada tank yang match dengan productId, coba match dengan productName
          // Ini untuk handle kasus dimana productId tidak match (mungkin karena data lama atau mismatch)
          if (productTanks.length === 0) {
            productTanks = stockReport.tanks.filter(
              (t: any) => t.productName === product.productName
            );
          }

          const openingStockVolume = productTanks.reduce(
            (sum: number, t: any) => sum + (t.openingStock || 0),
            0
          );
          const purchaseVolume = productTanks.reduce(
            (sum: number, t: any) => sum + (t.totalUnload || 0),
            0
          );
          const salesVolume = productTanks.reduce(
            (sum: number, t: any) => sum + (t.totalSales || 0),
            0
          );
          const pumpTestVolume = productTanks.reduce(
            (sum: number, t: any) => sum + (t.totalPumpTest || 0),
            0
          );
          const shrinkageVolume = productTanks.reduce(
            (sum: number, t: any) => sum + (t.totalVariance || 0),
            0
          );

          // IMPORTANT: Use EXPECTED closing, not ACTUAL closing
          // Expected Closing = Opening + Purchase - Sales - PumpTest (WITHOUT variance)
          // Variance akan di-journal terpisah, tidak masuk COGS
          const expectedClosingVolume =
            openingStockVolume + purchaseVolume - salesVolume - pumpTestVolume;

          // Get product untuk mendapatkan purchasePrice
          const productData = await prisma.product.findUnique({
            where: {
              id: product.productId,
            },
            select: {
              purchasePrice: true,
            },
          });

          const purchasePrice = productData?.purchasePrice || 0;

          // IMPORTANT: Gunakan snapshot harga historis untuk akurasi akuntansi
          // Stock Awal: harga pada tanggal awal periode (snapshot)
          // Stock Akhir: harga pada tanggal akhir periode (snapshot)
          // Pembelian: harga transaksi sebenarnya dari purchase transactions

          let openingPurchasePrice = purchasePrice; // Fallback
          let closingPurchasePrice = purchasePrice; // Fallback

          // Get snapshot harga untuk stock awal (pada startDate)
          if (openingStockVolume > 0) {
            const snapshotPrice = await getPurchasePriceSnapshotAtDate(
              gasStationId,
              product.productId,
              startDate
            );
            if (snapshotPrice > 0) {
              openingPurchasePrice = snapshotPrice;
            }
          }

          // Get snapshot harga untuk stock akhir (pada endDate)
          if (expectedClosingVolume > 0) {
            const snapshotPrice = await getPurchasePriceSnapshotAtDate(
              gasStationId,
              product.productId,
              endDate
            );
            if (snapshotPrice > 0) {
              closingPurchasePrice = snapshotPrice;
            }
          }

          const openingValue = openingStockVolume * openingPurchasePrice;

          // Hitung shrinkage value dari COA "Susut [Product]" dalam periode
          // PENTING: Ini harus dihitung SEBELUM closingValue untuk dikurangkan dari persediaan
          const shrinkageEntries = await prisma.journalEntry.findMany({
            where: {
              coa: {
                gasStationId,
                name: `Susut ${product.productName}`,
                category: "COGS",
              },
              transaction: {
                gasStationId,
                approvalStatus: "APPROVED",
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
            select: {
              debit: true,
              credit: true,
            },
          });

          // Shrinkage value = total debit - total credit (net debit = biaya susut, net credit = pengurangan biaya susut)
          const shrinkageValue = shrinkageEntries.reduce(
            (sum, entry) => sum + (entry.debit - entry.credit),
            0
          );

          // Closing Value harus dikurangi dengan shrinkageValue
          // Formula: Closing Value = (Opening + Purchase - Sales - PumpTest) * Price - Shrinkage Value
          // Atau: Closing Value = Opening Value + Purchase Value - HPP (Sales) - Pump Test Value - Shrinkage Value
          const closingValueBeforeShrinkage =
            expectedClosingVolume * closingPurchasePrice;
          const closingValue = closingValueBeforeShrinkage - shrinkageValue;

          // Hitung purchaseValue dari unload yang APPROVED
          let purchaseValue = 0;
          if (purchaseVolume > 0) {
            purchaseValue = await getPurchaseValueFromApprovedUnloads(
              gasStationId,
              product.productName,
              startDate,
              endDate
            );

            // Fallback jika tidak ada unload yang approved
            if (purchaseValue === 0) {
              purchaseValue = purchaseVolume * purchasePrice;
            }
          }

          // Ambil pump test value untuk produk ini
          const pumpTestData = pumpTestValueMap.get(product.productId);
          const pumpTestValue = pumpTestData?.pumpTestValue || 0;

          return {
            productName: product.productName,
            productId: product.productId,
            openingStock: isNaN(openingStockVolume) ? 0 : openingStockVolume,
            purchases: isNaN(purchaseVolume) ? 0 : purchaseVolume,
            closingStock: isNaN(expectedClosingVolume)
              ? 0
              : expectedClosingVolume,
            openingValue: isNaN(openingValue) ? 0 : openingValue,
            purchaseValue: isNaN(purchaseValue) ? 0 : purchaseValue,
            closingValue: isNaN(closingValue) ? 0 : closingValue,
            pumpTestVolume: isNaN(pumpTestVolume) ? 0 : pumpTestVolume,
            pumpTestValue: isNaN(pumpTestValue) ? 0 : pumpTestValue,
            shrinkageVolume: isNaN(shrinkageVolume) ? 0 : shrinkageVolume,
            shrinkageValue: isNaN(shrinkageValue) ? 0 : shrinkageValue,
          };
        } catch (error) {
          console.error(
            `Error calculating stockValues for product ${product.productId}:`,
            error
          );
          // Return default values jika ada error
          return {
            productName: product.productName,
            productId: product.productId,
            openingValue: 0,
            purchaseValue: 0,
            closingValue: 0,
            pumpTestVolume: 0,
            pumpTestValue: 0,
            shrinkageVolume: 0,
            shrinkageValue: 0,
          };
        }
      })
    );

    // Hitung ulang totalCost menggunakan stock movement method: openingValue + purchaseValue - pumpTestValue - closingValue
    // Buat map stockValues by productId untuk lookup cepat
    const stockValuesMap = new Map(
      stockValuesByProduct.map((sv) => [sv.productId, sv])
    );

    // Update incomeByProduct dengan totalCost yang benar menggunakan stock movement
    const updatedIncomeByProduct = incomeByProduct.map(
      (product: {
        productId: string;
        productName: string;
        totalVolume: number;
        totalSales: number;
        purchasePrice: number;
        totalCost: number;
        grossProfit: number;
        totalVariance: number;
        variancePercentage: number;
      }) => {
        const stockValues = stockValuesMap.get(product.productId);
        if (stockValues) {
          // HPP = OpeningValue + PurchaseValue - PumpTestValue - ClosingValue
          const cogs =
            stockValues.openingValue +
            stockValues.purchaseValue -
            (stockValues.pumpTestValue || 0) -
            stockValues.closingValue;
          // Hitung ulang grossProfit menggunakan totalCost yang benar
          const grossProfit = product.totalSales - cogs;
          // Hitung purchasePrice aktual dari totalCost / totalVolume (harga beli snapshot dari transaksi)
          const actualPurchasePrice =
            product.totalVolume > 0 &&
            !isNaN(cogs / product.totalVolume) &&
            isFinite(cogs / product.totalVolume)
              ? cogs / product.totalVolume
              : product.purchasePrice;
          return {
            ...product,
            totalCost: isNaN(cogs) ? 0 : cogs,
            grossProfit: isNaN(grossProfit) ? 0 : grossProfit,
            purchasePrice:
              isNaN(actualPurchasePrice) || !isFinite(actualPurchasePrice)
                ? product.purchasePrice
                : actualPurchasePrice, // Update dengan harga beli aktual dari transaksi
          };
        }
        // Fallback: jika tidak ada stockValues, gunakan perhitungan lama
        const cogs = product.totalVolume * product.purchasePrice;
        const grossProfit = product.totalSales - cogs;
        return {
          ...product,
          totalCost: isNaN(cogs) ? 0 : cogs,
          grossProfit: isNaN(grossProfit) ? 0 : grossProfit,
          // purchasePrice tetap menggunakan yang dari salesReport (sudah snapshot)
        };
      }
    );

    // Hitung ulang totalCost dan totalGrossProfit dari updatedIncomeByProduct
    totalCost = updatedIncomeByProduct.reduce(
      (sum: number, p: { totalCost: number }) => sum + p.totalCost,
      0
    );
    totalGrossProfit = updatedIncomeByProduct.reduce(
      (sum: number, p: { grossProfit: number }) => sum + p.grossProfit,
      0
    );

    // Get expenses data from JournalEntry with COA category EXPENSE
    const expenseJournalEntries = await prisma.journalEntry.findMany({
      where: {
        coa: {
          gasStationId,
          category: "EXPENSE",
        },
        transaction: {
          gasStationId,
          approvalStatus: "APPROVED",
          date: {
            gte: startDateTime,
            lte: endDateTime,
          },
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
          },
        },
        coa: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: {
        transaction: {
          date: "desc",
        },
      },
    });

    // Group expenses by COA name (as category)
    const expensesByCategory = new Map<
      string,
      Array<{
        id: string;
        category: string;
        transactionDescription: string;
        entryDescription: string | null;
        amount: number;
        date: Date;
      }>
    >();

    expenseJournalEntries.forEach((entry) => {
      const category = entry.coa.name;
      const amount = entry.debit - entry.credit;

      // Untuk "Biaya Susut Tank Reading": debit = positif, credit = negatif
      // Untuk expense lainnya: gunakan nilai absolut
      let displayAmount: number;
      if (category === "Biaya Susut Tank Reading") {
        displayAmount = amount; // Debit positif, credit negatif
      } else {
        displayAmount = Math.abs(amount); // Expense lainnya selalu positif
      }

      if (!expensesByCategory.has(category)) {
        expensesByCategory.set(category, []);
      }
      expensesByCategory.get(category)!.push({
        id: entry.transaction.id,
        category: category,
        transactionDescription: entry.transaction.description,
        entryDescription: entry.description,
        amount: displayAmount,
        date: entry.transaction.date,
      });
    });

    const expensesByCategor = Array.from(expensesByCategory.entries())
      .filter(
        ([category]) =>
          category !== "Beban Penyesuaian Harga" && // Exclude price adjustment expense (masuk Other Income/Expense)
          !category.startsWith("Susut ") // Exclude shrinkage per product (sudah masuk HPP via COGS)
      )
      .map(([category, items]) => {
        // Untuk "Biaya Susut Tank Reading": jumlahkan dengan tanda (debit +, credit -)
        // Untuk expense lainnya: jumlahkan nilai absolut
        const total =
          category === "Biaya Susut Tank Reading"
            ? items.reduce((sum, item) => sum + item.amount, 0) // Jumlahkan dengan tanda
            : items.reduce((sum, item) => sum + Math.abs(item.amount), 0); // Jumlahkan nilai absolut

        return {
          category,
          total,
          items,
        };
      });

    // Total expenses: untuk "Biaya Susut Tank Reading" gunakan net balance (debit - credit)
    // Untuk expense lainnya gunakan nilai absolut
    // Pisahkan expenses operasional dengan beban penyesuaian persediaan
    const operationalExpenses = expenseJournalEntries.filter(
      (entry) =>
        entry.coa.name !== "Beban Penyesuaian Harga" && // Exclude price adjustment
        !entry.coa.name.startsWith("Susut ") // Exclude shrinkage (sudah di HPP)
    );
    const adjustmentExpenses = expenseJournalEntries.filter(
      (entry) => entry.coa.name === "Beban Penyesuaian Harga"
    );

    const totalOperationalExpenses = operationalExpenses.reduce(
      (sum, entry) => {
        const amount = entry.debit - entry.credit;
        if (entry.coa.name === "Biaya Susut Tank Reading") {
          return sum + amount; // Net balance (bisa positif atau negatif)
        } else {
          return sum + Math.abs(amount); // Nilai absolut untuk expense lainnya
        }
      },
      0
    );

    const totalAdjustmentExpenses = adjustmentExpenses.reduce(
      (sum, entry) => sum + (entry.debit - entry.credit),
      0
    );

    // Get semua pendapatan REVENUE (selain penjualan produk yang sudah masuk income)
    // Filter COA REVENUE yang terkait produk (format: "Pendapatan [ProductName]")
    const allRevenueEntries = await prisma.journalEntry.findMany({
      where: {
        coa: {
          gasStationId,
          category: "REVENUE",
        },
        transaction: {
          gasStationId,
          approvalStatus: "APPROVED",
          date: {
            gte: startDateTime,
            lte: endDateTime,
          },
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
          },
        },
        coa: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    // Filter: exclude COA REVENUE yang terkait produk (format: "Pendapatan [ProductName]")
    // Ambil daftar productName dari salesReport
    const productNames = salesReport.byProduct.map((p: any) => p.productName);
    const revenueEntriesExcludingProducts = allRevenueEntries.filter(
      (entry) => {
        const coaName = entry.coa.name;
        // Exclude jika COA name adalah "Pendapatan [ProductName]" dimana ProductName ada di salesReport
        const isProductRevenue = productNames.some(
          (productName: string) => coaName === `Pendapatan ${productName}`
        );
        return !isProductRevenue;
      }
    );

    // Hitung total pendapatan REVENUE (exclude produk)
    const totalAllRevenue = revenueEntriesExcludingProducts.reduce(
      (sum, entry) => sum + (entry.credit - entry.debit),
      0
    );

    // Untuk backward compatibility, tetap hitung adjustmentIncome
    const adjustmentIncomeEntries = revenueEntriesExcludingProducts.filter(
      (entry) =>
        entry.coa.name === "Pendapatan Penyesuaian Harga" ||
        entry.coa.name === "Pendapatan Penyesuaian Persediaan"
    );
    const totalAdjustmentIncome = adjustmentIncomeEntries.reduce(
      (sum, entry) => sum + (entry.credit - entry.debit),
      0
    );

    // Total pendapatan/beban lain = semua pendapatan REVENUE - beban adjustment
    const totalOtherIncomeExpense = totalAllRevenue - totalAdjustmentExpenses;

    // Group revenue entries by COA name untuk display di profit-loss table
    // Hanya untuk revenue yang bukan produk
    const revenueByCategory = new Map<
      string,
      Array<{
        id: string;
        category: string;
        description: string;
        amount: number;
        date: Date;
      }>
    >();

    revenueEntriesExcludingProducts.forEach((entry) => {
      const category = entry.coa.name;
      const amount = entry.credit - entry.debit; // REVENUE: credit positif

      if (!revenueByCategory.has(category)) {
        revenueByCategory.set(category, []);
      }
      revenueByCategory.get(category)!.push({
        id: entry.transaction.id,
        category: category,
        description: entry.transaction.description,
        amount: amount,
        date: entry.transaction.date,
      });
    });

    const revenueByCategoryArray = Array.from(revenueByCategory.entries()).map(
      ([category, items]) => {
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        return {
          category,
          total,
          items,
        };
      }
    );

    const totalExpenses = totalOperationalExpenses;
    // PENTING: Gunakan totalGrossProfit yang sudah dihitung ulang dengan COGS yang benar
    // Net Income = Gross Profit - Expenses + Other Income/Expense
    const netIncome =
      totalGrossProfit - totalExpenses + totalOtherIncomeExpense;

    // Get balance sheet data from JournalEntry with COA
    // Calculate balances from JournalEntry per COA category
    const allJournalEntries = await prisma.journalEntry.findMany({
      where: {
        coa: {
          gasStationId,
        },
        transaction: {
          approvalStatus: "APPROVED",
          date: {
            lte: endDateTime,
          },
        },
      },
      include: {
        coa: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        transaction: {
          select: {
            date: true,
          },
        },
      },
    });

    // Calculate balances per COA
    const coaBalances = new Map<string, number>();

    // Add journal entries
    allJournalEntries.forEach((entry) => {
      const currentBalance = coaBalances.get(entry.coaId) || 0;
      const debit = entry.debit;
      const credit = entry.credit;

      // Calculate balance based on category
      if (
        entry.coa.category === "ASSET" ||
        entry.coa.category === "EXPENSE" ||
        entry.coa.category === "COGS"
      ) {
        // Normal balance debit
        coaBalances.set(entry.coaId, currentBalance + debit - credit);
      } else {
        // Normal balance credit
        coaBalances.set(entry.coaId, currentBalance + credit - debit);
      }
    });

    // Get COAs for mapping
    const coas = await prisma.cOA.findMany({
      where: {
        gasStationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        category: true,
      },
    });

    // Group COAs by category with balance
    // PENTING: Tampilkan semua COA termasuk yang balance 0 untuk akuntansi lengkap
    const assets: Array<{ name: string; balance: number }> = [];
    const liabilities: Array<{ name: string; balance: number }> = [];
    const equity: Array<{ name: string; balance: number }> = [];

    // Calculate Realtime Profit/Loss from COA balances
    const revenueCOAs = coas.filter((coa) => coa.category === "REVENUE");
    const totalRevenueBalance = revenueCOAs.reduce(
      (sum, coa) => sum + (coaBalances.get(coa.id) || 0),
      0
    );

    const expenseCOAs = coas.filter((coa) => coa.category === "EXPENSE");
    const totalExpenseBalance = expenseCOAs.reduce(
      (sum, coa) => sum + (coaBalances.get(coa.id) || 0),
      0
    );

    const cogsCOAs = coas.filter((coa) => coa.category === "COGS");
    const totalCOGSBalance = cogsCOAs.reduce(
      (sum, coa) => sum + (coaBalances.get(coa.id) || 0),
      0
    );

    // Realtime P/L = Revenue - COGS - Expense (semua dari COA balance cumulative)
    const realtimeProfitLossBalance =
      totalRevenueBalance - totalCOGSBalance - totalExpenseBalance;

    coas.forEach((coa) => {
      const balance = coaBalances.get(coa.id) || 0;

      // Skip "Realtime Profit/Loss" dari list equity karena sudah digunakan untuk net income
      if (coa.name === "Realtime Profit/Loss") {
        return;
      }

      // Tampilkan semua COA termasuk yang balance 0 untuk akuntansi lengkap
      switch (coa.category) {
        case "ASSET":
          assets.push({ name: coa.name, balance });
          break;
        case "LIABILITY":
          liabilities.push({ name: coa.name, balance });
          break;
        case "EQUITY":
          equity.push({ name: coa.name, balance });
          break;
      }
    });

    // Sort by name
    assets.sort((a, b) => a.name.localeCompare(b.name));
    liabilities.sort((a, b) => a.name.localeCompare(b.name));
    equity.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate totals
    // Net income menggunakan balance dari COA "Realtime Profit/Loss" atau net income yang dihitung
    const balanceSheetNetIncome = realtimeProfitLossBalance || netIncome;
    const totalAssets = assets.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilities = liabilities.reduce(
      (sum, item) => sum + item.balance,
      0
    );
    const totalEquity =
      balanceSheetNetIncome +
      equity.reduce((sum, item) => sum + item.balance, 0);
    const totalLiabilitiesEquity = totalLiabilities + totalEquity;

    return {
      income: {
        byProduct: updatedIncomeByProduct,
        totalSales,
        totalCost, // Menggunakan stock movement method: openingValue + purchaseValue - pumpTestValue - closingValue
        totalGrossProfit,
        totalVariance,
      },
      stockValues: {
        byProduct: stockValuesByProduct,
        totalOpeningValue: stockValuesByProduct.reduce(
          (sum, p) => sum + p.openingValue,
          0
        ),
        totalPurchaseValue: stockValuesByProduct.reduce(
          (sum, p) => sum + p.purchaseValue,
          0
        ),
        totalClosingValue: stockValuesByProduct.reduce(
          (sum, p) => sum + p.closingValue,
          0
        ),
        totalPumpTestValue: stockValuesByProduct.reduce(
          (sum, p) => sum + (p.pumpTestValue || 0),
          0
        ),
        totalShrinkageValue: stockValuesByProduct.reduce(
          (sum, p) => sum + (p.shrinkageValue || 0),
          0
        ),
      },
      expenses: {
        byCategory: expensesByCategor,
        totalExpenses,
      },
      otherIncomeExpense: {
        adjustmentIncome: totalAdjustmentIncome, // Untuk backward compatibility
        adjustmentExpense: totalAdjustmentExpenses,
        totalRevenue: totalAllRevenue, // Semua pendapatan REVENUE
        revenueByCategory: revenueByCategoryArray, // Pendapatan REVENUE dikelompokkan per COA
        total: totalOtherIncomeExpense,
      },
      netIncome,
      balanceSheet: {
        assets,
        liabilities,
        equity,
        netIncome: balanceSheetNetIncome, // Menggunakan balance dari COA "Realtime Profit/Loss"
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesEquity,
      },
    };
  }
}
