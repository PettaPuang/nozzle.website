import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  startOfDayUTC,
  addDaysUTC,
  createUTCDate,
} from "../lib/utils/datetime";
import {
  findOrCreateLOProductCOA,
  findOrCreatePaymentCOA,
  findOrCreateCOA,
} from "../lib/utils/coa.utils";
import { createDepositApprovalTransaction } from "../lib/utils/transaction/transaction-deposit";
import { createUnloadDeliveryTransaction } from "../lib/utils/transaction/transaction-unload";
import {
  createTankReadingLossTransaction,
  createTankReadingProfitTransaction,
} from "../lib/utils/transaction/transaction-tank-reading";

export const prisma = new PrismaClient();

// Rentang tanggal: 2025-11-15 s/d 2026-01-15
export const START_DATE = createUTCDate(2025, 10, 15); // month is 0-indexed
export const END_DATE = createUTCDate(2026, 0, 15);

// Helper untuk retry operasi database dengan exponential backoff
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Cek jika error terkait koneksi
      const isConnectionError =
        error?.message?.includes("connection") ||
        error?.message?.includes("ConnectionReset") ||
        error?.message?.includes("Can't reach database server") ||
        error?.code === "10054" ||
        error?.code === "P1001" || // Prisma connection error
        error?.kind === "Io";

      if (!isConnectionError || attempt === maxRetries) {
        // Jika bukan connection error atau sudah max retries, throw error
        if (attempt === maxRetries && isConnectionError) {
          console.error(
            `❌ Failed to connect to database after ${maxRetries} attempts.`
          );
          console.error(
            "💡 Please check:\n" +
              "   1. Database server is running\n" +
              "   2. DATABASE_URL is correct in .env file\n" +
              "   3. Network connection is stable\n" +
              "   4. Database credentials are valid"
          );
        }
        throw error;
      }

      // Exponential backoff: delay bertambah setiap retry
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(
        `⚠️  Database connection error (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Reconnect jika koneksi terputus
      try {
        await prisma.$connect();
      } catch (connectError) {
        // Ignore connection errors saat reconnect
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

// Helper untuk hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper untuk membuat date dalam format UTC
export function createDate(year: number, month: number, day: number): Date {
  return createUTCDate(year, month - 1, day); // month is 0-indexed
}

// Helper function untuk membuat purchase transaction sesuai format purchase.actions.ts
export async function createPurchaseTransactionForSeed(params: {
  gasStationId: string;
  productId: string;
  purchaseVolume: number;
  date: Date;
  bankName?: string;
  referenceNumber?: string;
  notes?: string;
  approverId: string;
  createdById: string;
  tx?: any;
}) {
  const {
    gasStationId,
    productId,
    purchaseVolume,
    date,
    bankName,
    referenceNumber,
    notes,
    approverId,
    createdById,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Get product info
  const product = await prismaClient.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, purchasePrice: true },
  });

  if (!product) {
    throw new Error("Product tidak ditemukan");
  }

  // Normalize product name
  const normalizedProductName = product.name.trim();
  const purchasePrice = product.purchasePrice;
  const totalValue = purchaseVolume * purchasePrice;

  // Get COAs - menggunakan fungsi yang sudah ada (dengan tx support)
  const loProductCOA = await findOrCreateLOProductCOA(
    gasStationId,
    normalizedProductName,
    createdById,
    tx
  );

  // findOrCreatePaymentCOA tidak support tx, jadi langsung panggil tanpa tx
  const bankCOA = await findOrCreatePaymentCOA(
    gasStationId,
    "BANK",
    createdById,
    bankName
  );

  // Auto-generate journal entries: Debit LO Produk, Credit Bank (sesuai format purchase.actions.ts)
  const journalEntries = [
    {
      coaId: loProductCOA.id,
      debit: totalValue,
      credit: 0,
      description: `LO ${normalizedProductName} ${purchaseVolume.toLocaleString(
        "id-ID"
      )} L`,
    },
    {
      coaId: bankCOA.id,
      debit: 0,
      credit: totalValue,
      description: `Pembayaran pembelian ${normalizedProductName}`,
    },
  ];

  // Validate balance
  const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(
      `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
        "id-ID"
      )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
    );
  }

  // Auto-generate description (sesuai format purchase.actions.ts)
  const description =
    notes ||
    `Pembelian BBM ${normalizedProductName} - ${purchaseVolume.toLocaleString(
      "id-ID"
    )} L`;

  // Create transaction header
  const transaction = await prismaClient.transaction.create({
    data: {
      gasStationId,
      productId,
      date: startOfDayUTC(date),
      description,
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      transactionType: "PURCHASE_BBM",
      approvalStatus: "APPROVED",
      approverId,
      purchaseVolume,
      deliveredVolume: 0,
      createdById,
    },
  });

  // Create journal entries
  await prismaClient.journalEntry.createMany({
    data: journalEntries.map((entry) => ({
      transactionId: transaction.id,
      coaId: entry.coaId,
      debit: entry.debit || 0,
      credit: entry.credit || 0,
      description: entry.description || null,
      createdById,
    })),
  });

  return transaction;
}

