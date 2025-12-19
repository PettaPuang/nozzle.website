"use server";

import { prisma } from "@/lib/prisma";

export class AdminTransactionService {
  /**
   * Get admin transactions untuk gas station tertentu
   * Filter berdasarkan transactionType (CASH, ADJUSTMENT)
   */
  static async getAdminTransactionsByGasStation(
    gasStationId: string,
    filters?: {
      transactionType?: "CASH" | "ADJUSTMENT";
      startDate?: Date;
      endDate?: Date;
      approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
    }
  ) {
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        ...(filters?.transactionType && {
          transactionType: filters.transactionType,
        }),
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

