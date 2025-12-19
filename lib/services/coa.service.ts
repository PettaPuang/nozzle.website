import { prisma } from "@/lib/prisma";

export type COAForClient = {
  id: string;
  code: string | null;
  name: string;
  category: string;
  status: string;
  description: string | null;
};

export type COAWithBalanceForClient = {
  id: string;
  code: string | null;
  name: string;
  category: string;
  status: string;
  description: string | null;
  balance: number;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
};

export class COAService {
  static async getCOAs(gasStationId: string): Promise<COAForClient[]> {
    const coas = await prisma.cOA.findMany({
      where: {
        gasStationId,
        status: "ACTIVE",
      },
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        status: true,
        description: true,
      },
    });

    return coas;
  }

  static async getCOAsWithBalance(gasStationId: string): Promise<COAWithBalanceForClient[]> {
    const coas = await prisma.cOA.findMany({
      where: {
        gasStationId,
        status: "ACTIVE",
      },
      include: {
        journalEntries: {
          include: {
            transaction: {
              select: {
                approvalStatus: true,
              },
            },
          },
        },
      },
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
    });

    // Hitung balance "Realtime Profit/Loss" dari semua REVENUE, EXPENSE, dan COGS
    // Balance = Total REVENUE - Total EXPENSE - Total COGS - Transfer ke Laba Ditahan
    let realtimeProfitLossBalance = 0;
    const realtimeProfitLossCOA = coas.find(
      (coa) => coa.name.toLowerCase() === "realtime profit/loss"
    );

    if (realtimeProfitLossCOA) {
      // Hitung total REVENUE (credit normal)
      const revenueCOAs = coas.filter((coa) => coa.category === "REVENUE");
      const totalRevenue = revenueCOAs.reduce((sum, coa) => {
        const revenueDebit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.debit), 0);
        const revenueCredit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.credit), 0);
        // REVENUE adalah credit normal, balance = credit - debit
        return sum + (revenueCredit - revenueDebit);
      }, 0);

      // Hitung total EXPENSE (debit normal)
      const expenseCOAs = coas.filter((coa) => coa.category === "EXPENSE");
      const totalExpense = expenseCOAs.reduce((sum, coa) => {
        const expenseDebit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.debit), 0);
        const expenseCredit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.credit), 0);
        // EXPENSE adalah debit normal, balance = debit - credit
        return sum + (expenseDebit - expenseCredit);
      }, 0);

      // Hitung total COGS (debit normal)
      const cogsCOAs = coas.filter((coa) => coa.category === "COGS");
      const totalCOGS = cogsCOAs.reduce((sum, coa) => {
        const cogsDebit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.debit), 0);
        const cogsCredit = coa.journalEntries
          .filter((je) => je.transaction.approvalStatus === "APPROVED")
          .reduce((s, je) => s + Number(je.credit), 0);
        // COGS adalah debit normal, balance = debit - credit
        return sum + (cogsDebit - cogsCredit);
      }, 0);

      // Net Income = Revenue - Expense - COGS
      const netIncome = totalRevenue - totalExpense - totalCOGS;

      // Hitung transfer yang sudah dilakukan (journal entries di Realtime Profit/Loss itu sendiri)
      // Debit = transfer keluar (profit yang ditransfer ke Laba Ditahan)
      // Credit = transfer masuk (loss yang diserap dari Laba Ditahan)
      const transferDebit = realtimeProfitLossCOA.journalEntries
        .filter((je) => je.transaction.approvalStatus === "APPROVED")
        .reduce((s, je) => s + Number(je.debit), 0);
      const transferCredit = realtimeProfitLossCOA.journalEntries
        .filter((je) => je.transaction.approvalStatus === "APPROVED")
        .reduce((s, je) => s + Number(je.credit), 0);

      // Balance untuk EQUITY "Realtime Profit/Loss" = Net Income - Transfer
      // Transfer net = Credit - Debit (karena EQUITY credit normal)
      // Jika ada closing (debit Realtime P/L), maka balance berkurang
      const transferNet = transferCredit - transferDebit;
      realtimeProfitLossBalance = netIncome + transferNet;
    }

    // Calculate balance for each COA
    const coasWithBalance = coas.map((coa) => {
      // Journal entries (only APPROVED transactions)
      const totalDebit = coa.journalEntries
        .filter((je) => je.transaction.approvalStatus === "APPROVED")
        .reduce((sum, je) => sum + Number(je.debit), 0);

      const totalCredit = coa.journalEntries
        .filter((je) => je.transaction.approvalStatus === "APPROVED")
        .reduce((sum, je) => sum + Number(je.credit), 0);

      // Calculate balance based on category
      let balance = 0;
      
      // Untuk "Realtime Profit/Loss", gunakan perhitungan khusus
      if (coa.name.toLowerCase() === "realtime profit/loss") {
        balance = realtimeProfitLossBalance;
      } else if (
        coa.category === "ASSET" ||
        coa.category === "EXPENSE" ||
        coa.category === "COGS"
      ) {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }

      return {
        id: coa.id,
        code: coa.code,
        name: coa.name,
        category: coa.category,
        status: coa.status,
        description: coa.description,
        balance,
        openingBalance: 0,
        totalDebit,
        totalCredit,
      };
    });

    return coasWithBalance;
  }

  /**
   * Get journal entries for a specific COA
   */
  static async getCOAJournalEntries(coaId: string) {
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        coaId,
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            referenceNumber: true,
            notes: true,
            approvalStatus: true,
            createdAt: true,
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
                coa: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                  },
                },
              },
            },
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

    return journalEntries;
  }
}