// Helper function untuk membuat cash transaction (EXPENSE/TRANSFER) sesuai format action
export async function createCashTransactionForSeed(params: {
  gasStationId: string;
  date: Date;
  description: string;
  cashTransactionType: "EXPENSE" | "TRANSFER";
  paymentAccount: "CASH" | "BANK";
  bankName?: string;
  toPaymentAccount?: "CASH" | "BANK";
  toBankName?: string;
  coaId?: string;
  amount: number;
  approverId: string;
  createdById: string;
  tx?: any;
}) {
  const {
    gasStationId,
    date,
    description,
    cashTransactionType,
    paymentAccount,
    bankName,
    toPaymentAccount,
    toBankName,
    coaId,
    amount,
    approverId,
    createdById,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Get payment COAs
  const paymentCOA = await findOrCreatePaymentCOA(
    gasStationId,
    paymentAccount,
    createdById,
    bankName
  );

  let journalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  if (cashTransactionType === "TRANSFER") {
    // TRANSFER: Debit dari payment account, Credit ke toPaymentAccount
    const toPaymentCOA = await findOrCreatePaymentCOA(
      gasStationId,
      toPaymentAccount!,
      createdById,
      toBankName
    );

    journalEntries = [
      {
        coaId: toPaymentCOA.id,
        debit: amount,
        credit: 0,
        description: `Transfer masuk ke ${toPaymentCOA.name}`,
      },
      {
        coaId: paymentCOA.id,
        debit: 0,
        credit: amount,
        description: `Transfer keluar dari ${paymentCOA.name}`,
      },
    ];
  } else {
    // EXPENSE: Debit expense COA, Credit payment COA
    if (!coaId) {
      throw new Error("COA ID required for EXPENSE transaction");
    }

    const coa = await prismaClient.cOA.findUnique({
      where: { id: coaId },
    });

    if (!coa) {
      throw new Error("COA tidak ditemukan");
    }

    journalEntries = [
      {
        coaId: coa.id,
        debit: amount,
        credit: 0,
        description: `Pengeluaran: ${coa.name}`,
      },
      {
        coaId: paymentCOA.id,
        debit: 0,
        credit: amount,
        description: `Pembayaran dari ${paymentCOA.name}`,
      },
    ];
  }

  // Validate balance
  const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(
      `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
        "id-ID"
      )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
    );
  }

  // Create transaction header
  const transaction = await prismaClient.transaction.create({
    data: {
      gasStationId,
      date: startOfDayUTC(date),
      description,
      transactionType: "CASH",
      approvalStatus: "APPROVED",
      approverId,
      createdById,
    },
  });

  // Create journal entries
  await prismaClient.journalEntry.createMany({
    data: journalEntries.map((entry) => ({
      transactionId: transaction.id,
      coaId: entry.coaId,
      debit: entry.debit || 0,
      credit: entry.credit || 0,
      description: entry.description || null,
      createdById,
    })),
  });

  return transaction;
}

