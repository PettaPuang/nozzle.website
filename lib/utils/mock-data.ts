// Mock data - inline untuk demo experience
const gasStationsData = [
  {
    id: "spbu-001",
    name: "SPBU Pertamina 34-12345",
    address: "Jl. Sudirman No. 123, Jakarta Pusat",
    latitude: -6.2088,
    longitude: 106.8456,
    openTime: "06:00",
    closeTime: "22:00",
    status: "ACTIVE",
    owner: {
      id: "owner-001",
      name: "PT. Energi Nusantara",
    },
  },
  {
    id: "spbu-002",
    name: "SPBU Pertamina 34-12346",
    address: "Jl. Gatot Subroto No. 456, Jakarta Selatan",
    latitude: -6.2297,
    longitude: 106.8003,
    openTime: "05:00",
    closeTime: "23:00",
    status: "ACTIVE",
    owner: {
      id: "owner-001",
      name: "PT. Energi Nusantara",
    },
  },
  {
    id: "spbu-003",
    name: "SPBU Pertamina 34-12347",
    address: "Jl. Thamrin No. 789, Jakarta Pusat",
    latitude: -6.1944,
    longitude: 106.8229,
    openTime: "06:00",
    closeTime: "22:00",
    status: "INACTIVE",
    owner: {
      id: "owner-002",
      name: "CV. Bumi Sejahtera",
    },
  },
];

const productsData = [
  {
    id: "product-001",
    gasStationId: "spbu-001",
    name: "Pertalite",
    ron: "90",
    purchasePrice: 8500,
    sellingPrice: 10000,
  },
  {
    id: "product-002",
    gasStationId: "spbu-001",
    name: "Pertamax",
    ron: "92",
    purchasePrice: 10500,
    sellingPrice: 12000,
  },
  {
    id: "product-003",
    gasStationId: "spbu-001",
    name: "Pertamax Turbo",
    ron: "95",
    purchasePrice: 12500,
    sellingPrice: 14000,
  },
  {
    id: "product-004",
    gasStationId: "spbu-001",
    name: "Solar",
    ron: null,
    purchasePrice: 8000,
    sellingPrice: 9500,
  },
];

const tanksData = [
  {
    id: "tank-001",
    gasStationId: "spbu-001",
    productId: "product-001",
    code: "T01",
    name: "Tank Pertalite 1",
    capacity: 30000,
    initialStock: 15000,
    currentStock: 12500,
    product: {
      name: "Pertalite",
      sellingPrice: 10000,
    },
  },
  {
    id: "tank-002",
    gasStationId: "spbu-001",
    productId: "product-002",
    code: "T02",
    name: "Tank Pertamax 1",
    capacity: 30000,
    initialStock: 12000,
    currentStock: 9800,
    product: {
      name: "Pertamax",
      sellingPrice: 12000,
    },
  },
  {
    id: "tank-003",
    gasStationId: "spbu-001",
    productId: "product-003",
    code: "T03",
    name: "Tank Pertamax Turbo",
    capacity: 20000,
    initialStock: 8000,
    currentStock: 6500,
    product: {
      name: "Pertamax Turbo",
      sellingPrice: 14000,
    },
  },
  {
    id: "tank-004",
    gasStationId: "spbu-001",
    productId: "product-004",
    code: "T04",
    name: "Tank Solar",
    capacity: 25000,
    initialStock: 10000,
    currentStock: 8500,
    product: {
      name: "Solar",
      sellingPrice: 9500,
    },
  },
];

const stationsData = [
  {
    id: "station-001",
    gasStationId: "spbu-001",
    code: "S01",
    name: "Station 1",
    tanks: ["tank-001", "tank-002"],
  },
  {
    id: "station-002",
    gasStationId: "spbu-001",
    code: "S02",
    name: "Station 2",
    tanks: ["tank-003", "tank-004"],
  },
];

