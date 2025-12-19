"use server";

import { prisma } from "@/lib/prisma";

/**
 * Get remaining titipan volume from COA balance
 * Balance = Credit - Debit (untuk LIABILITY)
 * 
 * @param gasStationId - ID gas station
 * @param titipanCOAId - ID COA Titipan
 * @param oldSellingPrice - Harga jual lama untuk menghitung volume
 * @returns Remaining volume, current balance, and COA name
 */
export async function getRemainingTitipanFromCOA(
  gasStationId: string,
  titipanCOAId: string,
  oldSellingPrice: number
): Promise<{ 
  remainingVolume: number; 
  currentBalance: number;
  coaName: string;
}> {
  
  // Get COA info
  const coa = await prisma.cOA.findUnique({
    where: { id: titipanCOAId },
    select: { name: true },
  });

  if (!coa) {
    return { remainingVolume: 0, currentBalance: 0, coaName: '' };
  }

  // Get COA balance (sum of all journal entries)
  const result = await prisma.journalEntry.aggregate({
    where: {
      coaId: titipanCOAId,
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

  const credit = result._sum.credit || 0;
  const debit = result._sum.debit || 0;
  
  // Balance = Credit - Debit (untuk LIABILITY, credit = increase)
  const currentBalance = credit - debit;
  
  // Calculate remaining volume based on old selling price
  const remainingVolume = oldSellingPrice > 0 
    ? currentBalance / oldSellingPrice 
    : 0;

  return {
    remainingVolume: Math.max(0, remainingVolume), // Tidak boleh negatif
    currentBalance: Math.max(0, currentBalance),
    coaName: coa.name,
  };
}

