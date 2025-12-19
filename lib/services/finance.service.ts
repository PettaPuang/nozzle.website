import { prisma } from "@/lib/prisma";

export type DepositWithDetails = {
  id: string;
  operatorShiftId: string;
  totalAmount: number;
  operatorDeclaredAmount: number;
  adminReceivedAmount: number | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  operatorShift: {
    id: string;
    shift: string;
    date: Date;
    startTime: Date | null;
    endTime: Date | null;
    operator: {
      username: string;
      profile: {
        name: string;
      } | null;
    };
    station: {
      code: string;
      name: string;
    };
  };
  depositDetails: Array<{
    id: string;
    paymentAccount: string;
    paymentMethod: string | null;
    bankName: string | null;
    operatorAmount: number;
    adminAmount: number | null;
  }>;
  totalSales?: number;
  nozzleDetails?: Array<{
    nozzleId: string;
    nozzleCode: string;
    nozzleName: string;
    productName: string;
    openReading: number;
    closeReading: number;
    pumpTest: number;
    salesVolume: number;
    pricePerLiter: number;
    totalAmount: number;
    openImageUrl?: string | null;
    closeImageUrl?: string | null;
  }>;
  adminFinance: {
    username: string;
    profile: {
      name: string;
    } | null;
  } | null;
  // Flag untuk menandai apakah ini shift yang belum ada deposit
  hasDeposit?: boolean;
};

export type PaymentMethodBalance = {
  paymentMethod: string;
  totalIn: number;
  totalOut: number;
  balance: number;
};

export type TransactionHistory = {
  id: string;
  type: "IN" | "OUT" | "TRANSFER";
  source: "DEPOSIT" | "EXPENSE" | "TRANSFER";
  paymentMethod: string;
  amount: number;
  description: string;
  date: Date;
  status: string;
  transactionType?: string; // CASH, PURCHASE_BBM, etc.
  createdByRole?: string; // Role dari user yang membuat transaksi
  approverRole?: string; // Role dari user yang approve transaksi
};

