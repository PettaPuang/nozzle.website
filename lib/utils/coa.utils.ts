"use server";

import { prisma } from "@/lib/prisma";
import type { COACategory, Status } from "@prisma/client";

type FindOrCreateCOAInput = {
  gasStationId: string;
  name: string;
  category: COACategory;
  description?: string;
  createdById: string;
  code?: string | null;
  status?: Status;
};

/**
 * Mencari COA berdasarkan gasStationId dan name.
 * Jika tidak ditemukan, akan membuat COA baru.
 * @returns COA yang sudah ada atau baru dibuat
 */
export async function findOrCreateCOA(
  input: FindOrCreateCOAInput,
  tx?: any // Transaction client (optional)
): Promise<{ id: string; name: string; category: COACategory }> {
  const prismaClient = tx || prisma;

  // Cari COA yang sudah ada
  const existingCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId: input.gasStationId,
        name: input.name,
      },
    },
  });

  if (existingCOA) {
    return {
      id: existingCOA.id,
      name: existingCOA.name,
      category: existingCOA.category,
    };
  }

  // Buat COA baru jika belum ada
  const newCOA = await prismaClient.cOA.create({
    data: {
      gasStationId: input.gasStationId,
      code: input.code ?? null,
      name: input.name,
      category: input.category,
      status: input.status ?? "ACTIVE",
      description: input.description,
      createdById: input.createdById,
    },
  });

  return {
    id: newCOA.id,
    name: newCOA.name,
    category: newCOA.category,
  };
}

/**
 * Helper untuk membuat COA Inventory berdasarkan product name
 */
