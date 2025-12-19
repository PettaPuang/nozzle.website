import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";

export type TransactionWithDetails = Awaited<
  ReturnType<typeof TransactionService.getTransactionById>
>;

export class TransactionService {
  /**
   * Get transaction by ID
   */
  static async getTransactionById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
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
            id: true,
            username: true,
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
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return transaction;
  }

  /**
   * Get all transactions for a gas station
   */
  static async getTransactionsByGasStation(
    gasStationId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {
      gasStationId,
    };

    if (startDate && endDate) {
      where.date = {
        gte: startOfDayUTC(startDate),
        lte: endOfDayUTC(endDate),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
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
      orderBy: {
        date: "desc",
      },
    });

    return transactions;
  }

  /**
   * Get transactions pending approval
   * Hanya menampilkan PURCHASE_BBM dan CASH yang perlu approval manager
   */
  static async getPendingApprovalTransactions(gasStationId: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        approvalStatus: "PENDING",
        transactionType: {
          in: ["PURCHASE_BBM", "CASH"],
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
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
      orderBy: [{ createdAt: "desc" }],
    });

    return transactions;
  }

  /**
   * Count pending approval transactions
   * Hanya menghitung PURCHASE_BBM dan CASH yang perlu approval manager
   */
  static async countPendingApproval(gasStationId: string) {
    return await prisma.transaction.count({
      where: {
        gasStationId,
        approvalStatus: "PENDING",
        transactionType: {
          in: ["PURCHASE_BBM", "CASH"],
        },
      },
    });
  }

  /**
   * Count pending CASH transactions for Finance
   * Hanya menghitung CASH yang perlu approval
   */
  static async countPendingCashTransactions(gasStationId: string) {
    return await prisma.transaction.count({
      where: {
        gasStationId,
        approvalStatus: "PENDING",
        transactionType: "CASH",
      },
    });
  }

  /**
   * Get transaction history (APPROVED/REJECTED)
   */
  static async getTransactionHistory(
    gasStationId: string,
    approverId?: string,
    approverRole?: "MANAGER"
  ) {
    const where: any = {
      gasStationId,
      approvalStatus: {
        in: ["APPROVED", "REJECTED"],
      },
    };

    // Filter berdasarkan role approver (untuk manager tab)
    if (approverRole === "MANAGER") {
      // Hanya transaksi yang perlu approval manager (PURCHASE_BBM dan CASH)
      where.transactionType = {
        in: ["PURCHASE_BBM", "CASH"],
      };
    } else if (approverId) {
      // Filter berdasarkan userId (untuk use case lain)
      where.approverId = approverId;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
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
      orderBy: [{ updatedAt: "desc" }],
    });

    return transactions;
  }
}
