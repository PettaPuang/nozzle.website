import { startOfDayUTC, addDaysUTC } from "../lib/utils/datetime";
import { createDepositApprovalTransaction } from "../lib/utils/transaction/transaction-deposit";
import { createUnloadDeliveryTransaction } from "../lib/utils/transaction/transaction-unload";
import {
  createTankReadingLossTransaction,
  createTankReadingProfitTransaction,
} from "../lib/utils/transaction/transaction-tank-reading";
import { findOrCreateCOA } from "../lib/utils/coa.utils";
import {
  prisma as sharedPrisma,
  retryDatabaseOperation,
  START_DATE,
  END_DATE,
  createDate,
  createPurchaseTransactionForSeed,
  createCashTransactionForSeed,
} from "./seed-helpers";

// Export prisma untuk digunakan di file seed individual
export { sharedPrisma as prisma };

/**
 * Generate operational data untuk satu SPBU
 * @param gasStationName - Nama SPBU (Makassar, Surabaya, atau Pangkep)
 * @param options - Opsi untuk date range dan shifts
 */
export async function seedOperationalData(
  gasStationName: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    shifts?: ("MORNING" | "AFTERNOON" | "NIGHT")[];
  }
) {
  // Gunakan parameter atau default ke START_DATE/END_DATE
  const startDate = options?.startDate || START_DATE;
  const endDate = options?.endDate || END_DATE;
  const shifts = options?.shifts || ["MORNING", "AFTERNOON", "NIGHT"];

  console.log(`🌱 Starting operational seed for ${gasStationName}...`);
  console.log(`   Date range: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);
  console.log(`   Shifts: ${shifts.join(", ")}`);

  // Get developer user
  const developer = await prisma.user.findUnique({
    where: { username: "developer" },
  });

  if (!developer) {
    throw new Error("Developer user not found. Please run seed-infrastructure first.");
  }

  // Get gas station
  const gasStation = await prisma.gasStation.findFirst({
    where: { name: { contains: gasStationName } },
    include: {
      products: true,
      tanks: true,
      stations: true,
    },
  });

  if (!gasStation) {
    throw new Error(`Gas station "${gasStationName}" not found. Please run seed-infrastructure first.`);
  }

  // Check jika sudah ada data operational untuk SPBU ini dalam date range yang sama
  const existingShift = await prisma.operatorShift.findFirst({
    where: {
      gasStationId: gasStation.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  if (existingShift) {
    console.log(`⚠️  Data operational untuk ${gasStationName} sudah ada!`);
    console.log(`   Menghapus data lama sebelum seed ulang...`);
    
    // Delete dalam urutan yang benar (child dulu, parent kemudian)
    // 1. Delete JournalEntry yang terkait dengan Transaction
    await retryDatabaseOperation(() =>
      prisma.journalEntry.deleteMany({
        where: {
          transaction: {
            gasStationId: gasStation.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      })
    );

    // 2. Delete Transaction
    await retryDatabaseOperation(() =>
      prisma.transaction.deleteMany({
        where: {
          gasStationId: gasStation.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    );

    // 3. Delete DepositDetail
    await retryDatabaseOperation(() =>
      prisma.depositDetail.deleteMany({
        where: {
          deposit: {
            operatorShift: {
              gasStationId: gasStation.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
            },
          },
        },
      })
    );

    // 4. Delete Deposit
    await retryDatabaseOperation(() =>
      prisma.deposit.deleteMany({
        where: {
          operatorShift: {
            gasStationId: gasStation.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      })
    );

    // 5. Delete NozzleReading
    await retryDatabaseOperation(() =>
      prisma.nozzleReading.deleteMany({
        where: {
          operatorShift: {
            gasStationId: gasStation.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      })
    );

    // 6. Delete TankReading
    await retryDatabaseOperation(() =>
      prisma.tankReading.deleteMany({
        where: {
          tank: {
            gasStationId: gasStation.id,
          },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    );

    // 7. Delete Unload (melalui relasi tank)
    await retryDatabaseOperation(() =>
      prisma.unload.deleteMany({
        where: {
          tank: {
            gasStationId: gasStation.id,
          },
          createdAt: {
            gte: START_DATE,
            lte: END_DATE,
          },
        },
      })
    );

    // 8. Delete OperatorShift (parent)
    await retryDatabaseOperation(() =>
      prisma.operatorShift.deleteMany({
        where: {
          gasStationId: gasStation.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    );

    console.log(`✅ Data lama berhasil dihapus. Melanjutkan seed...`);
  }

  // Get users untuk SPBU ini
  const manager = await prisma.user.findFirst({
    where: {
      username: { startsWith: `manager_${gasStation.id.slice(0, 8)}` },
    },
  });
  const finance = await prisma.user.findFirst({
    where: {
      username: { startsWith: `finance_${gasStation.id.slice(0, 8)}` },
    },
  });
  const unloader = await prisma.user.findFirst({
    where: {
      username: { startsWith: `unloader_${gasStation.id.slice(0, 8)}` },
    },
  });
  const operators = await prisma.user.findMany({
    where: {
      username: { startsWith: `operator_${gasStation.id.slice(0, 8)}` },
    },
  });

  if (!manager || !finance || !unloader || operators.length === 0) {
    throw new Error(`Users not found for ${gasStationName}. Please run seed-infrastructure first.`);
  }

  // 0. Buat Purchase Transaction SEBELUM tanggal start untuk menjelaskan initial stock
  // Purchase transaction dibuat untuk semua produk yang ada di SPBU ini
  console.log(`📦 Creating initial purchase transactions for ${gasStationName}...`);
  
  // Buat purchase transaction 3-5 hari sebelum startDate untuk menjelaskan initial stock
  const initialPurchaseDate = addDaysUTC(startDate, -Math.floor(Math.random() * 3) - 3);
  
  // Group tanks by product untuk menghitung total initial stock per product
  const productInitialStocks = new Map<string, number>();
  for (const tank of gasStation.tanks) {
    const currentStock = productInitialStocks.get(tank.productId) || 0;
    productInitialStocks.set(tank.productId, currentStock + tank.initialStock);
  }

  // Buat purchase transaction untuk setiap produk yang punya initial stock
  for (const [productId, totalInitialStock] of productInitialStocks.entries()) {
    const product = gasStation.products.find((p) => p.id === productId);
    if (!product) continue;

    // Purchase volume harus >= total initial stock untuk semua tank produk tersebut
    // Tambahkan buffer 20-30% untuk realisme
    const buffer = Math.floor(totalInitialStock * 0.2) + Math.floor(Math.random() * Math.floor(totalInitialStock * 0.1));
    const purchaseVolume = totalInitialStock + buffer;

    const purchaseTransaction = await retryDatabaseOperation(() =>
      createPurchaseTransactionForSeed({
        gasStationId: gasStation.id,
        productId: product.id,
        purchaseVolume,
        date: initialPurchaseDate,
        bankName: "BCA",
        referenceNumber: `PO-INITIAL-${gasStation.id.slice(0, 8)}-${product.name.toUpperCase().replace(/\s+/g, "-")}`,
        notes: `Pembelian awal untuk initial stock ${product.name}`,
        approverId: manager.id,
        createdById: developer.id,
      })
    );

    // Buat unload untuk setiap tank produk tersebut
    const tanksForProduct = gasStation.tanks.filter((t) => t.productId === productId);
    let remainingVolume = purchaseVolume;

    for (const tank of tanksForProduct) {
      // Distribusikan volume ke setiap tank sesuai proporsi initialStock
      const tankProportion = tank.initialStock / totalInitialStock;
      const tankVolume = Math.floor(purchaseVolume * tankProportion);
      const actualVolume = Math.min(tankVolume, remainingVolume);
      remainingVolume -= actualVolume;

      // Unload date beberapa hari setelah purchase
      const unloadDate = addDaysUTC(initialPurchaseDate, Math.floor(Math.random() * 2) + 1);
      
      // Delivered volume sedikit lebih kecil dari purchase (realisme: ada shrinkage)
      const deliveredVolume = actualVolume - Math.floor(Math.random() * 50);
      const literAmount = deliveredVolume;

      const unload = await retryDatabaseOperation(() =>
        prisma.unload.create({
          data: {
            tankId: tank.id,
            unloaderId: unloader.id,
            managerId: manager.id,
            purchaseTransactionId: purchaseTransaction.id,
            initialOrderVolume: actualVolume,
            deliveredVolume,
            literAmount,
            invoiceNumber: `INV-INITIAL-${tank.code}`,
            status: "APPROVED",
            createdById: developer.id,
          },
        })
      );

      await retryDatabaseOperation(() =>
        createUnloadDeliveryTransaction({
          unloadId: unload.id,
          gasStationId: gasStation.id,
          tankId: tank.id,
          productId: product.id,
          productName: product.name,
          purchasePrice: product.purchasePrice,
          deliveredVolume,
          realVolume: literAmount,
          purchaseTransactionId: purchaseTransaction.id,
          invoiceNumber: unload.invoiceNumber || null,
          createdById: unloader.id,
          approverId: manager.id,
        })
      );
    }
  }

  console.log(`✅ Initial purchase transactions created for ${gasStationName}`);

  // 1. Buat operasional: OperatorShift, NozzleReading, Deposit
  let currentDate = startOfDayUTC(startDate);
  let processedDays = 0;
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  while (currentDate <= endDate) {
    processedDays++;
    if (processedDays % 10 === 0 || processedDays === 1) {
      const dayProgress = Math.floor((processedDays / totalDays) * 100);
      console.log(
        `📅 ${gasStationName}: Processing day ${processedDays}/${totalDays} (${dayProgress}%) - ${currentDate.toISOString().split("T")[0]}`
      );
    }

    for (const station of gasStation.stations) {
      const nozzles = await retryDatabaseOperation(() =>
        prisma.nozzle.findMany({
          where: { stationId: station.id },
        })
      );

      if (nozzles.length === 0) continue;

      for (const shift of shifts) {
        // Pilih operator secara rotasi
        const operatorIndex =
          Math.floor(
            (currentDate.getTime() - startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ) % operators.length;
        const operatorId = operators[operatorIndex].id;

        // Get operator dengan profile untuk nama
        const operator = await retryDatabaseOperation(() =>
          prisma.user.findUnique({
            where: { id: operatorId },
            include: { profile: true },
          })
        );

        if (!operator) continue;

        // Buat operator shift
        const operatorShift = await retryDatabaseOperation(() =>
          prisma.operatorShift.create({
            data: {
              operatorId: operator.id,
              stationId: station.id,
              gasStationId: gasStation.id,
              shift,
              date: startOfDayUTC(currentDate),
              startTime: new Date(
                Date.UTC(
                  currentDate.getUTCFullYear(),
                  currentDate.getUTCMonth(),
                  currentDate.getUTCDate(),
                  shift === "MORNING" ? 6 : shift === "AFTERNOON" ? 14 : 22,
                  0,
                  0,
                  0
                )
              ),
              endTime: new Date(
                Date.UTC(
                  currentDate.getUTCFullYear(),
                  currentDate.getUTCMonth(),
                  currentDate.getUTCDate() + (shift === "NIGHT" ? 1 : 0),
                  shift === "MORNING" ? 14 : shift === "AFTERNOON" ? 22 : 6,
                  0,
                  0,
                  0
                )
              ),
              status: "COMPLETED",
              isVerified: true,
              createdById: developer.id,
            },
          })
        );

        // Buat nozzle readings (OPEN dan CLOSE)
        const openReadings = [];
        const closeReadings = [];

        for (const nozzle of nozzles) {
          const product = gasStation.products.find(
            (p) => p.id === nozzle.productId
          )!;

          // Open reading
          const openTotalizer = Math.floor(Math.random() * 50000) + 10000;
          const openReading = await retryDatabaseOperation(() =>
            prisma.nozzleReading.create({
              data: {
                operatorShiftId: operatorShift.id,
                nozzleId: nozzle.id,
                readingType: "OPEN",
                totalizerReading: openTotalizer,
                pumpTest: 0,
                priceSnapshot: product.sellingPrice,
                createdById: developer.id,
              },
            })
          );
          openReadings.push({ reading: openReading, nozzle, product });

          // Close reading dengan pump test
          const hasPumpTest = Math.random() < 0.1; // 10% chance
          const pumpTestVolume = hasPumpTest
            ? Math.floor(Math.random() * 15) + 5
            : 0;

          const totalVolumeInTotalizer =
            Math.floor(Math.random() * 2000) + 500;
          const salesVolume = totalVolumeInTotalizer - pumpTestVolume;
          const closeTotalizer = openTotalizer + totalVolumeInTotalizer;

          const closeReading = await retryDatabaseOperation(() =>
            prisma.nozzleReading.create({
              data: {
                operatorShiftId: operatorShift.id,
                nozzleId: nozzle.id,
                readingType: "CLOSE",
                totalizerReading: closeTotalizer,
                pumpTest: pumpTestVolume,
                priceSnapshot: product.sellingPrice,
                createdById: developer.id,
              },
            })
          );
          closeReadings.push({
            reading: closeReading,
            nozzle,
            product,
            salesVolume,
            pumpTest: pumpTestVolume,
          });
        }

        // Buat deposit jika ada sales
        if (closeReadings.length > 0) {
          const totalAmount = closeReadings.reduce((sum, cr) => {
            return sum + cr.salesVolume * cr.product.sellingPrice;
          }, 0);

          // Free fuel (5% chance)
          const hasFreeFuel = Math.random() < 0.05;
          let freeFuelAmount = 0;
          let freeFuelReason = "";
          const freeFuelReasons = [
            "Pelanggan VIP",
            "Kesalahan operator",
            "Promosi khusus",
            "Komplain pelanggan",
            "Bantuan sosial",
          ];

          if (hasFreeFuel && totalAmount > 50000) {
            freeFuelAmount = Math.floor(
              totalAmount * (Math.random() * 0.02 + 0.01)
            );
            freeFuelReason =
              freeFuelReasons[
                Math.floor(Math.random() * freeFuelReasons.length)
              ];
          }

          const depositReceived = totalAmount - freeFuelAmount;

          const deposit = await retryDatabaseOperation(() =>
            prisma.deposit.create({
              data: {
                operatorShiftId: operatorShift.id,
                adminFinanceId: finance.id,
                totalAmount,
                operatorDeclaredAmount: totalAmount,
                adminReceivedAmount: depositReceived,
                status: "APPROVED",
                notes:
                  freeFuelAmount > 0
                    ? `Free Fuel (Rp ${freeFuelAmount.toLocaleString(
                        "id-ID"
                      )}): ${freeFuelReason}`
                    : undefined,
                createdById: developer.id,
              },
            })
          );

          // Deposit details
          const cashPercentage = 0.6;
          const cashAmount = Math.floor(depositReceived * cashPercentage);
          const bankAmount = depositReceived - cashAmount;

          await retryDatabaseOperation(() =>
            prisma.depositDetail.create({
              data: {
                depositId: deposit.id,
                paymentAccount: "CASH",
                paymentMethod: "ETC",
                operatorAmount: cashAmount,
                adminAmount: cashAmount,
                createdById: developer.id,
              },
            })
          );

          if (bankAmount > 0) {
            const bankMethods = ["QRIS", "TRANSFER", "DEBIT_CARD"];
            const bankMethod =
              bankMethods[Math.floor(Math.random() * bankMethods.length)];

            await retryDatabaseOperation(() =>
              prisma.depositDetail.create({
                data: {
                  depositId: deposit.id,
                  paymentAccount: "BANK",
                  paymentMethod: bankMethod as any,
                  bankName: "BCA",
                  operatorAmount: bankAmount,
                  adminAmount: bankAmount,
                  createdById: developer.id,
                },
              })
            );
          }

          // Buat transaksi REVENUE dan COGS
          const productSalesMap = new Map<
            string,
            {
              salesVolume: number;
              sellingPrice: number;
              purchasePrice: number;
            }
          >();
          const pumpTestMap = new Map<
            string,
            { volume: number; purchasePrice: number }
          >();

          for (const cr of closeReadings) {
            if (cr.salesVolume === 0) continue;

            const existing = productSalesMap.get(cr.product.name) || {
              salesVolume: 0,
              sellingPrice: cr.product.sellingPrice,
              purchasePrice: cr.product.purchasePrice,
            };
            existing.salesVolume += cr.salesVolume;
            productSalesMap.set(cr.product.name, existing);

            const pumpTestVolume = cr.pumpTest || 0;
            if (pumpTestVolume > 0) {
              const existingPumpTest = pumpTestMap.get(cr.product.name) || {
                volume: 0,
                purchasePrice: cr.product.purchasePrice,
              };
              existingPumpTest.volume += pumpTestVolume;
              pumpTestMap.set(cr.product.name, existingPumpTest);
            }
          }

          const productSales = Array.from(productSalesMap.entries()).map(
            ([productName, data]) => ({
              productName,
              salesVolume: data.salesVolume,
              sellingPrice: data.sellingPrice,
              purchasePrice: data.purchasePrice,
            })
          );

          const pumpTestByProduct = Array.from(pumpTestMap.entries()).map(
            ([productName, data]) => ({
              productName,
              pumpTestVolume: data.volume,
              purchasePrice: data.purchasePrice,
            })
          );

          const depositDetails = [];
          if (cashAmount > 0) {
            depositDetails.push({
              paymentAccount: "CASH" as const,
              paymentMethod: "ETC" as const,
              amount: cashAmount,
            });
          }
          if (bankAmount > 0) {
            const bankMethods = ["QRIS", "TRANSFER", "DEBIT_CARD"];
            const bankMethod =
              bankMethods[Math.floor(Math.random() * bankMethods.length)];
            depositDetails.push({
              paymentAccount: "BANK" as const,
              paymentMethod: bankMethod as any,
              bankName: "BCA",
              amount: bankAmount,
            });
          }

          // Gunakan retry untuk createDepositApprovalTransaction
          await retryDatabaseOperation(() =>
            createDepositApprovalTransaction({
              depositId: deposit.id,
              gasStationId: gasStation.id,
              salesValue: totalAmount,
              depositDetails,
              productSales,
              pumpTestByProduct:
                pumpTestByProduct.length > 0 ? pumpTestByProduct : undefined,
              freeFuelAmount: freeFuelAmount > 0 ? freeFuelAmount : undefined,
              freeFuelReason: freeFuelAmount > 0 ? freeFuelReason : undefined,
              createdById: finance.id,
              approverId: manager.id,
              shift: shift,
              stationName: station.name,
              shiftDate: startOfDayUTC(currentDate),
              operatorName:
                operator.profile?.name || `Operator ${operatorIndex + 1}`,
            })
          );
        }
      }
    }

    currentDate = addDaysUTC(currentDate, 1);
    
    // Tambahkan delay kecil setiap 10 hari untuk mengurangi beban database
    if (processedDays % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
    }
  }

  console.log(`✅ Operational data created for ${gasStationName}`);

  // 2. Buat TankReading dengan variance
  const readingDates = [
    createDate(2025, 11, 22),
    createDate(2025, 11, 29),
    createDate(2025, 12, 6),
    createDate(2025, 12, 13),
    createDate(2025, 12, 20),
    createDate(2025, 12, 27),
    createDate(2026, 1, 3),
    createDate(2026, 1, 10),
  ];

  for (const readingDate of readingDates) {
    const tanksToRead = gasStation.tanks.filter(() => Math.random() > 0.3);

    for (const tank of tanksToRead) {
      const product = gasStation.products.find(
        (p) => p.id === tank.productId
      )!;

      const baseStock = tank.initialStock;
      const daysSinceStart = Math.floor(
        (readingDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const estimatedUnloads = daysSinceStart * 500;
      const estimatedSales = daysSinceStart * 800;
      const stockRealtime = Math.max(
        0,
        baseStock + estimatedUnloads - estimatedSales
      );

      const variance = Math.floor(Math.random() * 100) - 50;
      const literValue = stockRealtime + variance;
      const finalLiterValue = Math.max(0, literValue);
      const finalVariance = finalLiterValue - stockRealtime;

      const tankReading = await retryDatabaseOperation(() =>
        prisma.tankReading.create({
          data: {
            tankId: tank.id,
            loaderId: unloader.id,
            approverId: manager.id,
            date: startOfDayUTC(readingDate),
            literValue: finalLiterValue,
            variance: finalVariance,
            approvalStatus: "APPROVED",
            notes:
              finalVariance < 0
                ? `Tank reading menunjukkan loss ${Math.abs(finalVariance)}L`
                : finalVariance > 0
                ? `Tank reading menunjukkan gain ${finalVariance}L`
                : "Tank reading sesuai dengan perhitungan",
            createdById: developer.id,
          },
        })
      );

      if (Math.abs(finalVariance) > 10) {
        if (finalVariance < 0) {
          await retryDatabaseOperation(() =>
            createTankReadingLossTransaction({
              tankReadingId: tankReading.id,
              gasStationId: gasStation.id,
              productName: product.name.trim(),
              lossAmount: Math.abs(finalVariance),
              purchasePrice: product.purchasePrice,
              createdById: unloader.id,
            })
          );
        } else if (finalVariance > 0) {
          await retryDatabaseOperation(() =>
            createTankReadingProfitTransaction({
              tankReadingId: tankReading.id,
              gasStationId: gasStation.id,
              productName: product.name.trim(),
              profitAmount: finalVariance,
              purchasePrice: product.purchasePrice,
              createdById: unloader.id,
            })
          );
        }
      }
    }
  }

  console.log(`✅ TankReading with variance created for ${gasStationName}`);

  // 4. Buat cash transaction: EXPENSE & TRANSFER
  const expenseDates = [
    createDate(2025, 11, 25),
    createDate(2025, 12, 1),
    createDate(2025, 12, 10),
    createDate(2025, 12, 15),
    createDate(2025, 12, 25),
    createDate(2026, 1, 1),
    createDate(2026, 1, 10),
  ];

  const expenseCategories = [
    {
      name: "Biaya Listrik",
      amount: () => Math.floor(Math.random() * 2000000) + 500000,
    },
    {
      name: "Biaya Air",
      amount: () => Math.floor(Math.random() * 500000) + 200000,
    },
    {
      name: "Biaya Gaji Karyawan",
      amount: () => Math.floor(Math.random() * 10000000) + 5000000,
    },
    {
      name: "Biaya Maintenance",
      amount: () => Math.floor(Math.random() * 3000000) + 1000000,
    },
    {
      name: "Biaya BBM Operasional",
      amount: () => Math.floor(Math.random() * 2000000) + 500000,
    },
    {
      name: "Biaya Internet",
      amount: () => Math.floor(Math.random() * 500000) + 200000,
    },
    {
      name: "Biaya Keamanan",
      amount: () => Math.floor(Math.random() * 1500000) + 500000,
    },
    {
      name: "Biaya Kebersihan",
      amount: () => Math.floor(Math.random() * 1000000) + 300000,
    },
  ];

  for (const expenseDate of expenseDates) {
    const expenseCategory =
      expenseCategories[
        Math.floor(Math.random() * expenseCategories.length)
      ];
    const expenseAmount = expenseCategory.amount();

    const expenseCOA = await findOrCreateCOA({
      gasStationId: gasStation.id,
      name: expenseCategory.name,
      category: "EXPENSE",
      description: `Akun beban untuk ${expenseCategory.name}`,
      createdById: developer.id,
    });

    await createCashTransactionForSeed({
      gasStationId: gasStation.id,
      date: expenseDate,
      description: `${expenseCategory.name} - ${expenseDate.toISOString().split("T")[0]}`,
      cashTransactionType: "EXPENSE",
      paymentAccount: Math.random() > 0.5 ? "CASH" : "BANK",
      bankName: "BCA",
      coaId: expenseCOA.id,
      amount: expenseAmount,
      approverId: manager.id,
      createdById: developer.id,
    });
  }

  // Transfer transactions
  const transferDates = [
    createDate(2025, 11, 28),
    createDate(2025, 12, 5),
    createDate(2025, 12, 12),
    createDate(2025, 12, 19),
    createDate(2025, 12, 26),
    createDate(2026, 1, 2),
    createDate(2026, 1, 9),
  ];

  for (const transferDate of transferDates) {
    const transferAmount = Math.floor(Math.random() * 5000000) + 2000000;
    const isCashToBank = Math.random() > 0.5;

    await createCashTransactionForSeed({
      gasStationId: gasStation.id,
      date: transferDate,
      description: isCashToBank
        ? "Transfer Kas ke Bank"
        : "Transfer Bank ke Kas",
      cashTransactionType: "TRANSFER",
      paymentAccount: isCashToBank ? "CASH" : "BANK",
      bankName: isCashToBank ? undefined : "BCA",
      toPaymentAccount: isCashToBank ? "BANK" : "CASH",
      toBankName: isCashToBank ? "BCA" : undefined,
      amount: transferAmount,
      approverId: manager.id,
      createdById: developer.id,
    });
  }

  console.log(`✅ Cash transactions (EXPENSE & TRANSFER) created for ${gasStationName}`);
  console.log(`🎉 Operational seed completed for ${gasStationName}!`);
}

