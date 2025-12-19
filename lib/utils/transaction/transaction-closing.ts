"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC, endOfMonthUTC, startOfMonthUTC } from "@/lib/utils/datetime";

/**
 * Create closing entry transaction to transfer Realtime Profit/Loss to Retained Earnings
 * Ini akan mengosongkan Realtime Profit/Loss dan memindahkan nilainya ke Laba Ditahan
 */
export async function createMonthlyClosingTransaction(
  gasStationId: string,
  closingDate: Date,
  createdById: string
) {
  // 1. Get Realtime Profit/Loss COA
  const realtimeProfitLossCOA = await prisma.cOA.findFirst({
    where: {
      gasStationId,
      name: "Realtime Profit/Loss",
      category: "EQUITY",
      status: "ACTIVE",
    },
  });

  if (!realtimeProfitLossCOA) {
    throw new Error("COA Realtime Profit/Loss tidak ditemukan");
  }

  // 2. Get or create Laba Ditahan COA
  let labaDitahanCOA = await prisma.cOA.findFirst({
    where: {
      gasStationId,
      name: "Laba Ditahan",
      category: "EQUITY",
    },
  });

  if (!labaDitahanCOA) {
    labaDitahanCOA = await prisma.cOA.create({
      data: {
        gasStationId,
        name: "Laba Ditahan",
        category: "EQUITY",
        status: "ACTIVE",
        description: "Akumulasi laba/rugi yang ditahan untuk modal",
      },
    });
  }

  // 3. Calculate Realtime Profit/Loss balance
  const profitLossBalance = await prisma.journalEntry.aggregate({
    where: {
      coaId: realtimeProfitLossCOA.id,
      transaction: {
        gasStationId,
        approvalStatus: "APPROVED",
      },
    },
    _sum: {
      credit: true,
      debit: true,
    },
  });

  const credit = profitLossBalance._sum.credit || 0;
  const debit = profitLossBalance._sum.debit || 0;

  // Realtime Profit/Loss = Credit - Debit (EQUITY normal balance is credit)
  // Jika positif = profit, jika negatif = loss
  const balance = credit - debit;

  if (balance === 0) {
    throw new Error("Saldo Realtime Profit/Loss sudah 0, tidak perlu closing");
  }

  // 4. Determine periode closing (bulan sebelumnya)
  const previousMonthEnd = new Date(closingDate);
  previousMonthEnd.setDate(0); // Set to last day of previous month
  const monthName = previousMonthEnd.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // 5. Create closing transaction
  // Jika profit (balance > 0):
  //   - Debit: Realtime Profit/Loss (mengurangi credit balance ke 0)
  //   - Credit: Laba Ditahan (menambah equity)
  // Jika loss (balance < 0):
  //   - Debit: Laba Ditahan (mengurangi equity)
  //   - Credit: Realtime Profit/Loss (menambah credit untuk offset debit balance)

  const isProfit = balance > 0;
  const absoluteBalance = Math.abs(balance);

  const transaction = await prisma.transaction.create({
    data: {
      gasStationId,
      transactionType: "ADJUSTMENT",
      description: `Penutupan Buku ${monthName}`,
      notes: `Transfer otomatis ${
        isProfit ? "laba" : "rugi"
      } ${monthName} dari Realtime Profit/Loss ke Laba Ditahan`,
      date: closingDate,
      approvalStatus: "APPROVED",
      createdById,
      approverId: createdById, // Auto-approved
      journalEntries: {
        create: [
          {
            coaId: isProfit ? realtimeProfitLossCOA.id : labaDitahanCOA.id,
            debit: absoluteBalance,
            credit: 0,
            description: isProfit
              ? `Penutupan laba ${monthName}`
              : `Pengurangan laba ditahan karena rugi ${monthName}`,
          },
          {
            coaId: isProfit ? labaDitahanCOA.id : realtimeProfitLossCOA.id,
            debit: 0,
            credit: absoluteBalance,
            description: isProfit
              ? `Penambahan laba ditahan dari laba ${monthName}`
              : `Penutupan rugi ${monthName}`,
          },
        ],
      },
    },
    include: {
      journalEntries: {
        include: {
          coa: true,
        },
      },
    },
  });

  return {
    transaction,
    balance,
    isProfit,
    monthName,
  };
}

/**
 * Check if closing has been done for a specific month
 */
export async function hasMonthlyClosingBeenDone(
  gasStationId: string,
  year: number,
  month: number // 0-11 (January = 0)
): Promise<boolean> {
  const startDate = startOfMonthUTC(new Date(year, month, 1));
  const endDate = endOfMonthUTC(new Date(year, month, 1));

  const closingTransaction = await prisma.transaction.findFirst({
    where: {
      gasStationId,
      transactionType: "ADJUSTMENT",
      description: {
        startsWith: "Penutupan Buku",
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
      approvalStatus: "APPROVED",
    },
  });

  return !!closingTransaction;
}

/**
 * Get list of gas stations that need monthly closing
 */
export async function getGasStationsNeedingClosing(
  targetMonth: Date
): Promise<string[]> {
  // Get all active gas stations
  const gasStations = await prisma.gasStation.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();

  // Filter gas stations yang belum closing
  const needsClosing: string[] = [];

  for (const gs of gasStations) {
    const hasClosed = await hasMonthlyClosingBeenDone(gs.id, year, month);
    if (!hasClosed) {
      needsClosing.push(gs.id);
    }
  }

  return needsClosing;
}

/**
 * Auto-close all gas stations for previous month
 * This should be called via cron job at the start of each month
 */
export async function autoCloseAllGasStations() {
  const now = nowUTC();

  // Get previous month
  const previousMonth = new Date(now);
  previousMonth.setMonth(now.getMonth() - 1);

  const year = previousMonth.getFullYear();
  const month = previousMonth.getMonth();

  // Closing date = first day of current month
  const closingDate = startOfMonthUTC(now);

  // Get gas stations that need closing
  const gasStationIds = await getGasStationsNeedingClosing(previousMonth);

  const results = [];

  for (const gasStationId of gasStationIds) {
    try {
      // Get gas station to find owner
      const gasStation = await prisma.gasStation.findUnique({
        where: { id: gasStationId },
        select: { ownerId: true },
      });

      if (!gasStation || !gasStation.ownerId) {
        console.error(`Gas station ${gasStationId} not found or has no owner`);
        results.push({
          gasStationId,
          success: false,
          error: "Gas station not found or has no owner",
        });
        continue;
      }

      // Get administrator user for this owner, or use owner if no admin found
      let systemUser = await prisma.user.findFirst({
        where: {
          role: "ADMINISTRATOR",
          ownerId: gasStation.ownerId,
        },
      });

      // Fallback to owner if no administrator found
      if (!systemUser) {
        systemUser = await prisma.user.findUnique({
          where: { id: gasStation.ownerId },
        });
      }

      if (!systemUser) {
        console.error(
          `No admin or owner user found for gas station ${gasStationId}`
        );
        results.push({
          gasStationId,
          success: false,
          error: "No admin or owner user found",
        });
        continue;
      }

      const result = await createMonthlyClosingTransaction(
        gasStationId,
        closingDate,
        systemUser.id
      );

      results.push({
        gasStationId,
        success: true,
        balance: result.balance,
        isProfit: result.isProfit,
        monthName: result.monthName,
      });
    } catch (error: any) {
      console.error(
        `Error closing gas station ${gasStationId}:`,
        error.message
      );
      results.push({
        gasStationId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}
