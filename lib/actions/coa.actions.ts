"use server";

type COACategory =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "COGS";

type COA = {
  id: string;
  name: string;
  category: COACategory;
  balance: number;
};

type GetCOAsWithBalanceResult = {
  success: boolean;
  message?: string;
  data?: COA[];
};

// Mock COA data untuk demo
const mockCOAs: Record<string, COA[]> = {
  "spbu-001": [
    // ASSETS
    {
      id: "coa-001",
      name: "Kas",
      category: "ASSET",
      balance: 50000000,
    },
    {
      id: "coa-002",
      name: "Bank",
      category: "ASSET",
      balance: 150000000,
    },
    {
      id: "coa-003",
      name: "Piutang Usaha",
      category: "ASSET",
      balance: 25000000,
    },
    {
      id: "coa-004",
      name: "Persediaan BBM",
      category: "ASSET",
      balance: 200000000,
    },
    {
      id: "coa-005",
      name: "Perlengkapan",
      category: "ASSET",
      balance: 5000000,
    },
    // LIABILITIES
    {
      id: "coa-006",
      name: "Hutang Usaha",
      category: "LIABILITY",
      balance: 75000000,
    },
    {
      id: "coa-007",
      name: "Hutang Bank",
      category: "LIABILITY",
      balance: 100000000,
    },
    {
      id: "coa-008",
      name: "Hutang Pajak",
      category: "LIABILITY",
      balance: 15000000,
    },
    // EQUITY
    {
      id: "coa-009",
      name: "Modal Awal",
      category: "EQUITY",
      balance: 500000000,
    },
    {
      id: "coa-010",
      name: "Laba Ditahan",
      category: "EQUITY",
      balance: 100000000,
    },
    {
      id: "coa-011",
      name: "Realtime Profit/Loss",
      category: "EQUITY",
      balance: 30000000, // Net income dari operasi
    },
    // REVENUE (tidak digunakan di balance sheet, tapi ada untuk completeness)
    {
      id: "coa-012",
      name: "Penjualan BBM",
      category: "REVENUE",
      balance: 0,
    },
    // EXPENSE (tidak digunakan di balance sheet)
    {
      id: "coa-013",
      name: "Beban Operasional",
      category: "EXPENSE",
      balance: 0,
    },
    {
      id: "coa-014",
      name: "Beban Administrasi",
      category: "EXPENSE",
      balance: 0,
    },
    // COGS (tidak digunakan di balance sheet)
    {
      id: "coa-015",
      name: "Harga Pokok Penjualan",
      category: "COGS",
      balance: 0,
    },
  ],
};

export async function getCOAsWithBalance(
  gasStationId: string
): Promise<GetCOAsWithBalanceResult> {
  try {
    // Simulasi delay untuk demo
    await new Promise((resolve) => setTimeout(resolve, 100));

    const coas = mockCOAs[gasStationId];

    if (!coas) {
      return {
        success: false,
        message: `Gas station dengan ID ${gasStationId} tidak ditemukan`,
      };
    }

    return {
      success: true,
      data: coas,
    };
  } catch (error) {
    console.error("Error fetching COAs:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mengambil data COA",
    };
  }
}
