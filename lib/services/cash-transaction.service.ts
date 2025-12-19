"use server";

import { prisma } from "@/lib/prisma";

export class CashTransactionService {
  /**
   * Get cash transactions untuk gas station tertentu
   */
  static async getCashTransactionsByGasStation(
    gasStationId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
    }
  ) {
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "CASH",
        ...(filters?.startDate && {
          date: { gte: filters.startDate },
        }),
        ...(filters?.endDate && {
          date: { lte: filters.endDate },
        }),
        ...(filters?.approvalStatus && {
          approvalStatus: filters.approvalStatus,
        }),
      },
      include: {
        journalEntries: {
          include: {
            coa: true,
          },
        },
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
      },
      orderBy: {
        date: "desc",
      },
    });

    return transactions;
  }
}

