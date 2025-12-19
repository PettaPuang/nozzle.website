"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  findOrCreateInventoryCOA,
  findOrCreatePriceAdjustmentIncomeCOA,
  findOrCreatePriceAdjustmentExpenseCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";

/**
 * PRODUCT PRICE CHANGE - Stock Adjustment Transaction
 * Saat harga beli produk berubah:
 * - Jika harga naik: Debit Persediaan (produk), Credit Pendapatan Penyesuaian Harga (REVENUE)
 * - Jika harga turun: Debit Beban Penyesuaian Harga (EXPENSE), Credit Persediaan (produk)
 * Nilai = (harga baru - harga lama) × volume tersedia
 *
 * Sesuai PSAK 14 dan IAS 2: penyesuaian nilai persediaan diakui sebagai pendapatan/beban di laporan laba rugi
 */
export async function createStockAdjustmentTransaction(params: {
  productId: string;
  productName: string;
  gasStationId: string;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  availableVolume: number; // Volume tersedia di semua tank untuk produk ini di gas station ini
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    oldPurchasePrice,
    newPurchasePrice,
    availableVolume,
    createdById,
    tx,
  } = params;

  // Jika harga tidak berubah, tidak perlu adjustment
  if (oldPurchasePrice === newPurchasePrice || availableVolume === 0) {
    return null;
  }

  const priceDifference = newPurchasePrice - oldPurchasePrice;
  const adjustmentValue = priceDifference * availableVolume;

  // Jika adjustmentValue = 0, tidak perlu transaction
  if (adjustmentValue === 0) {
    return null;
  }

  const prismaClient = tx || prisma;

  // Get COAs
  const inventoryCOA = await findOrCreateInventoryCOA(
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
    // Harga naik: Debit Persediaan, Credit Pendapatan Penyesuaian Harga (REVENUE)
    const incomeCOA = await findOrCreatePriceAdjustmentIncomeCOA(
      gasStationId,
      createdById,
      tx
    );

    journalEntries.push({
      coaId: inventoryCOA.id,
      debit: Math.abs(adjustmentValue),
      credit: 0,
      description: `Penyesuaian stock ${productName} karena kenaikan harga beli dari Rp ${oldPurchasePrice.toLocaleString(
        "id-ID"
      )} menjadi Rp ${newPurchasePrice.toLocaleString(
        "id-ID"
      )} (${availableVolume.toLocaleString("id-ID")} L)`,
    });
    journalEntries.push({
      coaId: incomeCOA.id,
      debit: 0,
      credit: Math.abs(adjustmentValue),
      description: `Pendapatan penyesuaian stock ${productName} - kenaikan harga`,
    });
  } else {
    // Harga turun: Debit Beban Penyesuaian Harga (EXPENSE), Credit Persediaan
    const expenseCOA = await findOrCreatePriceAdjustmentExpenseCOA(
      gasStationId,
      createdById,
      tx
    );

    journalEntries.push({
      coaId: expenseCOA.id,
      debit: Math.abs(adjustmentValue),
      credit: 0,
      description: `Beban penyesuaian stock ${productName} - penurunan harga`,
    });
    journalEntries.push({
      coaId: inventoryCOA.id,
      debit: 0,
      credit: Math.abs(adjustmentValue),
      description: `Penyesuaian stock ${productName} karena penurunan harga beli dari Rp ${oldPurchasePrice.toLocaleString(
        "id-ID"
      )} menjadi Rp ${newPurchasePrice.toLocaleString(
        "id-ID"
      )} (${availableVolume.toLocaleString("id-ID")} L)`,
    });
  }

  const priceChangeType = priceDifference > 0 ? "Kenaikan" : "Penurunan";
  const incomeExpenseType = priceDifference > 0 ? "Pendapatan" : "Beban";

  const transaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Pengakuan ${incomeExpenseType} akibat Penyesuaian Stock ${productName} - ${priceChangeType} Harga Beli`,
    notes: `Otomatis dibuat saat harga beli ${productName} berubah dari Rp ${oldPurchasePrice.toLocaleString(
      "id-ID"
    )} menjadi Rp ${newPurchasePrice.toLocaleString(
      "id-ID"
    )}. Stock tersedia: ${availableVolume.toLocaleString("id-ID")} L. ${
      priceChangeType === "Kenaikan" ? "Pendapatan" : "Beban"
    } penyesuaian: Rp ${Math.abs(adjustmentValue).toLocaleString("id-ID")}`,
    journalEntries,
    createdById,
    transactionType: "ADJUSTMENT",
    approvalStatus: "APPROVED",
    approverId: null, // Auto-approved, tidak perlu approverId
    tx,
  });

  return transaction;
}