export async function findOrCreateInventoryCOA(
  gasStationId: string,
  productName: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const coaName = `Persediaan ${productName}`;
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "ASSET",
      description: `Persediaan untuk ${productName}`,
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Revenue berdasarkan product name
 */
export async function findOrCreateRevenueCOAForProduct(
  gasStationId: string,
  productName: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const coaName = `Pendapatan ${productName}`;
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "REVENUE",
      description: `Pendapatan dari penjualan ${productName}`,
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA COGS berdasarkan product name
 */
export async function findOrCreateCOGSCOA(
  gasStationId: string,
  productName: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const coaName = `HPP ${productName}`;
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "COGS",
      description: `Harga Pokok Penjualan untuk ${productName}`,
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk mendapatkan COA Susut per Produk (COGS)
 * Digunakan untuk tank reading variance
 * Contoh: Susut Pertalite, Susut Pertamax, dst
 */
export async function findOrCreateShrinkageCOA(
  gasStationId: string,
  productName: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const coaName = `Susut ${productName}`;
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "COGS",
      description: `HPP susut/shrinkage produk ${productName} dari tank reading`,
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Biaya Susut Tank Reading
 * Digunakan untuk mencatat variance dari tank reading (bisa positif/negatif)
 * Net balance langsung mempengaruhi Realtime Profit/Loss
 */
export async function findOrCreateTankReadingShrinkageCOA(
  gasStationId: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const coaName = "Biaya Susut Tank Reading";
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "EXPENSE",
      description: "Biaya/pendapatan susut dari penyesuaian stock tank reading. Debit = biaya (loss), Credit = pendapatan (profit)",
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Equity (Modal)
 */
export async function findOrCreateEquityCOA(
  gasStationId: string,
  createdById: string,
  equityName: string = "Modal Awal",
  tx?: any
): Promise<{ id: string; name: string }> {
  const coa = await findOrCreateCOA({
    gasStationId,
    name: equityName,
    category: "EQUITY",
    description: "Modal awal untuk operasional",
    createdById,
  }, tx);

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Payment Account (Cash/Bank)
 * Mapping otomatis: CASH -> "Kas", BANK -> "Bank" (default)
 * Untuk BANK, bisa spesifik nama bank (misal: "Bank BCA", "Bank Mandiri")
 */
export async function findOrCreatePaymentCOA(
  gasStationId: string,
  paymentAccount: "CASH" | "BANK",
  createdById: string,
  bankName?: string // Optional: untuk multiple bank accounts (misal: "BCA", "Mandiri")
): Promise<{ id: string; name: string }> {
  let coaName: string;
  let description: string;

  if (paymentAccount === "CASH") {
    coaName = "Kas";
    description = "Kas operasional toko";
  } else {
    // BANK: jika ada bankName, gunakan "Bank {bankName}", jika tidak gunakan "Bank" default
    coaName = bankName ? `Bank ${bankName}` : "Bank";
    description = bankName
      ? `Rekening bank ${bankName}`
      : "Rekening bank (default - semua metode bank: QRIS, Transfer, Debit, Credit)";
  }

  const category: COACategory = "ASSET";

  const coa = await findOrCreateCOA({
    gasStationId,
    name: coaName,
    category,
    description,
    createdById,
  });

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Revenue (Pendapatan)
 */
export async function findOrCreateRevenueCOA(
  gasStationId: string,
  createdById: string,
  revenueName: string = "Pendapatan Penjualan"
): Promise<{ id: string; name: string }> {
  const coa = await findOrCreateCOA({
    gasStationId,
    name: revenueName,
    category: "REVENUE",
    description: "Pendapatan dari penjualan",
    createdById,
  });

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Liability (Hutang Coupon)
 */
export async function findOrCreateCouponLiabilityCOA(
  gasStationId: string,
  createdById: string
): Promise<{ id: string; name: string }> {
  const coa = await findOrCreateCOA({
    gasStationId,
    name: "Hutang Coupon",
    category: "LIABILITY",
    description: "Hutang coupon/voucher",
    createdById,
  });

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA Expense berdasarkan category
 */
export async function findOrCreateExpenseCOA(
  gasStationId: string,
  expenseCategory: string,
  createdById: string
): Promise<{ id: string; name: string }> {
  const coa = await findOrCreateCOA({
    gasStationId,
    name: expenseCategory,
    category: "EXPENSE",
    description: `Akun beban untuk kategori ${expenseCategory}`,
    createdById,
  });

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk membuat COA LO (Lifting Order) Produk
 * LO Produk adalah aset yang merepresentasikan persediaan dalam perjalanan
 * Dibuat saat input pembelian BBM (lazy creation)
 */
export async function findOrCreateLOProductCOA(
  gasStationId: string,
  productName: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  // Normalize productName: trim whitespace untuk konsistensi
  const normalizedProductName = productName.trim();
  const coaName = `LO ${normalizedProductName}`;
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: coaName,
      category: "ASSET",
      description: `Lifting Order ${normalizedProductName} - persediaan dalam perjalanan dari supplier ke SPBU`,
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * Helper untuk mendapatkan COA Pendapatan Penyesuaian Harga (REVENUE)
 * Digunakan untuk price adjustment saat harga beli berubah
 * Dengan backward compatibility: jika COA baru tidak ada, coba cari COA lama "Penyesuaian Stock" (ASSET)
 */
export async function findOrCreatePriceAdjustmentIncomeCOA(
  gasStationId: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const prismaClient = tx || prisma;
  
  // Coba cari COA baru dulu
  const newCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId,
        name: "Pendapatan Penyesuaian Harga",
      },
    },
  });

  if (newCOA && newCOA.status === "ACTIVE") {
    return { id: newCOA.id, name: newCOA.name };
  }

  // Backward compatibility: coba cari COA lama "Pendapatan Penyesuaian Persediaan"
  const oldCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId,
        name: "Pendapatan Penyesuaian Persediaan",
      },
    },
  });

  if (oldCOA && oldCOA.status === "ACTIVE") {
    return { id: oldCOA.id, name: oldCOA.name };
  }

  // Backward compatibility: coba cari COA lama "Penyesuaian Stock" (ASSET)
  const olderCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId,
        name: "Penyesuaian Stock",
      },
    },
  });

  if (olderCOA && olderCOA.status === "ACTIVE") {
    return { id: olderCOA.id, name: olderCOA.name };
  }

  // Jika tidak ada, buat COA baru
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: "Pendapatan Penyesuaian Harga",
      category: "REVENUE",
      description:
        "Pendapatan dari penyesuaian nilai persediaan akibat kenaikan harga beli produk",
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * @deprecated Use findOrCreatePriceAdjustmentIncomeCOA instead
 * Kept for backward compatibility
 */
export async function findOrCreateStockAdjustmentIncomeCOA(
  gasStationId: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  return findOrCreatePriceAdjustmentIncomeCOA(gasStationId, createdById, tx);
}

/**
 * Helper untuk mendapatkan COA Beban Penyesuaian Harga (EXPENSE)
 * Digunakan untuk price adjustment saat harga beli berubah
 * Renamed dari: Beban Penyesuaian Persediaan
 */
export async function findOrCreatePriceAdjustmentExpenseCOA(
  gasStationId: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  const prismaClient = tx || prisma;
  
  // Coba cari COA baru dulu
  const newCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId,
        name: "Beban Penyesuaian Harga",
      },
    },
  });

  if (newCOA && newCOA.status === "ACTIVE") {
    return { id: newCOA.id, name: newCOA.name };
  }

  // Backward compatibility: coba cari COA lama
  const oldCOA = await prismaClient.cOA.findUnique({
    where: {
      gasStationId_name: {
        gasStationId,
        name: "Beban Penyesuaian Persediaan",
      },
    },
  });

  if (oldCOA && oldCOA.status === "ACTIVE") {
    return { id: oldCOA.id, name: oldCOA.name };
  }

  // Jika tidak ada, buat COA baru
  const coa = await findOrCreateCOA(
    {
      gasStationId,
      name: "Beban Penyesuaian Harga",
      category: "EXPENSE",
      description:
        "Beban dari penyesuaian nilai persediaan akibat perubahan harga beli produk",
      createdById,
    },
    tx
  );

  return { id: coa.id, name: coa.name };
}

