"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  findOrCreatePriceAdjustmentIncomeCOA,
  findOrCreatePriceAdjustmentExpenseCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";
import { getRemainingTitipanFromCOA } from "@/lib/services/titipan.service";

/**
 * PRODUCT SELLING PRICE CHANGE - Titipan Adjustment Transaction
 * Saat harga jual produk berubah dan ada sisa titipan:
 * - Jika harga naik: Debit Beban Penyesuaian Harga (EXPENSE), Credit Titipan (increase liability)
 * - Jika harga turun: Debit Titipan (reduce liability), Credit Pendapatan Penyesuaian Harga (REVENUE)
 * 
 * Nilai = (harga jual baru - harga jual lama) × sisa volume titipan
 * Sisa volume titipan = current COA balance / harga jual lama
 */
export async function createTitipanAdjustmentTransaction(params: {
  productId: string;
  productName: string;
  gasStationId: string;
  oldSellingPrice: number;
  newSellingPrice: number;
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    oldSellingPrice,
    newSellingPrice,
    createdById,
    tx,
  } = params;

  // Jika harga tidak berubah atau harga lama = 0
  if (oldSellingPrice === newSellingPrice || oldSellingPrice === 0) {
    return null;
  }

  const prismaClient = tx || prisma;

  // Get all active Titipan COAs for this gas station
  const allTitipanCOAs = await prismaClient.cOA.findMany({
    where: {
      gasStationId,
      category: "LIABILITY",
      name: { contains: "Titipan" },
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (allTitipanCOAs.length === 0) {
    console.log(`No active Titipan COAs found for gas station ${gasStationId}`);
    return null;
  }

  // Filter: Hanya COA yang pernah ada unload titipan untuk product ini
  // Cek journal entries yang berasal dari transaction UNLOAD dengan notes "isi titipan dari"
  const titipanCOAIds = allTitipanCOAs.map(coa => coa.id);
  
  const unloadTitipanTransactions = await prismaClient.transaction.findMany({
    where: {
      gasStationId,
      transactionType: "UNLOAD",
      approvalStatus: "APPROVED",
      notes: { contains: "isi titipan dari" },
      journalEntries: {
        some: {
          coaId: { in: titipanCOAIds },
          credit: { gt: 0 },
        },
      },
    },
    select: {
      journalEntries: {
        where: {
          coaId: { in: titipanCOAIds },
          credit: { gt: 0 },
        },
        select: {
          coaId: true,
        },
      },
    },
  });

  // Extract COA IDs yang pernah ada unload titipan
  const coaIdsWithUnloadHistory = new Set<string>();
  for (const tx of unloadTitipanTransactions) {
    for (const entry of tx.journalEntries) {
      coaIdsWithUnloadHistory.add(entry.coaId);
    }
  }

  // Filter hanya COA yang ada unload history
  const titipanCOAs = allTitipanCOAs.filter(coa => 
    coaIdsWithUnloadHistory.has(coa.id)
  );

  if (titipanCOAs.length === 0) {
    console.log(`No Titipan COAs with unload history found for gas station ${gasStationId}`);
    return null;
  }

  const journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  let totalAdjustmentValue = 0;
  const titipanDetails: string[] = [];

  // Process each Titipan COA
  for (const coa of titipanCOAs) {
    // Get remaining titipan from COA balance
    const { remainingVolume, currentBalance, coaName } = 
      await getRemainingTitipanFromCOA(
        gasStationId,
        coa.id,
        oldSellingPrice
      );

    if (remainingVolume <= 0 || currentBalance <= 0) {
      console.log(`No balance for ${coa.name}, skipping...`);
      continue;
    }

    // Calculate adjustment for this COA
    const priceDifference = newSellingPrice - oldSellingPrice;
    const adjustmentValue = remainingVolume * priceDifference;

    if (Math.abs(adjustmentValue) < 1) continue; // Skip jika adjustment < Rp 1

    totalAdjustmentValue += adjustmentValue;
    
    titipanDetails.push(
      `${coaName}: ${remainingVolume.toFixed(2)}L @ Rp ${Math.abs(priceDifference).toLocaleString("id-ID")} = Rp ${Math.abs(adjustmentValue).toLocaleString("id-ID")}`
    );

    if (priceDifference > 0) {
      // HARGA NAIK: Utang bertambah → EXPENSE untuk SPBU
      // Debit: Beban Penyesuaian Harga (EXPENSE)
      // Credit: Titipan XXX (LIABILITY - increase)
      
      journalEntries.push({
        coaId: coa.id,
        debit: 0,
        credit: Math.abs(adjustmentValue),
        description: `Penyesuaian ${coaName} karena kenaikan harga jual ${productName} dari Rp ${oldSellingPrice.toLocaleString("id-ID")} ke Rp ${newSellingPrice.toLocaleString("id-ID")} (${remainingVolume.toFixed(2)}L)`,
      });
    } else {
      // HARGA TURUN: Utang berkurang → INCOME untuk SPBU
      // Debit: Titipan XXX (LIABILITY - decrease)
      // Credit: Pendapatan Penyesuaian Harga (REVENUE)
      
      journalEntries.push({
        coaId: coa.id,
        debit: Math.abs(adjustmentValue),
        credit: 0,
        description: `Penyesuaian ${coaName} karena penurunan harga jual ${productName} dari Rp ${oldSellingPrice.toLocaleString("id-ID")} ke Rp ${newSellingPrice.toLocaleString("id-ID")} (${remainingVolume.toFixed(2)}L)`,
      });
    }
  }

  // If no adjustments needed
  if (journalEntries.length === 0 || Math.abs(totalAdjustmentValue) < 1) {
    console.log(`No titipan adjustment needed for ${productName}`);
    return null;
  }

  const priceDifference = newSellingPrice - oldSellingPrice;

  // Add balancing entry (Income or Expense COA)
  if (priceDifference > 0) {
    // HARGA NAIK: Add EXPENSE entry (debit side)
    const expenseCOA = await findOrCreatePriceAdjustmentExpenseCOA(
      gasStationId,
      createdById,
      tx
    );
    
    journalEntries.push({
      coaId: expenseCOA.id,
      debit: Math.abs(totalAdjustmentValue),
      credit: 0,
      description: `Beban penyesuaian harga jual ${productName} - kenaikan harga dari Rp ${oldSellingPrice.toLocaleString("id-ID")} ke Rp ${newSellingPrice.toLocaleString("id-ID")}`,
    });
  } else {
    // HARGA TURUN: Add INCOME entry (credit side)
    const incomeCOA = await findOrCreatePriceAdjustmentIncomeCOA(
      gasStationId,
      createdById,
      tx
    );
    
    journalEntries.push({
      coaId: incomeCOA.id,
      debit: 0,
      credit: Math.abs(totalAdjustmentValue),
      description: `Pendapatan penyesuaian harga jual ${productName} - penurunan harga dari Rp ${oldSellingPrice.toLocaleString("id-ID")} ke Rp ${newSellingPrice.toLocaleString("id-ID")}`,
    });
  }

  // Create transaction
  const priceChangeType = priceDifference > 0 ? "Kenaikan" : "Penurunan";
  
  const transaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Penyesuaian Nilai Titipan ${productName} - ${priceChangeType} Harga Jual`,
    referenceNumber: null,
    notes: `${priceChangeType} harga jual dari Rp ${oldSellingPrice.toLocaleString("id-ID")} ke Rp ${newSellingPrice.toLocaleString("id-ID")}. Detail penyesuaian: ${titipanDetails.join("; ")}`,
    journalEntries,
    createdById,
    transactionType: "ADJUSTMENT",
    approvalStatus: "APPROVED",
    tx,
  });

  console.log(`✅ Titipan adjustment created for ${productName}: Rp ${totalAdjustmentValue.toLocaleString("id-ID")}`);
  
  return transaction;
}

