"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC, startOfDayUTC } from "@/lib/utils/datetime";
import {
  findOrCreateInventoryCOA,
  findOrCreateCOGSCOA,
  findOrCreateRevenueCOAForProduct,
  findOrCreatePaymentCOA,
  findOrCreateCOA,
} from "@/lib/utils/coa.utils";
import { createOperationalTransaction } from "./transaction-helper";
import type { Prisma } from "@prisma/client";

/**
 * DEPOSIT OPERATOR - Create Transaction
 * Saat deposit operator dibuat:
 * 1. Debit Piutang Usaha, Credit Pendapatan (produk)
 * 2. Debit HPP/COGS, Credit Persediaan (produk)
 * Pendapatan di-breakdown per produk
 */
export async function createDepositOperatorTransaction(params: {
  depositId: string;
  gasStationId: string;
  productSales: Array<{
    productName: string;
    salesVolume: number; // dalam liter
    sellingPrice: number;
    purchasePrice: number;
  }>;
  freeFuelAmount?: number; // Nilai free fuel (opsional)
  freeFuelReason?: string; // Alasan free fuel (opsional)
  createdById: string;
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    productSales,
    freeFuelAmount,
    freeFuelReason,
    createdById,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // Get COAs
  const receivableCOA = await prismaClient.cOA.findFirst({
    where: {
      gasStationId,
      name: "Piutang Usaha",
      status: "ACTIVE",
    },
  });

  if (!receivableCOA) {
    throw new Error(
      "COA 'Piutang Usaha' tidak ditemukan. Pastikan standard COAs sudah dibuat."
    );
  }

  // Transaction 1: Piutang & Pendapatan
  const revenueJournalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  let totalSalesValue = 0;
  const productDescriptions: string[] = [];

  // Process each product untuk pendapatan - hanya produk dengan sales volume > 0
  for (const product of productSales) {
    // Skip produk yang tidak memiliki sales
    if (product.salesVolume <= 0) {
      continue;
    }

    const salesValue = product.salesVolume * product.sellingPrice;
    totalSalesValue += salesValue;

    const revenueCOA = await findOrCreateRevenueCOAForProduct(
      gasStationId,
      product.productName,
      createdById
    );

    revenueJournalEntries.push({
      coaId: revenueCOA.id,
      debit: 0,
      credit: salesValue,
      description: `Pendapatan penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    productDescriptions.push(
      `${product.productName}: ${product.salesVolume.toLocaleString(
        "id-ID"
      )} L × Rp ${product.sellingPrice.toLocaleString(
        "id-ID"
      )} = Rp ${salesValue.toLocaleString("id-ID")}`
    );
  }

  // Debit Piutang Usaha (total semua produk)
  revenueJournalEntries.unshift({
    coaId: receivableCOA.id,
    debit: totalSalesValue,
    credit: 0,
    description: `Piutang dari penjualan`,
  });

  // Jika ada free fuel, tambahkan Biaya Free Fuel
  if (freeFuelAmount && freeFuelAmount > 0) {
    const freeFuelExpenseCOA = await findOrCreateCOA({
      gasStationId,
      name: "Biaya Free Fuel",
      category: "EXPENSE",
      description: "Biaya untuk fuel yang diberikan gratis (free fuel)",
      createdById,
    });

    revenueJournalEntries.push({
      coaId: freeFuelExpenseCOA.id,
      debit: freeFuelAmount,
      credit: 0,
      description: `Biaya free fuel${
        freeFuelReason ? ` - ${freeFuelReason}` : ""
      } (Rp ${freeFuelAmount.toLocaleString("id-ID")})`,
    });
  }

  // Update notes jika ada free fuel
  let transactionNotes = `Otomatis dibuat saat deposit operator.\n${productDescriptions.join(
    "\n"
  )}`;
  if (freeFuelAmount && freeFuelAmount > 0) {
    transactionNotes += `\n\nFree Fuel: Rp ${freeFuelAmount.toLocaleString(
      "id-ID"
    )}${freeFuelReason ? ` - ${freeFuelReason}` : ""}`;
  }

  // Create transaction 1: Piutang & Pendapatan
  const revenueTransaction = await createOperationalTransaction({
    gasStationId,
    date: nowUTC(),
    description: `Deposit operator - Penjualan Rp ${totalSalesValue.toLocaleString(
      "id-ID"
    )}${
      freeFuelAmount && freeFuelAmount > 0
        ? ` + Free Fuel Rp ${freeFuelAmount.toLocaleString("id-ID")}`
        : ""
    }`,
    notes: transactionNotes,
    journalEntries: revenueJournalEntries,
    createdById,
    transactionType: "REVENUE",
    approvalStatus: "APPROVED",
    approverId: null, // Auto-approved, tidak perlu approverId
    tx,
  });

  // Transaction 2: HPP & Persediaan
  const cogsJournalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  let totalCOGSValue = 0;
  const cogsDescriptions: string[] = [];

  // Process each product untuk HPP - hanya produk dengan sales volume > 0
  for (const product of productSales) {
    // Skip produk yang tidak memiliki sales
    if (product.salesVolume <= 0) {
      continue;
    }

    const cogsValue = product.salesVolume * product.purchasePrice;
    totalCOGSValue += cogsValue;

    const cogsCOA = await findOrCreateCOGSCOA(
      gasStationId,
      product.productName,
      createdById
    );

    const inventoryCOA = await findOrCreateInventoryCOA(
      gasStationId,
      product.productName,
      createdById
    );

    cogsJournalEntries.push({
      coaId: cogsCOA.id,
      debit: cogsValue,
      credit: 0,
      description: `HPP penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    cogsJournalEntries.push({
      coaId: inventoryCOA.id,
      debit: 0,
      credit: cogsValue,
      description: `Pengurangan persediaan karena penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    cogsDescriptions.push(
      `${product.productName}: ${product.salesVolume.toLocaleString(
        "id-ID"
      )} L × Rp ${product.purchasePrice.toLocaleString(
        "id-ID"
      )} = Rp ${cogsValue.toLocaleString("id-ID")}`
    );
  }

  // Create transaction 2: HPP & Persediaan (hanya jika ada penjualan)
  let cogsTransaction = null;
  if (productSales.length > 0 && cogsJournalEntries.length > 0) {
    cogsTransaction = await createOperationalTransaction({
      gasStationId,
      date: nowUTC(),
      description: `Deposit operator - HPP Rp ${totalCOGSValue.toLocaleString(
        "id-ID"
      )}`,
      notes: `Otomatis dibuat saat deposit operator.\n${cogsDescriptions.join(
        "\n"
      )}`,
      journalEntries: cogsJournalEntries,
      createdById,
      transactionType: "COGS",
      approvalStatus: "APPROVED",
      approverId: null, // Auto-approved, tidak perlu approverId
      tx,
    });
  }

  return { revenueTransaction, cogsTransaction };
}

/**
 * DEPOSIT APPROVE - Combined Revenue & COGS Transaction
 * Saat deposit di-approve finance:
 * - Transaksi 1 (REVENUE): Debit Kas/Bank, Debit Biaya Free Fuel, Credit Pendapatan
 * - Transaksi 2 (COGS): Debit HPP, Credit Persediaan
 * Payment method diambil dari DepositDetail yang sudah diinput operator
 * Untuk BANK, bisa spesifik bank name untuk multiple bank accounts
 */
export async function createDepositApprovalTransaction(params: {
  depositId: string;
  gasStationId: string;
  salesValue: number; // Nilai sales total
  depositDetails: Array<{
    paymentAccount: "CASH" | "BANK";
    paymentMethod?:
      | "QRIS"
      | "TRANSFER"
      | "DEBIT_CARD"
      | "CREDIT_CARD"
      | "COUPON"
      | "ETC";
    amount: number; // Positif untuk CASH/BANK, negatif untuk COUPON (tip)
    bankName?: string; // Optional: untuk multiple bank accounts (misal: "BCA", "Mandiri")
  }>;
  productSales: Array<{
    productName: string;
    salesVolume: number; // dalam liter
    sellingPrice: number;
    purchasePrice: number;
  }>;
  pumpTestByProduct?: Array<{
    productName: string;
    pumpTestVolume: number; // dalam liter
    purchasePrice: number;
  }>;
  freeFuelAmount?: number; // Nilai free fuel (opsional)
  freeFuelReason?: string; // Alasan free fuel (opsional)
  titipanProducts?: Array<{ coaId: string; amount: number }>; // Array titipan products (opsional)
  createdById: string; // User yang input deposit (finance)
  approverId: string; // User yang approve deposit (manager)
  shift?: string; // Shift name (e.g., "Pagi", "Siang", "Malam")
  stationName?: string; // Station name
  shiftDate?: Date; // Shift date
  operatorName?: string; // Operator name
  tx?: Prisma.TransactionClient;
}) {
  const {
    gasStationId,
    salesValue,
    depositDetails,
    productSales,
    pumpTestByProduct = [],
    freeFuelAmount: paramFreeFuelAmount,
    freeFuelReason: paramFreeFuelReason,
    titipanProducts: paramTitipanProducts,
    createdById, // User yang input deposit (finance)
    approverId, // User yang approve deposit (manager)
    shift,
    stationName,
    shiftDate,
    operatorName,
    tx,
  } = params;

  const prismaClient = tx || prisma;

  // ============================================
  // TRANSAKSI 1: REVENUE (Kas/Bank & Pendapatan)
  // ============================================
  // Jurnal Entry:
  // DEBIT:
  //   - Kas/Bank (dari paymentDetails)
  //   - Biaya Free Fuel (jika ada)
  //   - Titipan Product (jika ada, setiap COA terpisah)
  // CREDIT:
  //   - Pendapatan (per produk)
  //
  // Balance: Total Debit = Total Credit
  // Total Debit = Kas/Bank + Free Fuel + Sum(Titipan)
  // Total Credit = Total Sales (Pendapatan)
  // ============================================
  const revenueJournalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  // Group by payment account dan bank name (untuk multiple bank)
  // Key: "CASH" atau "BANK" atau "BANK_{bankName}"
  const paymentGroups: Record<string, number> = {};

  let totalPayment = 0; // Total payment yang diterima

  depositDetails.forEach((detail) => {
    if (detail.amount > 0) {
      // CASH/BANK yang positif
      totalPayment += detail.amount;
      const key =
        detail.paymentAccount === "BANK" && detail.bankName
          ? `BANK_${detail.bankName}`
          : detail.paymentAccount;

      if (!paymentGroups[key]) {
        paymentGroups[key] = 0;
      }
      paymentGroups[key] += detail.amount;
    }
  });

  // Free fuel amount dari parameter (bukan dari payment details)
  const freeFuelAmount = paramFreeFuelAmount || 0;
  // Titipan products dari parameter
  const titipanProducts = paramTitipanProducts || [];

  // Debit Kas/Bank untuk setiap payment account
  for (const [key, amount] of Object.entries(paymentGroups)) {
    if (amount > 0) {
      let paymentAccount: "CASH" | "BANK";
      let bankName: string | undefined;

      if (key.startsWith("BANK_")) {
        paymentAccount = "BANK";
        bankName = key.replace("BANK_", "");
      } else {
        paymentAccount = key as "CASH" | "BANK";
        bankName = undefined;
      }

      const paymentCOA = await findOrCreatePaymentCOA(
        gasStationId,
        paymentAccount,
        createdById,
        bankName
      );

      const description = operatorName
        ? `Setoran deposit ${operatorName} via ${paymentAccount}`
        : `Setoran deposit via ${paymentAccount}`;

      revenueJournalEntries.push({
        coaId: paymentCOA.id,
        debit: amount,
        credit: 0,
        description,
      });
    }
  }

  // Debit Biaya Free Fuel (jika ada)
  if (freeFuelAmount > 0) {
    const freeFuelExpenseCOA = await findOrCreateCOA({
      gasStationId,
      name: "Biaya Free Fuel",
      category: "EXPENSE",
      description: "Biaya untuk fuel yang diberikan gratis (free fuel)",
      createdById,
    });

    revenueJournalEntries.push({
      coaId: freeFuelExpenseCOA.id,
      debit: freeFuelAmount,
      credit: 0,
      description: `Biaya free fuel${
        paramFreeFuelReason ? ` - ${paramFreeFuelReason}` : ""
      } (Rp ${freeFuelAmount.toLocaleString("id-ID")})`,
    });
  }

  // Debit Titipan Product (jika ada) - setiap COA terpisah
  for (const titipan of titipanProducts) {
    if (titipan.amount > 0) {
      const titipanCOA = await prismaClient.cOA.findUnique({
        where: { id: titipan.coaId },
      });

      if (!titipanCOA) {
        throw new Error(`COA Titipan dengan ID ${titipan.coaId} tidak ditemukan.`);
      }

      revenueJournalEntries.push({
        coaId: titipanCOA.id,
        debit: titipan.amount, // Debet untuk mengurangi kewajiban
        credit: 0,
        description: `Titipan ${titipanCOA.name.replace("Titipan ", "")} (Rp ${titipan.amount.toLocaleString("id-ID")})`,
      });
    }
  }

  // Credit Pendapatan per produk - hanya produk dengan sales volume > 0
  let totalSalesValue = 0;
  const productDescriptions: string[] = [];

  for (const product of productSales) {
    // Skip produk yang tidak memiliki sales
    if (product.salesVolume <= 0) {
      continue;
    }

    const salesValue = product.salesVolume * product.sellingPrice;
    totalSalesValue += salesValue;

    const revenueCOA = await findOrCreateRevenueCOAForProduct(
      gasStationId,
      product.productName,
      createdById
    );

    revenueJournalEntries.push({
      coaId: revenueCOA.id,
      debit: 0,
      credit: salesValue,
      description: `Pendapatan penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    productDescriptions.push(
      `${product.productName}: ${product.salesVolume.toLocaleString(
        "id-ID"
      )} L × Rp ${product.sellingPrice.toLocaleString(
        "id-ID"
      )} = Rp ${salesValue.toLocaleString("id-ID")}`
    );
  }

  // Update notes jika ada free fuel atau titipan products
  let revenueNotes = `Otomatis dibuat saat approve deposit operator.\n${productDescriptions.join(
    "\n"
  )}`;
  if (freeFuelAmount > 0) {
    revenueNotes += `\n\nFree Fuel: Rp ${freeFuelAmount.toLocaleString(
      "id-ID"
    )}${paramFreeFuelReason ? ` - ${paramFreeFuelReason}` : ""}`;
  }
  if (titipanProducts.length > 0) {
    const titipanTotal = titipanProducts.reduce((sum, t) => sum + t.amount, 0);
    revenueNotes += `\n\nTitipan Products: Rp ${titipanTotal.toLocaleString("id-ID")}`;
  }

  // Validasi balance sebelum create transaction
  // Total Debit harus sama dengan Total Credit
  const titipanTotal = titipanProducts.reduce(
    (sum, t) => sum + (t.amount || 0),
    0
  );
  const expectedTotal = totalPayment + freeFuelAmount + titipanTotal;
  if (Math.abs(expectedTotal - totalSalesValue) > 0.01) {
    throw new Error(
      `Jurnal tidak balance! Total Payment (${totalPayment.toLocaleString("id-ID")}) + Free Fuel (${freeFuelAmount.toLocaleString("id-ID")}) + Titipan (${titipanTotal.toLocaleString("id-ID")}) = ${expectedTotal.toLocaleString("id-ID")}, tetapi Total Sales = ${totalSalesValue.toLocaleString("id-ID")}`
    );
  }

  // Format deskripsi transaksi REVENUE: "Pendapatan Penjualan {operatorName} {stationName}"
  const revenueDescription =
    operatorName && stationName
      ? `Pendapatan Penjualan ${operatorName} ${stationName}`
      : `Deposit operator - Penjualan Rp ${totalSalesValue.toLocaleString(
          "id-ID"
        )        }${
          freeFuelAmount > 0
            ? ` + Free Fuel Rp ${freeFuelAmount.toLocaleString("id-ID")}`
            : ""
        }${
          titipanProducts.length > 0
            ? ` + Titipan Rp ${titipanTotal.toLocaleString("id-ID")}`
            : ""
        }`;

  // Create transaction 1: REVENUE
  // Balance akan divalidasi lagi di createOperationalTransaction -> createAutoTransaction
  // Gunakan shiftDate jika tersedia untuk konsistensi dengan deposit history filtering
  // Normalize shiftDate ke start of day UTC untuk konsistensi dengan filtering di deposit history
  const transactionDate = shiftDate ? startOfDayUTC(shiftDate) : nowUTC();
  const revenueTransaction = await createOperationalTransaction({
    gasStationId,
    date: transactionDate,
    description: revenueDescription,
    notes: revenueNotes,
    journalEntries: revenueJournalEntries,
    createdById, // User yang input deposit (finance)
    transactionType: "REVENUE",
    approvalStatus: "APPROVED",
    approverId, // User yang approve deposit (manager)
    tx,
  });

  // ============================================
  // TRANSAKSI 2: COGS (HPP & Persediaan + Pump Test)
  // ============================================
  const cogsJournalEntries: Array<{
    coaId: string;
    debit: number;
    credit: number;
    description?: string | null;
  }> = [];

  let totalCOGSValue = 0;
  const cogsDescriptions: string[] = [];

  // Process each product untuk HPP - hanya produk dengan sales volume > 0
  for (const product of productSales) {
    // Skip produk yang tidak memiliki sales
    if (product.salesVolume <= 0) {
      continue;
    }

    const cogsValue = product.salesVolume * product.purchasePrice;
    totalCOGSValue += cogsValue;

    const cogsCOA = await findOrCreateCOGSCOA(
      gasStationId,
      product.productName,
      createdById
    );

    const inventoryCOA = await findOrCreateInventoryCOA(
      gasStationId,
      product.productName,
      createdById
    );

    cogsJournalEntries.push({
      coaId: cogsCOA.id,
      debit: cogsValue,
      credit: 0,
      description: `HPP penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    cogsJournalEntries.push({
      coaId: inventoryCOA.id,
      debit: 0,
      credit: cogsValue,
      description: `Pengurangan persediaan karena penjualan ${
        product.productName
      } ${product.salesVolume.toLocaleString("id-ID")} L`,
    });

    cogsDescriptions.push(
      `${product.productName}: ${product.salesVolume.toLocaleString(
        "id-ID"
      )} L × Rp ${product.purchasePrice.toLocaleString(
        "id-ID"
      )} = Rp ${cogsValue.toLocaleString("id-ID")}`
    );
  }

  // Process pump test untuk setiap product
  let totalPumpTestValue = 0;
  const pumpTestDescriptions: string[] = [];

  for (const pumpTest of pumpTestByProduct) {
    if (pumpTest.pumpTestVolume > 0) {
      const pumpTestValue = pumpTest.pumpTestVolume * pumpTest.purchasePrice;
      totalPumpTestValue += pumpTestValue;

      // Get COA untuk Biaya Pump Test
      const pumpTestExpenseCOA = await findOrCreateCOA({
        gasStationId,
        name: "Biaya Pump Test",
        category: "COGS",
        description: "HPP untuk pump test station",
        createdById,
      });

      // Get Inventory COA untuk product
      const inventoryCOA = await findOrCreateInventoryCOA(
        gasStationId,
        pumpTest.productName,
        createdById
      );

      // Debit: Biaya Pump Test
      cogsJournalEntries.push({
        coaId: pumpTestExpenseCOA.id,
        debit: pumpTestValue,
        credit: 0,
        description: `pump test station ${stationName || "N/A"} ${pumpTest.productName}. ${pumpTest.pumpTestVolume.toLocaleString(
          "id-ID"
        )} liter (Rp ${pumpTest.purchasePrice.toLocaleString("id-ID")})`,
      });

      // Credit: Persediaan Produk
      cogsJournalEntries.push({
        coaId: inventoryCOA.id,
        debit: 0,
        credit: pumpTestValue,
        description: `Pengurangan persediaan karena pump test ${
          pumpTest.productName
        } ${pumpTest.pumpTestVolume.toLocaleString("id-ID")} L`,
      });

      pumpTestDescriptions.push(
        `Pump Test ${
          pumpTest.productName
        }: ${pumpTest.pumpTestVolume.toLocaleString(
          "id-ID"
        )} L × Rp ${pumpTest.purchasePrice.toLocaleString(
          "id-ID"
        )} = Rp ${pumpTestValue.toLocaleString("id-ID")}`
      );
    }
  }

  // Update notes untuk include HPP dan pump test
  let cogsNotes = `Otomatis dibuat saat approve deposit operator.`;
  
  if (cogsDescriptions.length > 0) {
    cogsNotes += `\n\nHPP:\n${cogsDescriptions.join("\n")}`;
  }
  
  if (pumpTestDescriptions.length > 0) {
    cogsNotes += `\n\nPump Test:\n${pumpTestDescriptions.join("\n")}`;
  }

  // Format deskripsi transaksi COGS: "HPP penjualan {operatorName} {stationName}"
  const cogsDescription =
    operatorName && stationName
      ? `HPP penjualan ${operatorName} ${stationName}`
      : stationName
      ? `HPP penjualan ${stationName}`
      : `Deposit operator - HPP Rp ${totalCOGSValue.toLocaleString("id-ID")}`;

  // Create transaction 2: COGS
  // Gunakan shiftDate jika tersedia untuk konsistensi dengan deposit history filtering
  const cogsTransaction = await createOperationalTransaction({
    gasStationId,
    date: transactionDate,
    description: cogsDescription,
    notes: cogsNotes,
    journalEntries: cogsJournalEntries,
    createdById, // User yang input deposit (finance)
    transactionType: "COGS",
    approvalStatus: "APPROVED",
    approverId, // User yang approve deposit (manager)
    tx,
  });

  return { revenueTransaction, cogsTransaction };
}
