"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  findOrCreateLOProductCOA,
  findOrCreatePriceAdjustmentIncomeCOA,
  findOrCreatePriceAdjustmentExpenseCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";

/**
 * PRODUCT PRICE CHANGE - LO Adjustment Transaction
 * Saat harga beli produk berubah:
 * - Jika harga naik: Debit LO Produk, Credit Pendapatan Penyesuaian Harga (REVENUE)
 * - Jika harga turun: Debit Beban Penyesuaian Harga (EXPENSE), Credit LO Produk
 * Nilai = (harga baru - harga lama) × remainingVolume (LO sisa)
 * 
 * Sesuai PSAK 14 dan IAS 2: penyesuaian nilai persediaan diakui sebagai pendapatan/beban di laporan laba rugi
 */
export async function createLOAdjustmentTransaction(params: {
  productId: string;
  productName: string;
  gasStationId: string;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  remainingLOVolume: number; // Total remainingVolume dari semua purchase transactions
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    oldPurchasePrice,
    newPurchasePrice,
    remainingLOVolume,
    createdById,
    tx,
  } = params;

  // Jika harga tidak berubah, tidak perlu adjustment
  if (oldPurchasePrice === newPurchasePrice || remainingLOVolume === 0) {
    return null;
  }

  const priceDifference = newPurchasePrice - oldPurchasePrice;
  const adjustmentValue = priceDifference * remainingLOVolume;

  // Jika adjustmentValue = 0, tidak perlu transaction
  if (adjustmentValue === 0) {
    return null;
  }

  const prismaClient = tx || prisma;

  // Get COAs
  const loProductCOA = await findOrCreateLOProductCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );

  const journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  if (priceDifference > 0) {
    // Harga naik: Debit LO Produk, Credit Pendapatan Penyesuaian Harga (REVENUE)
    const incomeCOA = await findOrCreatePriceAdjustmentIncomeCOA(
      gasStationId,
      createdById,
      tx
    );
    
    journalEntries.push({
      coaId: loProductCOA.id,
      debit: Math.abs(adjustmentValue),
      credit: 0,
      description: `Penyesuaian LO ${productName} karena kenaikan harga beli dari Rp ${oldPurchasePrice.toLocaleString(
        "id-ID"
      )} menjadi Rp ${newPurchasePrice.toLocaleString(
        "id-ID"
      )} (${remainingLOVolume.toLocaleString("id-ID")} L)`,
    });
    journalEntries.push({
      coaId: incomeCOA.id,
      debit: 0,
      credit: Math.abs(adjustmentValue),
      description: `Pendapatan penyesuaian LO ${productName} - kenaikan harga`,
    });
  } else {
    // Harga turun: Debit Beban Penyesuaian Harga (EXPENSE), Credit LO Produk
    const expenseCOA = await findOrCreatePriceAdjustmentExpenseCOA(
      gasStationId,
      createdById,
      tx
    );
    
    journalEntries.push({
      coaId: expenseCOA.id,
      debit: Math.abs(adjustmentValue),
      credit: 0,
      description: `Beban penyesuaian LO ${productName} - penurunan harga`,
    });
    journalEntries.push({
      coaId: loProductCOA.id,
      debit: 0,
      credit: Math.abs(adjustmentValue),
      description: `Penyesuaian LO ${productName} karena penurunan harga beli dari Rp ${oldPurchasePrice.toLocaleString(
        "id-ID"
      )} menjadi Rp ${newPurchasePrice.toLocaleString(
        "id-ID"
      )} (${remainingLOVolume.toLocaleString("id-ID")} L)`,
    });
  }

  const priceChangeType = priceDifference > 0 ? "Kenaikan" : "Penurunan";
  const incomeExpenseType = priceDifference > 0 ? "Pendapatan" : "Beban";
  
  const transaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Pengakuan ${incomeExpenseType} akibat Penyesuaian LO ${productName} - ${priceChangeType} Harga Beli`,
    notes: `Otomatis dibuat saat harga beli ${productName} berubah dari Rp ${oldPurchasePrice.toLocaleString(
      "id-ID"
    )} menjadi Rp ${newPurchasePrice.toLocaleString(
      "id-ID"
    )}. LO sisa: ${remainingLOVolume.toLocaleString(
      "id-ID"
    )} L. ${priceChangeType === "Kenaikan" ? "Pendapatan" : "Beban"} penyesuaian: Rp ${Math.abs(adjustmentValue).toLocaleString(
      "id-ID"
    )}`,
    journalEntries,
    createdById,
    transactionType: "ADJUSTMENT",
    approvalStatus: "APPROVED",
    approverId: null, // Auto-approved, tidak perlu approverId
    tx,
  });

  return transaction;
}

