"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  findOrCreateInventoryCOA,
  findOrCreateCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";

/**
 * UNLOAD - Shrinkage Transaction
 * Saat unload di-approve manager dan ada initialOrderVolume:
 * - Handle susut perjalanan: Debit Biaya Susut Perjalanan, Credit Persediaan
 * - Hanya trigger jika ada susut (initialOrderVolume > literAmount)
 */
export async function createUnloadShrinkageTransaction(params: {
  unloadId: string;
  gasStationId: string;
  tankId: string;
  productName: string;
  initialOrderVolume: number;
  literAmount: number;
  purchasePrice: number;
  invoiceNumber?: string | null;
  createdById: string;
  approverId: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    initialOrderVolume,
    literAmount,
    purchasePrice,
    invoiceNumber,
    createdById,
    approverId,
    tx,
  } = params;

  // Calculate shrinkage
  const shrinkage = initialOrderVolume - literAmount;

  // Jika tidak ada susut, tidak perlu create transaction
  if (shrinkage <= 0) {
    return null;
  }

  // Get COAs
  const inventoryCOA = await findOrCreateInventoryCOA(
    gasStationId,
    productName,
    createdById
  );

  const shrinkageValue = shrinkage * purchasePrice;

  // Gunakan COA default "Biaya Susut Perjalanan" (tidak spesifik produk)
  const shrinkageExpenseCOA = await findOrCreateCOA({
    gasStationId,
    name: "Biaya Susut Perjalanan",
    category: "EXPENSE",
    description: "Biaya susut BBM selama perjalanan dari supplier ke SPBU",
    createdById,
  });

  const journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [
    {
      coaId: shrinkageExpenseCOA.id,
      debit: shrinkageValue,
      credit: 0,
      description: `Susut perjalanan ${productName}: ${initialOrderVolume.toLocaleString(
        "id-ID"
      )} L - ${literAmount.toLocaleString(
        "id-ID"
      )} L = ${shrinkage.toLocaleString("id-ID")} L`,
    },
    {
      coaId: inventoryCOA.id,
      debit: 0,
      credit: shrinkageValue,
      description: `Pengurangan persediaan karena susut perjalanan ${productName}`,
    },
  ];

  const transaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Susut perjalanan ${productName} - ${shrinkage.toLocaleString(
      "id-ID"
    )} L`,
    referenceNumber: invoiceNumber || null,
    notes: `Otomatis dibuat saat unload di-approve. Pesanan: ${initialOrderVolume.toLocaleString(
      "id-ID"
    )} L, Real: ${literAmount.toLocaleString(
      "id-ID"
    )} L, Susut: ${shrinkage.toLocaleString("id-ID")} L`,
    journalEntries,
    createdById, // User yang melakukan unload
    transactionType: "UNLOAD",
    approvalStatus: "APPROVED",
    approverId, // User yang approve (manager)
    tx,
  });

  return transaction;
}

/**
 * UNLOAD - Delivery Transaction (Case 2)
 * Saat unload di-approve manager dan ada purchaseTransactionId:
 * - Debit: Produk XXX (real volume masuk tank)
 * - Debit: Biaya Susut Perjalanan (jika ada susut: deliveredVolume > realVolume)
 * - Credit: LO Produk (delivered volume)
 */
export async function createUnloadDeliveryTransaction(params: {
  unloadId: string;
  gasStationId: string;
  tankId: string;
  productId: string;
  productName: string;
  purchasePrice: number; // Purchase price dari product yang sesuai dengan gasStationId
  deliveredVolume: number; // Volume yang di-deliver (misal: 8000L)
  realVolume: number; // Real volume masuk tank (misal: 7900L)
  purchaseTransactionId: string;
  invoiceNumber?: string | null;
  createdById: string;
  approverId: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productName,
    purchasePrice,
    deliveredVolume,
    realVolume,
    purchaseTransactionId,
    invoiceNumber,
    createdById,
    approverId,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Get purchase transaction untuk mendapatkan COA LO yang benar
  const purchaseTransaction = await prismaClient.transaction.findUnique({
    where: { id: purchaseTransactionId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
        },
      },
      journalEntries: {
        include: {
          coa: true,
        },
      },
    },
  });

  if (!purchaseTransaction) {
    throw new Error("Purchase transaction not found");
  }

  // Validasi: Pastikan purchase transaction memiliki productId (harus selalu ada setelah migration)
  if (!purchaseTransaction.productId) {
    throw new Error(
      "Purchase transaction tidak memiliki productId. Harus di-migrate terlebih dahulu dengan migration script."
    );
  }

  // Validasi: Pastikan productId purchase transaction sesuai dengan productId unload
  if (purchaseTransaction.productId !== params.productId) {
    throw new Error(
      `ProductId tidak konsisten: purchase transaction productId "${purchaseTransaction.productId}" tidak sesuai dengan unload productId "${params.productId}"`
    );
  }

  // Validasi: Pastikan product relation ada (harus selalu ada setelah migration)
  if (!purchaseTransaction.product) {
    throw new Error(
      "Purchase transaction tidak memiliki product relation. Harus di-migrate terlebih dahulu dengan migration script."
    );
  }
  
  if (purchaseTransaction.product.name.trim() !== productName.trim()) {
    throw new Error(
      `Product name tidak konsisten: purchase transaction product "${purchaseTransaction.product.name}" tidak sesuai dengan unload product "${productName}"`
    );
  }

  // Extract LO COA dari purchase transaction (harus sama dengan yang digunakan saat create purchase)
  // Kita perlu COA ID untuk journal entry, jadi masih perlu extract dari journalEntries
  const loProductCOAEntry = purchaseTransaction.journalEntries.find(
    (entry) => entry.coa.name.startsWith("LO ") && entry.debit > 0
  );

  if (!loProductCOAEntry) {
    throw new Error("Purchase transaction tidak memiliki LO Product COA yang valid");
  }

  // Validasi tambahan: Pastikan COA LO name sesuai dengan productName (double check)
  const expectedCOAName = `LO ${productName.trim()}`;
  if (loProductCOAEntry.coa.name !== expectedCOAName) {
    throw new Error(
      `COA LO name tidak konsisten: expected "${expectedCOAName}", got "${loProductCOAEntry.coa.name}". Product name mungkin berubah setelah purchase dibuat.`
    );
  }

  // Gunakan COA LO yang sama dengan purchase transaction (bukan membuat baru)
  const loProductCOA = {
    id: loProductCOAEntry.coaId,
    name: loProductCOAEntry.coa.name,
  };

  // Calculate shrinkage
  const shrinkage = deliveredVolume - realVolume;

  // Get COAs (pastikan productName sudah di-trim)
  const normalizedProductName = productName.trim();
  const inventoryCOA = await findOrCreateInventoryCOA(
    gasStationId,
    normalizedProductName,
    createdById,
    tx
  );

  const shrinkageExpenseCOA = await findOrCreateCOA({
    gasStationId,
    name: "Biaya Susut Perjalanan",
    category: "EXPENSE",
    description: "Biaya susut BBM selama perjalanan dari supplier ke SPBU",
    createdById,
  });

  // Transaksi auto saat unload di-approve:
  // 1. Debit Persediaan (product name) = realVolume * purchasePrice
  // 2. Kredit LO (product name) = deliveredVolume * purchasePrice
  // 3. Debit Biaya Susut Perjalanan = (deliveredVolume - realVolume) * purchasePrice (jika ada selisih)
  const journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [
    // Debit: Persediaan (product name) - real volume yang masuk tank
    {
      coaId: inventoryCOA.id,
      debit: realVolume * purchasePrice,
      credit: 0,
      description: `Persediaan ${normalizedProductName} masuk tank: ${realVolume.toLocaleString(
        "id-ID"
      )} L`,
    },
    // Debit: Biaya Susut Perjalanan (jika ada selisih antara delivered dan real)
    ...(shrinkage > 0
      ? [
          {
            coaId: shrinkageExpenseCOA.id,
            debit: shrinkage * purchasePrice,
            credit: 0,
            description: `Susut perjalanan ${normalizedProductName}: ${deliveredVolume.toLocaleString(
              "id-ID"
            )} L - ${realVolume.toLocaleString(
              "id-ID"
            )} L = ${shrinkage.toLocaleString("id-ID")} L`,
          },
        ]
      : []),
    // Kredit: LO (product name) - delivered volume yang diinput di unload form
    {
      coaId: loProductCOA.id,
      debit: 0,
      credit: deliveredVolume * purchasePrice,
      description: `Pengurangan LO ${normalizedProductName}: ${deliveredVolume.toLocaleString(
        "id-ID"
      )} L`,
    },
  ];

  const transaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Unload ${normalizedProductName} - ${deliveredVolume.toLocaleString(
      "id-ID"
    )} L (real: ${realVolume.toLocaleString("id-ID")} L)`,
    referenceNumber: invoiceNumber || null,
    notes: `Otomatis dibuat saat unload di-approve. Delivered: ${deliveredVolume.toLocaleString(
      "id-ID"
    )} L, Real: ${realVolume.toLocaleString("id-ID")} L${
      shrinkage > 0 ? `, Susut: ${shrinkage.toLocaleString("id-ID")} L` : ""
    }`,
    journalEntries,
    createdById, // User yang melakukan unload
    transactionType: "UNLOAD",
    approvalStatus: "APPROVED",
    approverId, // User yang approve (manager)
    tx,
  });

  return transaction;
}