const nozzlesData = [
  {
    id: "nozzle-001",
    stationId: "station-001",
    tankId: "tank-001",
    productId: "product-001",
    code: "N01",
    name: "Nozzle 1 - Pertalite",
    product: {
      name: "Pertalite",
      sellingPrice: 10000,
    },
  },
  {
    id: "nozzle-002",
    stationId: "station-001",
    tankId: "tank-002",
    productId: "product-002",
    code: "N02",
    name: "Nozzle 2 - Pertamax",
    product: {
      name: "Pertamax",
      sellingPrice: 12000,
    },
  },
  {
    id: "nozzle-003",
    stationId: "station-002",
    tankId: "tank-003",
    productId: "product-003",
    code: "N03",
    name: "Nozzle 3 - Pertamax Turbo",
    product: {
      name: "Pertamax Turbo",
      sellingPrice: 14000,
    },
  },
  {
    id: "nozzle-004",
    stationId: "station-002",
    tankId: "tank-004",
    productId: "product-004",
    code: "N04",
    name: "Nozzle 4 - Solar",
    product: {
      name: "Solar",
      sellingPrice: 9500,
    },
  },
];

const salesReportData = {
  gasStationId: "spbu-001",
  period: "2024-01",
  summary: {
    totalSales: 125000000,
    totalVolume: 12500,
    totalTransactions: 850,
  },
  byProduct: [
    {
      productId: "product-001",
      productName: "Pertalite",
      volume: 5000,
      revenue: 50000000,
      transactions: 350,
    },
    {
      productId: "product-002",
      productName: "Pertamax",
      volume: 4000,
      revenue: 48000000,
      transactions: 280,
    },
    {
      productId: "product-003",
      productName: "Pertamax Turbo",
      volume: 2000,
      revenue: 28000000,
      transactions: 150,
    },
    {
      productId: "product-004",
      productName: "Solar",
      volume: 1500,
      revenue: 14250000,
      transactions: 70,
    },
  ],
  dailySales: [
    {
      date: "2024-01-01",
      volume: 420,
      revenue: 4200000,
      transactions: 28,
    },
    {
      date: "2024-01-02",
      volume: 450,
      revenue: 4500000,
      transactions: 30,
    },
    {
      date: "2024-01-03",
      volume: 480,
      revenue: 4800000,
      transactions: 32,
    },
    {
      date: "2024-01-04",
      volume: 400,
      revenue: 4000000,
      transactions: 27,
    },
    {
      date: "2024-01-05",
      volume: 520,
      revenue: 5200000,
      transactions: 35,
    },
  ],
};

const stockReportData = {
  gasStationId: "spbu-001",
  date: "2024-01-31",
  tanks: [
    {
      tankId: "tank-001",
      tankCode: "T01",
      tankName: "Tank Pertalite 1",
      productName: "Pertalite",
      capacity: 30000,
      currentStock: 12500,
      stockPercentage: 41.67,
      status: "NORMAL",
    },
    {
      tankId: "tank-002",
      tankCode: "T02",
      tankName: "Tank Pertamax 1",
      productName: "Pertamax",
      capacity: 30000,
      currentStock: 9800,
      stockPercentage: 32.67,
      status: "LOW",
    },
    {
      tankId: "tank-003",
      tankCode: "T03",
      tankName: "Tank Pertamax Turbo",
      productName: "Pertamax Turbo",
      capacity: 20000,
      currentStock: 6500,
      stockPercentage: 32.5,
      status: "LOW",
    },
    {
      tankId: "tank-004",
      tankCode: "T04",
      tankName: "Tank Solar",
      productName: "Solar",
      capacity: 25000,
      currentStock: 8500,
      stockPercentage: 34.0,
      status: "LOW",
    },
  ],
  summary: {
    totalCapacity: 105000,
    totalStock: 37300,
    totalStockPercentage: 35.52,
    lowStockCount: 3,
  },
};

const financialReportData = {
  gasStationId: "spbu-001",
  period: "2024-01",
  income: {
    totalRevenue: 125000000,
    salesRevenue: 125000000,
    otherIncome: 0,
  },
  expenses: {
    totalExpenses: 95000000,
    costOfGoodsSold: 85000000,
    operationalExpenses: 8000000,
    administrativeExpenses: 2000000,
  },
  profitLoss: {
    grossProfit: 40000000,
    operatingProfit: 32000000,
    netProfit: 30000000,
  },
  breakdown: {
    revenue: [
      {
        category: "Pertalite Sales",
        amount: 50000000,
      },
      {
        category: "Pertamax Sales",
        amount: 48000000,
      },
      {
        category: "Pertamax Turbo Sales",
        amount: 28000000,
      },
      {
        category: "Solar Sales",
        amount: 14250000,
      },
    ],
    expenses: [
      {
        category: "Purchase Cost",
        amount: 85000000,
      },
      {
        category: "Employee Salary",
        amount: 5000000,
      },
      {
        category: "Utilities",
        amount: 2000000,
      },
      {
        category: "Maintenance",
        amount: 1000000,
      },
      {
        category: "Administrative",
        amount: 2000000,
      },
    ],
  },
};

