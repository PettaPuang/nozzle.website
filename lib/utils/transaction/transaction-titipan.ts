"use server";

import { prisma } from "@/lib/prisma";
import { getLocalDateFromUTC } from "@/lib/utils/datetime";
import { findOrCreateInventoryCOA } from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";

/**
 * ISI TITIPAN - Create Transaction
 * Saat unload dari titipan dibuat dan di-approve:
 * - Stock bertambah dari titipan
 * - Jurnal Entry (dengan adjustment markup):
 *   Debit:  Persediaan [Product]        liter × purchasePrice (harga modal)
 *   Debit:  Penyesuaian Titipan [Nama]  liter × (sellingPrice - purchasePrice) (markup)
 *   Credit: Titipan [Nama]              liter × sellingPrice (harga jual)
 * 
 * Menggunakan transactionType UNLOAD (sama dengan unload biasa)
 * Tapi journal entry berbeda:
 * - Unload biasa: Debit Persediaan (purchase), Credit LO
 * - Isi Titipan: Debit Persediaan (purchase) + Penyesuaian Titipan (markup), Credit Titipan (selling)
 */
export async function createTitipanFillTransaction(params: {
  tankId: string;
  gasStationId: string;
  titipanName: string; // Nama titipan (e.g., "Polres", "Pemkot")
  productName: string;
  literAmount: number; // Volume yang diisi dalam liter
  purchasePrice: number;
  sellingPrice: number; // Tambahkan selling price untuk hitung markup
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    titipanName,
    productName,
    literAmount,
    purchasePrice,
    sellingPrice,
    createdById,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Calculate values
  const inventoryValue = literAmount * purchasePrice; // Nilai persediaan (harga modal)
  const titipanValue = literAmount * sellingPrice; // Nilai utang titipan (harga jual)
  const adjustmentValue = titipanValue - inventoryValue; // Markup yang perlu di-adjust

  // Get COAs
  const inventoryCOA = await findOrCreateInventoryCOA(
    gasStationId,
    productName,
    createdById,
    tx
  );

  // Get Titipan COA (format: "Titipan {nama}")
  const titipanCOAName = `Titipan ${titipanName.trim()}`;
  const titipanCOA = await prismaClient.cOA.findFirst({
    where: {
      gasStationId,
      name: titipanCOAName,
      category: "LIABILITY",
      status: "ACTIVE",
    },
  });

  if (!titipanCOA) {
    throw new Error(
      `COA '${titipanCOAName}' tidak ditemukan. Pastikan titipan sudah dikonfigurasi di gas station.`
    );
  }

  // Get or create Penyesuaian Titipan COA (EXPENSE)
  // Format: "Penyesuaian Titipan {nama}"
  const adjustmentCOAName = `Penyesuaian Titipan ${titipanName.trim()}`;
  let adjustmentCOA = await prismaClient.cOA.findFirst({
    where: {
      gasStationId,
      name: adjustmentCOAName,
      category: "EXPENSE",
      status: "ACTIVE",
    },
  });

  // Jika tidak ada, buat COA baru
  if (!adjustmentCOA) {
    adjustmentCOA = await prismaClient.cOA.create({
      data: {
        gasStationId,
        name: adjustmentCOAName,
        category: "EXPENSE",
        status: "ACTIVE",
        createdById,
      },
    });
  }

  // Build journal entries
  const journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [
    {
      coaId: inventoryCOA.id,
      debit: inventoryValue,
      credit: 0,
      description: `Penambahan persediaan ${productName} dari titipan ${titipanName} ${literAmount.toLocaleString(
        "id-ID"
      )} L @ Rp ${purchasePrice.toLocaleString("id-ID")}`,
    },
    {
      coaId: titipanCOA.id,
      debit: 0,
      credit: titipanValue,
      description: `Utang titipan ke ${titipanName} - ${literAmount.toLocaleString(
        "id-ID"
      )} L ${productName} @ Rp ${sellingPrice.toLocaleString("id-ID")}`,
    },
  ];

  // Tambahkan entry adjustment hanya jika ada selisih (markup)
  if (adjustmentValue > 0 && adjustmentCOA) {
    journalEntries.splice(1, 0, {
      coaId: adjustmentCOA.id,
      debit: adjustmentValue,
      credit: 0,
      description: `Penyesuaian markup titipan ${titipanName} - ${literAmount.toLocaleString(
        "id-ID"
      )} L ${productName} @ Rp ${(sellingPrice - purchasePrice).toLocaleString("id-ID")}`,
    });
  }

  // Create transaction
  const transaction = await createOperationalTransaction({
    gasStationId,
    date: getLocalDateFromUTC(),
    description: `Isi titipan ${productName} dari ${titipanName} - ${literAmount.toLocaleString(
      "id-ID"
    )} L`,
    notes: `Otomatis dibuat saat isi titipan dari ${titipanName}. Persediaan: Rp ${inventoryValue.toLocaleString(
      "id-ID"
    )} (${literAmount.toLocaleString(
      "id-ID"
    )} L × Rp ${purchasePrice.toLocaleString("id-ID")}), Utang Titipan: Rp ${titipanValue.toLocaleString(
      "id-ID"
    )} (${literAmount.toLocaleString(
      "id-ID"
    )} L × Rp ${sellingPrice.toLocaleString("id-ID")}), Adjustment: Rp ${adjustmentValue.toLocaleString(
      "id-ID"
    )}`,
    journalEntries,
    createdById,
    transactionType: "UNLOAD",
    approvalStatus: "APPROVED",
    approverId: null,
    tx,
  });

  return transaction;
}