export class FinanceService {
  /**
   * Get pending deposits for a gas station
   * Includes both deposits with PENDING status and completed shifts without deposit
   */
  static async getPendingDeposits(
    gasStationId: string
  ): Promise<DepositWithDetails[]> {
    // 1. Get deposits with PENDING atau REJECTED status
    // REJECTED bisa diinput ulang, jadi harus muncul di deposit input table
    const deposits = await prisma.deposit.findMany({
      where: {
        operatorShift: {
          gasStationId: gasStationId,
        },
        status: {
          in: ["PENDING", "REJECTED"], // Include REJECTED agar bisa diinput ulang
        },
      },
      include: {
        operatorShift: {
          include: {
            operator: {
              select: {
                username: true,
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            station: {
              select: {
                code: true,
                name: true,
              },
            },
            nozzleReadings: {
              include: {
                nozzle: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
        depositDetails: {
          select: {
            id: true,
            paymentAccount: true,
            paymentMethod: true,
            bankName: true,
            operatorAmount: true,
            adminAmount: true,
          },
        },
        adminFinance: {
          select: {
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 2. Get completed shifts yang sudah verified tapi belum ada deposit
    // Hanya shift yang sudah diverifikasi yang bisa diinput deposit
    const shiftsWithoutDeposit = await prisma.operatorShift.findMany({
      where: {
        gasStationId: gasStationId,
        status: "COMPLETED",
        isVerified: true, // Hanya shift yang sudah diverifikasi
        deposit: null, // Belum ada deposit
      },
      include: {
        operator: {
          select: {
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        station: {
          select: {
            code: true,
            name: true,
          },
        },
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        endTime: "desc", // Order by endTime untuk menampilkan yang paling baru selesai
      },
    });

    // 3. Process deposits with PENDING atau REJECTED status
    const processedDeposits = deposits.map((deposit) => {
      // Calculate nozzle details
      const openReadings = deposit.operatorShift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = deposit.operatorShift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      let totalSales = 0;
      const nozzleDetails: any[] = [];

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const salesVolume =
            Number(closeReading.totalizerReading) -
            Number(openReading.totalizerReading) -
            Number(closeReading.pumpTest);

          const totalAmount = salesVolume * Number(closeReading.priceSnapshot);

          if (salesVolume > 0) {
            totalSales += totalAmount;
          }

          nozzleDetails.push({
            nozzleId: closeReading.nozzleId,
            nozzleCode: closeReading.nozzle.code,
            nozzleName: closeReading.nozzle.name,
            productName: closeReading.nozzle.product.name,
            openReading: Number(openReading.totalizerReading),
            closeReading: Number(closeReading.totalizerReading),
            pumpTest: Number(closeReading.pumpTest),
            salesVolume,
            pricePerLiter: Number(closeReading.priceSnapshot),
            totalAmount,
            openImageUrl: openReading.imageUrl,
            closeImageUrl: closeReading.imageUrl,
          });
        }
      });

      return {
        ...deposit,
        totalAmount: deposit.totalAmount, // Sudah Int
        operatorDeclaredAmount: deposit.operatorDeclaredAmount, // Sudah Int
        adminReceivedAmount: deposit.adminReceivedAmount, // Sudah Int atau null
        totalSales,
        nozzleDetails,
        depositDetails: deposit.depositDetails.map((detail) => ({
          id: detail.id,
          paymentAccount: detail.paymentAccount,
          paymentMethod: detail.paymentMethod || null,
          bankName: detail.bankName || null,
          operatorAmount: detail.operatorAmount, // Sudah Int
          adminAmount: detail.adminAmount, // Sudah Int atau null
        })),
        hasDeposit: true,
      };
    });

    // 4. Process shifts without deposit
    const processedShifts = shiftsWithoutDeposit.map((shift) => {
      // Calculate nozzle details
      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      let totalSales = 0;
      const nozzleDetails: any[] = [];

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const salesVolume =
            Number(closeReading.totalizerReading) -
            Number(openReading.totalizerReading) -
            Number(closeReading.pumpTest);

          const totalAmount = salesVolume * Number(closeReading.priceSnapshot);

          if (salesVolume > 0) {
            totalSales += totalAmount;
          }

          nozzleDetails.push({
            nozzleId: closeReading.nozzleId,
            nozzleCode: closeReading.nozzle.code,
            nozzleName: closeReading.nozzle.name,
            productName: closeReading.nozzle.product.name,
            openReading: Number(openReading.totalizerReading),
            closeReading: Number(closeReading.totalizerReading),
            pumpTest: Number(closeReading.pumpTest),
            salesVolume,
            pricePerLiter: Number(closeReading.priceSnapshot),
            totalAmount,
            openImageUrl: openReading.imageUrl,
            closeImageUrl: closeReading.imageUrl,
          });
        }
      });

      // Create a DepositWithDetails-like object for shifts without deposit
      // Status tidak ada karena deposit belum dibuat
      return {
        id: "", // Empty karena belum ada deposit
        operatorShiftId: shift.id,
        totalAmount: totalSales,
        operatorDeclaredAmount: 0, // Belum diinput
        adminReceivedAmount: null,
        status: "", // Status kosong karena deposit belum dibuat
        notes: null,
        createdAt: shift.endTime || shift.updatedAt,
        updatedAt: shift.updatedAt,
        operatorShift: {
          id: shift.id,
          shift: shift.shift,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          operator: shift.operator,
          station: shift.station,
        },
        depositDetails: [],
        totalSales,
        nozzleDetails,
        adminFinance: null,
        hasDeposit: false,
      };
    });

    // 5. Combine and sort by date (most recent first)
    return [...processedDeposits, ...processedShifts].sort((a, b) => {
      const dateA = a.createdAt.getTime();
      const dateB = b.createdAt.getTime();
      return dateB - dateA;
    });
  }

  /**
   * Get deposit history (PENDING/APPROVED/REJECTED) for a gas station
   */
  static async getDepositHistory(
    gasStationId: string
  ): Promise<DepositWithDetails[]> {
    const deposits = await prisma.deposit.findMany({
      where: {
        operatorShift: {
          gasStationId: gasStationId,
        },
        status: {
          in: ["PENDING", "APPROVED", "REJECTED"],
        },
      },
      include: {
        operatorShift: {
          select: {
            id: true,
            shift: true,
            date: true,
            startTime: true,
            endTime: true,
            operator: {
              select: {
                username: true,
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            station: {
              select: {
                code: true,
                name: true,
              },
            },
            nozzleReadings: {
              include: {
                nozzle: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
        depositDetails: {
          select: {
            id: true,
            paymentAccount: true,
            paymentMethod: true,
            bankName: true,
            operatorAmount: true,
            adminAmount: true,
          },
        },
        adminFinance: {
          select: {
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return deposits.map((deposit) => {
      // Calculate nozzle details
      const openReadings = deposit.operatorShift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = deposit.operatorShift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      let totalSales = 0;
      const nozzleDetails: any[] = [];

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const salesVolume =
            Number(closeReading.totalizerReading) -
            Number(openReading.totalizerReading) -
            Number(closeReading.pumpTest);

          const totalAmount = salesVolume * Number(closeReading.priceSnapshot);

          if (salesVolume > 0) {
            totalSales += totalAmount;
          }

          nozzleDetails.push({
            nozzleId: closeReading.nozzleId,
            nozzleCode: closeReading.nozzle.code,
            nozzleName: closeReading.nozzle.name,
            productName: closeReading.nozzle.product.name,
            openReading: Number(openReading.totalizerReading),
            closeReading: Number(closeReading.totalizerReading),
            pumpTest: Number(closeReading.pumpTest),
            salesVolume,
            pricePerLiter: Number(closeReading.priceSnapshot),
            totalAmount,
            openImageUrl: openReading.imageUrl,
            closeImageUrl: closeReading.imageUrl,
          });
        }
      });

      return {
        ...deposit,
        totalAmount: deposit.totalAmount, // Sudah Int
        operatorDeclaredAmount: deposit.operatorDeclaredAmount, // Sudah Int
        adminReceivedAmount: deposit.adminReceivedAmount, // Sudah Int atau null
        totalSales,
        nozzleDetails,
        depositDetails: deposit.depositDetails.map((detail) => ({
          id: detail.id,
          paymentAccount: detail.paymentAccount,
          paymentMethod: detail.paymentMethod || null,
          bankName: detail.bankName || null,
          operatorAmount: detail.operatorAmount, // Sudah Int
          adminAmount: detail.adminAmount, // Sudah Int atau null
        })),
      };
    });
  }

  /**
   * Count pending deposits for Finance (shifts COMPLETED, verified, without deposit)
   */
  static async countPendingDepositsForFinance(
    gasStationId: string
  ): Promise<number> {
    return await prisma.operatorShift.count({
      where: {
        gasStationId: gasStationId,
        status: "COMPLETED",
        isVerified: true, // Hanya shift yang sudah diverifikasi
        deposit: null, // Shifts that are completed but have no deposit yet
      },
    });
  }

  /**
   * Count shifts that need verification (shifts COMPLETED but not verified)
   */
  static async countShiftsToVerify(gasStationId: string): Promise<number> {
    return await prisma.operatorShift.count({
      where: {
        gasStationId: gasStationId,
        status: "COMPLETED",
        isVerified: false, // Hanya shift yang belum diverifikasi
        deposit: null, // Belum ada deposit
      },
    });
  }

  /**
   * Count pending deposits for Manager (deposits with PENDING status)
   */
  static async countPendingDepositsForManager(
    gasStationId: string
  ): Promise<number> {
    return await prisma.deposit.count({
      where: {
        operatorShift: {
          gasStationId: gasStationId,
        },
        status: "PENDING",
      },
    });
  }

  /**
   * Get balance per payment method for a gas station
   * Mengambil langsung dari COA Kas dan Bank untuk akurasi
   */
  static async getPaymentMethodBalance(
    gasStationId: string
  ): Promise<PaymentMethodBalance[]> {
    // Get COA Kas dan Bank beserta journal entries
    const cashBankCOAs = await prisma.cOA.findMany({
      where: {
        gasStationId: gasStationId,
        category: "ASSET",
        OR: [{ name: "Kas" }, { name: { startsWith: "Bank" } }],
        status: "ACTIVE",
      },
      include: {
        journalEntries: {
          where: {
            transaction: {
              gasStationId: gasStationId,
              approvalStatus: "APPROVED",
            },
          },
        },
      },
    });

    // Calculate balance per payment account (CASH, BANK)
    const balanceMap = new Map<string, PaymentMethodBalance>();

    // Initialize payment accounts
    const paymentAccounts = ["CASH", "BANK"];

    paymentAccounts.forEach((account) => {
      balanceMap.set(account, {
        paymentMethod: account,
        totalIn: 0,
        totalOut: 0,
        balance: 0,
      });
    });

    // Process each COA
    cashBankCOAs.forEach((coa) => {
      // Determine payment account
      const paymentAccount = coa.name === "Kas" ? "CASH" : "BANK";
      const balance = balanceMap.get(paymentAccount);

      if (balance) {
        // Calculate totalIn (debit) dan totalOut (credit) dari journal entries
        const totalIn = coa.journalEntries.reduce(
          (sum, entry) => sum + entry.debit,
          0
        );
        const totalOut = coa.journalEntries.reduce(
          (sum, entry) => sum + entry.credit,
          0
        );

        balance.totalIn += totalIn;
        balance.totalOut += totalOut;
      }
    });

    // Calculate final balance
    balanceMap.forEach((balance) => {
      balance.balance = balance.totalIn - balance.totalOut;
    });

    return Array.from(balanceMap.values());
  }

  /**
   * Get balance per payment method based on date range
   * Mengambil langsung dari COA Kas dan Bank dengan filter dateRange
   */
  static async getPaymentMethodBalanceByDateRange(
    gasStationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    cash: {
      saldoAwal: number;
      totalIn: number;
      totalOut: number;
      totalBalance: number;
    };
    bank: {
      saldoAwal: number;
      totalIn: number;
      totalOut: number;
      totalBalance: number;
    };
  }> {
    // Get COA Kas dan Bank
    const cashBankCOAs = await prisma.cOA.findMany({
      where: {
        gasStationId: gasStationId,
        category: "ASSET",
        OR: [{ name: "Kas" }, { name: { startsWith: "Bank" } }],
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
    });

    const cashCOAIds = cashBankCOAs
      .filter((coa) => coa.name === "Kas")
      .map((coa) => coa.id);
    const bankCOAIds = cashBankCOAs
      .filter((coa) => coa.name.startsWith("Bank"))
      .map((coa) => coa.id);

    // Helper function untuk menghitung balance per COA
    const calculateBalanceForCOAs = async (
      coaIds: string[],
      startDate: Date,
      endDate: Date
    ) => {
      if (coaIds.length === 0) {
        return {
          saldoAwal: 0,
          totalIn: 0,
          totalOut: 0,
          totalBalance: 0,
        };
      }

      // Saldo awal: balance sebelum startDate
      const saldoAwalResult = await prisma.journalEntry.aggregate({
        where: {
          coaId: { in: coaIds },
          transaction: {
            gasStationId: gasStationId,
            approvalStatus: "APPROVED",
            date: {
              lt: startDate,
            },
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const saldoAwal =
        (saldoAwalResult._sum.debit || 0) - (saldoAwalResult._sum.credit || 0);

      // TotalIn dan TotalOut dalam dateRange
      const inRangeResult = await prisma.journalEntry.aggregate({
        where: {
          coaId: { in: coaIds },
          transaction: {
            gasStationId: gasStationId,
            approvalStatus: "APPROVED",
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const totalIn = inRangeResult._sum.debit || 0;
      const totalOut = inRangeResult._sum.credit || 0;
      const totalBalance = saldoAwal + totalIn - totalOut;

      return {
        saldoAwal,
        totalIn,
        totalOut,
        totalBalance,
      };
    };

    const [cashBalance, bankBalance] = await Promise.all([
      calculateBalanceForCOAs(cashCOAIds, startDate, endDate),
      calculateBalanceForCOAs(bankCOAIds, startDate, endDate),
    ]);

    return {
      cash: cashBalance,
      bank: bankBalance,
    };
  }

  /**
   * Get transaction history (deposits + expenses) for a gas station
   */
  static async getTransactionHistory(
    gasStationId: string
  ): Promise<TransactionHistory[]> {
    const transactions: TransactionHistory[] = [];

    // Get verified deposits
    const deposits = await prisma.deposit.findMany({
      where: {
        operatorShift: {
          gasStationId: gasStationId,
        },
        status: "APPROVED",
      },
      include: {
        depositDetails: true,
        operatorShift: {
          include: {
            operator: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Add deposits to transactions (hanya CASH saja)
    // Exclude COUPON karena coupon tidak mempengaruhi saldo kas (sudah tercatat di COA Hutang Coupon)
    deposits.forEach((deposit) => {
      deposit.depositDetails.forEach((detail) => {
        // Hanya CASH saja, skip coupon dan bank
        if (
          detail.paymentMethod === "COUPON" ||
          detail.paymentAccount !== "CASH" ||
          detail.operatorAmount <= 0
        ) {
          return;
        }

        transactions.push({
          id: detail.id,
          type: "IN",
          source: "DEPOSIT",
          paymentMethod: "CASH",
          amount: detail.operatorAmount, // Sudah Int
          description: `Setoran ${
            deposit.operatorShift.operator.profile?.name || "Operator"
          }`,
          date: deposit.updatedAt,
          status: deposit.status,
          transactionType: undefined, // Deposit bukan transaction, jadi undefined
          createdByRole: undefined, // Deposit dibuat oleh operator, bukan finance
        });
      });
    });

    // Get all Kas dan Bank journal entries untuk mendapatkan semua transaksi yang mempengaruhi kas dan bank
    // CASH, PURCHASE_BBM, dan ADJUSTMENT dengan status PENDING atau APPROVED
    // COA Kas dan Bank (name = "Kas" atau name startsWith "Bank")
    // Note: Admin transaction dengan type MANUAL akan disimpan sebagai ADJUSTMENT
    const cashBankEntries = await prisma.journalEntry.findMany({
      where: {
        coa: {
          gasStationId: gasStationId,
          category: "ASSET",
          OR: [
            { name: "Kas" },
            { name: { startsWith: "Bank" } }, // Include Bank entries
          ],
        },
        transaction: {
          gasStationId: gasStationId,
          transactionType: {
            in: ["CASH", "PURCHASE_BBM", "ADJUSTMENT"], // Cash, Purchase BBM, dan Adjustment (termasuk manual dari admin)
          },
          approvalStatus: {
            in: ["PENDING", "APPROVED"], // PENDING dan APPROVED
          },
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            transactionType: true,
            description: true,
            date: true,
            createdAt: true,
            approvalStatus: true,
            createdBy: {
              select: {
                role: true,
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            approver: {
              select: {
                role: true,
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            journalEntries: {
              include: {
                coa: true,
              },
            },
          },
        },
        coa: true,
      },
      orderBy: {
        transaction: {
          createdAt: "desc",
        },
      },
    });

    // Get deposit transaction IDs untuk menghindari duplikasi
    const depositTransactionIds = new Set(
      deposits.flatMap((deposit) => (deposit.id ? [deposit.id] : []))
    );

    // Process Kas dan Bank entries - sederhana: debit = masuk (IN), credit = keluar (OUT)
    cashBankEntries.forEach((entry) => {
      // Skip jika ini dari deposit approval (sudah di-handle di atas)
      // Deposit approval transaction biasanya memiliki COA "Piutang Usaha" yang di-credit
      const hasReceivableCOA = entry.transaction.journalEntries.some(
        (je) => je.coa.name === "Piutang Usaha" && je.credit > 0
      );

      if (hasReceivableCOA) {
        return; // Skip deposit approval transaction
      }

      // Tentukan payment method berdasarkan COA
      const isBankCOA = entry.coa.name.startsWith("Bank");
      const paymentMethod = isBankCOA ? "BANK" : "CASH";

      // Cek apakah ini transaksi TRANSFER (ada debit dan credit dalam COA yang sama dalam transaksi yang sama)
      // Untuk Kas: transfer antar Kas
      // Untuk Bank: transfer antar Bank (atau Kas-Bank)
      const hasSameCOADebit = entry.transaction.journalEntries.some(
        (je) => je.coaId === entry.coaId && je.debit > 0
      );
      const hasSameCOACredit = entry.transaction.journalEntries.some(
        (je) => je.coaId === entry.coaId && je.credit > 0
      );
      const isTransfer = hasSameCOADebit && hasSameCOACredit;

      // Debit Kas/Bank = masuk (IN) - termasuk adjustment
      if (entry.debit > 0 && !isTransfer) {
        // Tentukan source berdasarkan COA yang di-credit atau transactionType
        const otherEntry = entry.transaction.journalEntries.find(
          (je) => je.coaId !== entry.coaId
        );

        let source: "DEPOSIT" | "EXPENSE" | "TRANSFER" = "TRANSFER";
        if (entry.transaction.transactionType === "ADJUSTMENT") {
          source = "EXPENSE"; // Adjustment masuk kas/bank = penyesuaian
        } else if (otherEntry) {
          if (
            otherEntry.coa.category === "REVENUE" ||
            otherEntry.coa.category === "ASSET" ||
            otherEntry.coa.category === "LIABILITY"
          ) {
            source = "TRANSFER";
          } else if (otherEntry.coa.category === "EXPENSE") {
            source = "EXPENSE";
          }
        }

        // Gunakan createdAt untuk waktu yang akurat, date untuk tanggal transaksi
        const transactionDate = new Date(entry.transaction.date);
        const transactionTime = new Date(entry.transaction.createdAt);
        // Gabungkan tanggal dari date dengan waktu dari createdAt
        const combinedDate = new Date(
          transactionDate.getFullYear(),
          transactionDate.getMonth(),
          transactionDate.getDate(),
          transactionTime.getHours(),
          transactionTime.getMinutes(),
          transactionTime.getSeconds()
        );

        transactions.push({
          id: `${entry.transaction.id}-income-${entry.id}`,
          type: "IN",
          source: source,
          paymentMethod: paymentMethod, // Use BANK or CASH based on COA
          amount: entry.debit,
          description:
            entry.transaction.description ||
            (entry.transaction.transactionType === "ADJUSTMENT"
              ? "Penyesuaian"
              : "Pemasukan"),
          date: combinedDate,
          status: entry.transaction.approvalStatus,
          transactionType: entry.transaction.transactionType,
          createdByRole: entry.transaction.createdBy?.role || undefined,
          approverRole: entry.transaction.approver?.role || undefined,
        });
      }

      // Credit Kas/Bank = keluar (OUT) - termasuk adjustment
      if (entry.credit > 0 && !isTransfer) {
        // Gunakan createdAt untuk waktu yang akurat, date untuk tanggal transaksi
        const transactionDate = new Date(entry.transaction.date);
        const transactionTime = new Date(entry.transaction.createdAt);
        // Gabungkan tanggal dari date dengan waktu dari createdAt
        const combinedDate = new Date(
          transactionDate.getFullYear(),
          transactionDate.getMonth(),
          transactionDate.getDate(),
          transactionTime.getHours(),
          transactionTime.getMinutes(),
          transactionTime.getSeconds()
        );

        transactions.push({
          id: `${entry.transaction.id}-expense-${entry.id}`,
          type: "OUT",
          source: "EXPENSE",
          paymentMethod: paymentMethod, // Use BANK or CASH based on COA
          amount: entry.credit,
          description:
            entry.transaction.description ||
            (entry.transaction.transactionType === "PURCHASE_BBM"
              ? "Pembelian BBM"
              : entry.transaction.transactionType === "ADJUSTMENT"
              ? "Penyesuaian"
              : "Pengeluaran"),
          date: combinedDate,
          status: entry.transaction.approvalStatus,
          transactionType: entry.transaction.transactionType,
          createdByRole: entry.transaction.createdBy?.role || undefined,
          approverRole: entry.transaction.approver?.role || undefined,
        });
      }
    });

    // Sort by date descending
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return transactions;
  }
}
