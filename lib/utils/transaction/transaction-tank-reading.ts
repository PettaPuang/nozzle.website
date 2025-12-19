"use server";

import {
  findOrCreateInventoryCOA,
  findOrCreateShrinkageCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";
import { getLocalDateFromUTC } from "@/lib/utils/datetime";

/**
 * TANK READING - Loss Transaction
 * ENABLED: Variance dijurnal sebagai Susut per produk (COGS)
 *
 * Saat tank reading menunjukkan loss (variance negatif):
 * - Stock berkurang karena susut/shrinkage
 * - Debit Susut [Product] (COGS), Credit Persediaan [Product] (ASSET)
 * - Susut masuk HPP, bukan operating expense
 */
export async function createTankReadingLossTransaction(params: {
  tankReadingId: string;
  gasStationId: string;
  productName: string;
  lossAmount: number; // dalam liter
  purchasePrice: number;
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    lossAmount,
    purchasePrice,
    createdById,
    tx,
  } = params;

  const totalValue = lossAmount * purchasePrice;

  // Get COAs
  const shrinkageCOA = await findOrCreateShrinkageCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );
  const inventoryCOA = await findOrCreateInventoryCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );

  // Create transaction
  // Jurnal: Debit Susut [Product] (COGS), Credit Persediaan [Product] (ASSET)
  const transaction = await createOperationalTransaction({
    gasStationId,
    date: getLocalDateFromUTC(),
    description: `Susut ${productName} dari tank reading - ${lossAmount.toLocaleString(
      "id-ID"
    )} L`,
    notes: `Otomatis dibuat saat tank reading menunjukkan loss ${lossAmount.toLocaleString(
      "id-ID"
    )} L. Susut: Rp ${totalValue.toLocaleString(
      "id-ID"
    )} (${lossAmount.toLocaleString(
      "id-ID"
    )} L x Rp ${purchasePrice.toLocaleString("id-ID")})`,
    journalEntries: [
      {
        coaId: shrinkageCOA.id,
        debit: totalValue,
        credit: 0,
        description: `Susut ${productName} ${lossAmount.toLocaleString(
          "id-ID"
        )} L`,
      },
      {
        coaId: inventoryCOA.id,
        debit: 0,
        credit: totalValue,
        description: `Pengurangan persediaan karena susut ${productName}`,
      },
    ],
    createdById,
    transactionType: "TANK_READING",
    approvalStatus: "APPROVED",
    approverId: null, // Auto-approved, tidak perlu approverId
    tx,
  });

  return transaction;
}

/**
 * TANK READING - Profit Transaction
 * ENABLED: Variance dijurnal sebagai Susut per produk (COGS)
 *
 * Saat tank reading menunjukkan profit (variance positif):
 * - Stock bertambah (unexpected gain)
 * - Debit Persediaan [Product] (ASSET), Credit Susut [Product] (COGS)
 * - Mengurangi Susut/HPP
 */
export async function createTankReadingProfitTransaction(params: {
  tankReadingId: string;
  gasStationId: string;
  productName: string;
  profitAmount: number; // dalam liter
  purchasePrice: number;
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    profitAmount,
    purchasePrice,
    createdById,
    tx,
  } = params;

  const totalValue = profitAmount * purchasePrice;

  // Get COAs
  const inventoryCOA = await findOrCreateInventoryCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );
  const shrinkageCOA = await findOrCreateShrinkageCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );

  // Create transaction
  // Jurnal: Debit Persediaan [Product], Credit Susut [Product] (mengurangi susut)
  const transaction = await createOperationalTransaction({
    gasStationId,
    date: getLocalDateFromUTC(),
    description: `Keuntungan ${productName} dari tank reading - ${profitAmount.toLocaleString(
      "id-ID"
    )} L`,
    notes: `Otomatis dibuat saat tank reading menunjukkan profit ${profitAmount.toLocaleString(
      "id-ID"
    )} L. Koreksi susut: Rp ${totalValue.toLocaleString(
      "id-ID"
    )} (${profitAmount.toLocaleString(
      "id-ID"
    )} L x Rp ${purchasePrice.toLocaleString("id-ID")})`,
    journalEntries: [
      {
        coaId: inventoryCOA.id,
        debit: totalValue,
        credit: 0,
        description: `Keuntungan ${productName} ${profitAmount.toLocaleString(
          "id-ID"
        )} L`,
      },
      {
        coaId: shrinkageCOA.id,
        debit: 0,
        credit: totalValue,
        description: `Koreksi susut ${productName} (mengurangi HPP)`,
      },
    ],
    createdById,
    transactionType: "TANK_READING",
    approvalStatus: "APPROVED",
    approverId: null, // Auto-approved, tidak perlu approverId
    tx,
  });

  return transaction;
}