const incomeReportData = {
  gasStationId: "spbu-001",
  period: "2024-01",
  totalRevenue: 125000000,
  byProduct: [
    {
      productId: "product-001",
      productName: "Pertalite",
      revenue: 50000000,
      volume: 5000,
      averagePrice: 10000,
    },
    {
      productId: "product-002",
      productName: "Pertamax",
      revenue: 48000000,
      volume: 4000,
      averagePrice: 12000,
    },
    {
      productId: "product-003",
      productName: "Pertamax Turbo",
      revenue: 28000000,
      volume: 2000,
      averagePrice: 14000,
    },
    {
      productId: "product-004",
      productName: "Solar",
      revenue: 14250000,
      volume: 1500,
      averagePrice: 9500,
    },
  ],
  dailyRevenue: [
    {
      date: "2024-01-01",
      revenue: 4200000,
    },
    {
      date: "2024-01-02",
      revenue: 4500000,
    },
    {
      date: "2024-01-03",
      revenue: 4800000,
    },
    {
      date: "2024-01-04",
      revenue: 4000000,
    },
    {
      date: "2024-01-05",
      revenue: 5200000,
    },
  ],
};

export type MockGasStation = (typeof gasStationsData)[number];
export type MockProduct = (typeof productsData)[number];
export type MockTank = (typeof tanksData)[number];
export type MockStation = (typeof stationsData)[number];
export type MockNozzle = (typeof nozzlesData)[number];
export type MockSalesReport = typeof salesReportData;
export type MockStockReport = typeof stockReportData;
export type MockFinancialReport = typeof financialReportData;
export type MockIncomeReport = typeof incomeReportData;

export class MockDataService {
  static getGasStations(): MockGasStation[] {
    return gasStationsData;
  }

  static getGasStationById(id: string): MockGasStation | undefined {
    return gasStationsData.find((gs: MockGasStation) => gs.id === id);
  }

  static getProducts(gasStationId?: string): MockProduct[] {
    if (!gasStationId) return productsData;
    return productsData.filter(
      (p: MockProduct) => p.gasStationId === gasStationId
    );
  }

  static getTanks(gasStationId?: string): MockTank[] {
    if (!gasStationId) return tanksData;
    return tanksData.filter((t: MockTank) => t.gasStationId === gasStationId);
  }

  static getStations(gasStationId?: string): MockStation[] {
    if (!gasStationId) return stationsData;
    return stationsData.filter(
      (s: MockStation) => s.gasStationId === gasStationId
    );
  }

  static getNozzles(gasStationId?: string): MockNozzle[] {
    if (!gasStationId) {
      // Get nozzles by filtering through stations
      const stationIds = stationsData
        .filter(
          (s: MockStation) => !gasStationId || s.gasStationId === gasStationId
        )
        .map((s: MockStation) => s.id);
      return nozzlesData.filter((n: MockNozzle) =>
        stationIds.includes(n.stationId)
      );
    }
    const stationIds = stationsData
      .filter((s: MockStation) => s.gasStationId === gasStationId)
      .map((s: MockStation) => s.id);
    return nozzlesData.filter((n: MockNozzle) =>
      stationIds.includes(n.stationId)
    );
  }

  static getSalesReport(gasStationId: string): MockSalesReport | null {
    if (salesReportData.gasStationId === gasStationId) {
      return salesReportData;
    }
    return null;
  }

  static getStockReport(gasStationId: string): MockStockReport | null {
    if (stockReportData.gasStationId === gasStationId) {
      return stockReportData;
    }
    return null;
  }

  static getFinancialReport(gasStationId: string): MockFinancialReport | null {
    if (financialReportData.gasStationId === gasStationId) {
      return financialReportData;
    }
    return null;
  }

  static getIncomeReport(gasStationId: string): MockIncomeReport | null {
    if (incomeReportData.gasStationId === gasStationId) {
      return incomeReportData;
    }
    return null;
  }
}