/**
 * @deprecated Use findOrCreatePriceAdjustmentExpenseCOA instead
 * Kept for backward compatibility
 */
export async function findOrCreateStockAdjustmentExpenseCOA(
  gasStationId: string,
  createdById: string,
  tx?: any
): Promise<{ id: string; name: string }> {
  return findOrCreatePriceAdjustmentExpenseCOA(gasStationId, createdById, tx);
}

/**
 * Membuat COA standard untuk gas station baru
 * Asset: Kas, Bank, Piutang Usaha, Piutang Karyawan
 * Liabilities: Hutang Usaha, Hutang Coupon, Hutang Pihak Ketiga, Kas Tambahan
 * Equity: Modal Awal, Laba Ditahan
 */
export async function createStandardCOAs(
  gasStationId: string,
  createdById: string,
  tx?: any // Transaction client (optional)
): Promise<void> {
  const standardCOAs = [
    // Asset
    {
      name: "Kas",
      category: "ASSET" as const,
      description: "Kas operasional gas station",
    },
    { name: "Bank", category: "ASSET" as const, description: "Rekening bank" },
    {
      name: "Piutang Usaha",
      category: "ASSET" as const,
      description: "Piutang dari pelanggan",
    },
    {
      name: "Piutang Karyawan",
      category: "ASSET" as const,
      description: "Piutang dari karyawan",
    },
    // Revenue
    {
      name: "Pendapatan Penyesuaian Harga",
      category: "REVENUE" as const,
      description:
        "Pendapatan dari penyesuaian nilai persediaan dan LO akibat kenaikan harga beli produk",
    },
    {
      name: "Pendapatan Lain-lain",
      category: "REVENUE" as const,
      description: "Pendapatan dari sumber lain selain penjualan produk",
    },

    // Expense
    {
      name: "Beban Penyesuaian Harga",
      category: "EXPENSE" as const,
      description:
        "Beban dari penyesuaian nilai persediaan dan LO akibat penurunan harga beli produk",
    },

    // Liabilities
    {
      name: "Hutang Usaha",
      category: "LIABILITY" as const,
      description: "Hutang kepada supplier",
    },
    {
      name: "Hutang Pihak Ketiga",
      category: "LIABILITY" as const,
      description: "Hutang kepada pihak ketiga",
    },

    // Equity
    {
      name: "Modal Awal",
      category: "EQUITY" as const,
      description: "Modal awal untuk operasional",
    },
    {
      name: "Laba Ditahan",
      category: "EQUITY" as const,
      description: "Akumulasi laba yang ditahan",
    },
    {
      name: "Realtime Profit/Loss",
      category: "EQUITY" as const,
      description: "Laba/rugi realtime dari operasional gas station",
    },

    // Expense
    {
      name: "Biaya Susut Perjalanan",
      category: "EXPENSE" as const,
      description: "Biaya susut BBM selama perjalanan dari supplier ke SPBU",
    },
  ];

  // Create all standard COAs
  await Promise.all(
    standardCOAs.map((coa) =>
      findOrCreateCOA(
        {
          gasStationId,
          name: coa.name,
          category: coa.category,
          description: coa.description,
          createdById,
        },
        tx
      )
    )
  );
}

/**
 * Membuat COA Titipan berdasarkan nama-nama yang diberikan
 * Hanya membuat COA yang belum ada (berdasarkan nama)
 * Format COA: "Titipan {nama}" dengan category LIABILITY
 */
export async function createTitipanCOAs(
  gasStationId: string,
  titipanNames: string[],
  createdById: string,
  tx?: any
): Promise<void> {
  const prismaClient = tx || prisma;

  // Filter empty strings
  const validNames = titipanNames.filter((name) => name.trim() !== "");

  if (validNames.length === 0) {
    return; // Tidak ada nama yang valid, skip
  }

  // Buat COA untuk setiap nama titipan
  await Promise.all(
    validNames.map(async (name) => {
      const coaName = `Titipan ${name.trim()}`;

      // Cek apakah COA sudah ada
      const existingCOA = await prismaClient.cOA.findFirst({
        where: {
          gasStationId,
          name: coaName,
          status: "ACTIVE",
        },
      });

      // Jika belum ada, buat baru
      if (!existingCOA) {
        await findOrCreateCOA(
          {
            gasStationId,
            name: coaName,
            category: "LIABILITY",
            description: `Titipan dari ${name.trim()}`,
            createdById,
          },
          tx
        );
      }
    })
  );
}