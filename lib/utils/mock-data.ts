// Mock data - inline untuk demo experience
const gasStationsData = [
  {
    id: "spbu-001",
    name: "SPBU 34-12345 Makassar",
    address: "Jl. Gatot Subroto, Makassar, Sulawesi Selatan",
    latitude: -5.135399,
    longitude: 119.42379,
    openTime: "06:00",
    closeTime: "22:00",
    status: "ACTIVE",
    owner: {
      id: "owner-001",
      name: "ownerdemo",
    },
  },
  {
    id: "spbu-002",
    name: "SPBU 34-12346 Surabaya",
    address: "Jl. Jemursari, Surabaya, Jawa Timur",
    latitude: -7.257472,
    longitude: 112.75209,
    openTime: "05:00",
    closeTime: "23:00",
    status: "ACTIVE",
    owner: {
      id: "owner-001",
      name: "ownerdemo",
    },
  },
  {
    id: "spbu-003",
    name: "SPBU 34-12347 Jakarta",
    address: "Jl. MT Haryono, Jakarta Selatan",
    latitude: -6.208763,
    longitude: 106.845599,
    openTime: "06:00",
    closeTime: "22:00",
    status: "INACTIVE",
    owner: {
      id: "owner-001",
      name: "ownerdemo",
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
  {
    id: "product-005",
    gasStationId: "spbu-001",
    name: "Dexlite",
    ron: "88",
    purchasePrice: 7500,
    sellingPrice: 9000,
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
    currentStock: 2347, // Hampir habis
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
    currentStock: 9876, // Angka keriting
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
    currentStock: 6543, // Angka keriting
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
    currentStock: 23456, // Hampir penuh
    product: {
      name: "Solar",
      sellingPrice: 9500,
    },
  },
  {
    id: "tank-005",
    gasStationId: "spbu-001",
    productId: "product-001",
    code: "T05",
    name: "Tank Pertalite 2",
    capacity: 30000,
    initialStock: 15000,
    currentStock: 15234, // Angka keriting
    product: {
      name: "Pertalite",
      sellingPrice: 10000,
    },
  },
  {
    id: "tank-006",
    gasStationId: "spbu-001",
    productId: "product-005",
    code: "T06",
    name: "Tank Dexlite",
    capacity: 30000,
    initialStock: 12000,
    currentStock: 11234, // Angka keriting
    product: {
      name: "Dexlite",
      sellingPrice: 9000,
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
    tanks: ["tank-002", "tank-003"],
  },
  {
    id: "station-003",
    gasStationId: "spbu-001",
    code: "S03",
    name: "Station 3",
    tanks: ["tank-004", "tank-006"],
  },
];

const nozzlesData = [
  // Station 1: 2 nozzle pertalite, 1 nozzle pertamax
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
    tankId: "tank-001",
    productId: "product-001",
    code: "N02",
    name: "Nozzle 2 - Pertalite",
    product: {
      name: "Pertalite",
      sellingPrice: 10000,
    },
  },
  {
    id: "nozzle-003",
    stationId: "station-001",
    tankId: "tank-002",
    productId: "product-002",
    code: "N03",
    name: "Nozzle 3 - Pertamax",
    product: {
      name: "Pertamax",
      sellingPrice: 12000,
    },
  },
  // Station 2: 1 pertamax, 1 pertamax turbo
  {
    id: "nozzle-004",
    stationId: "station-002",
    tankId: "tank-002",
    productId: "product-002",
    code: "N04",
    name: "Nozzle 4 - Pertamax",
    product: {
      name: "Pertamax",
      sellingPrice: 12000,
    },
  },
  {
    id: "nozzle-005",
    stationId: "station-002",
    tankId: "tank-003",
    productId: "product-003",
    code: "N05",
    name: "Nozzle 5 - Pertamax Turbo",
    product: {
      name: "Pertamax Turbo",
      sellingPrice: 14000,
    },
  },
  // Station 3: 2 bisosolar, 1 dexlite
  {
    id: "nozzle-006",
    stationId: "station-003",
    tankId: "tank-004",
    productId: "product-004",
    code: "N06",
    name: "Nozzle 6 - Bisosolar",
    product: {
      name: "Solar",
      sellingPrice: 9500,
    },
  },
  {
    id: "nozzle-007",
    stationId: "station-003",
    tankId: "tank-004",
    productId: "product-004",
    code: "N07",
    name: "Nozzle 7 - Bisosolar",
    product: {
      name: "Solar",
      sellingPrice: 9500,
    },
  },
  {
    id: "nozzle-008",
    stationId: "station-003",
    tankId: "tank-006",
    productId: "product-005",
    code: "N08",
    name: "Nozzle 8 - Dexlite",
    product: {
      name: "Dexlite",
      sellingPrice: 9000,
    },
  },
];

const operatorsData = [
  {
    id: "operator-001",
    name: "Budi",
    avatar: "/avatars/operator-01.svg",
  },
  {
    id: "operator-002",
    name: "Siti",
    avatar: "/avatars/operator-02.svg",
  },
  {
    id: "operator-003",
    name: "Joko",
    avatar: "/avatars/operator-03.svg",
  },
  {
    id: "operator-004",
    name: "Wahyu",
    avatar: "/avatars/operator-01.svg",
  },
];

const shiftsData = [
  // Station 1 - History shifts (tidak active)
  {
    id: "shift-001",
    stationId: "station-001",
    operatorId: "operator-001",
    shift: "PAGI",
    startTime: "2024-01-15T06:00:00",
    endTime: "2024-01-15T14:00:00",
    status: "COMPLETED",
    hasOpenReading: true,
    hasCloseReading: true,
    operator: {
      name: "Budi",
      avatar: "/avatars/operator-01.svg",
    },
  },
  {
    id: "shift-003",
    stationId: "station-001",
    operatorId: "operator-003",
    shift: "SIANG",
    startTime: "2024-01-15T14:00:00",
    endTime: "2024-01-15T22:00:00",
    status: "COMPLETED",
    hasOpenReading: true,
    hasCloseReading: true,
    operator: {
      name: "Joko",
      avatar: "/avatars/operator-03.svg",
    },
  },
  // Station 2 - Active shift
  {
    id: "shift-002",
    stationId: "station-002",
    operatorId: "operator-002",
    shift: "SIANG",
    startTime: "2024-01-15T14:00:00",
    status: "ACTIVE",
    hasOpenReading: true,
    hasCloseReading: false,
    operator: {
      name: "Siti",
      avatar: "/avatars/operator-02.svg",
    },
  },
  // Station 3 - Active shift
  {
    id: "shift-004",
    stationId: "station-003",
    operatorId: "operator-004",
    shift: "SIANG",
    startTime: "2024-01-15T14:00:00",
    status: "ACTIVE",
    hasOpenReading: true,
    hasCloseReading: false,
    operator: {
      name: "Wahyu",
      avatar: "/avatars/operator-01.svg",
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
    {
      productId: "product-005",
      productName: "Dexlite",
      volume: 1000,
      revenue: 9000000,
      transactions: 50,
    },
  ],
  dailySales: [
    {
      date: "2024-01-01",
      volume: 420,
      revenue: 4200000,
      transactions: 28,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 200 },
        { productId: "product-002", productName: "Pertamax", volume: 144 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 56 },
        { productId: "product-004", productName: "Solar", volume: 20 },
        { productId: "product-005", productName: "Dexlite", volume: 15 },
      ],
    },
    {
      date: "2024-01-02",
      volume: 450,
      revenue: 4500000,
      transactions: 30,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 250 },
        { productId: "product-002", productName: "Pertamax", volume: 160 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 72 },
        { productId: "product-004", productName: "Solar", volume: 24 },
        { productId: "product-005", productName: "Dexlite", volume: 18 },
      ],
    },
    {
      date: "2024-01-03",
      volume: 480,
      revenue: 4800000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 275 },
        { productId: "product-002", productName: "Pertamax", volume: 176 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 80 },
        { productId: "product-004", productName: "Solar", volume: 27 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-04",
      volume: 400,
      revenue: 4000000,
      transactions: 27,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 225 },
        { productId: "product-002", productName: "Pertamax", volume: 152 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 68 },
        { productId: "product-004", productName: "Solar", volume: 21 },
        { productId: "product-005", productName: "Dexlite", volume: 17 },
      ],
    },
    {
      date: "2024-01-05",
      volume: 520,
      revenue: 5200000,
      transactions: 35,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 300 },
        { productId: "product-002", productName: "Pertamax", volume: 168 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 88 },
        { productId: "product-004", productName: "Solar", volume: 30 },
        { productId: "product-005", productName: "Dexlite", volume: 22 },
      ],
    },
    {
      date: "2024-01-06",
      volume: 480,
      revenue: 4800000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 280 },
        { productId: "product-002", productName: "Pertamax", volume: 160 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 80 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-07",
      volume: 510,
      revenue: 5100000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 290 },
        { productId: "product-002", productName: "Pertamax", volume: 164 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 84 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-08",
      volume: 440,
      revenue: 4400000,
      transactions: 29,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 260 },
        { productId: "product-002", productName: "Pertamax", volume: 148 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 72 },
        { productId: "product-004", productName: "Solar", volume: 26 },
        { productId: "product-005", productName: "Dexlite", volume: 19 },
      ],
    },
    {
      date: "2024-01-09",
      volume: 490,
      revenue: 4900000,
      transactions: 33,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 285 },
        { productId: "product-002", productName: "Pertamax", volume: 162 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 82 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-10",
      volume: 530,
      revenue: 5300000,
      transactions: 36,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 310 },
        { productId: "product-002", productName: "Pertamax", volume: 170 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 90 },
        { productId: "product-004", productName: "Solar", volume: 31 },
        { productId: "product-005", productName: "Dexlite", volume: 23 },
      ],
    },
    {
      date: "2024-01-11",
      volume: 460,
      revenue: 4600000,
      transactions: 31,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 270 },
        { productId: "product-002", productName: "Pertamax", volume: 154 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 74 },
        { productId: "product-004", productName: "Solar", volume: 27 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-12",
      volume: 500,
      revenue: 5000000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 295 },
        { productId: "product-002", productName: "Pertamax", volume: 166 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 86 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-13",
      volume: 470,
      revenue: 4700000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 275 },
        { productId: "product-002", productName: "Pertamax", volume: 158 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 78 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-14",
      volume: 540,
      revenue: 5400000,
      transactions: 37,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 315 },
        { productId: "product-002", productName: "Pertamax", volume: 172 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 92 },
        { productId: "product-004", productName: "Solar", volume: 32 },
        { productId: "product-005", productName: "Dexlite", volume: 24 },
      ],
    },
    {
      date: "2024-01-15",
      volume: 450,
      revenue: 4500000,
      transactions: 30,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 265 },
        { productId: "product-002", productName: "Pertamax", volume: 150 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 70 },
        { productId: "product-004", productName: "Solar", volume: 26 },
        { productId: "product-005", productName: "Dexlite", volume: 19 },
      ],
    },
    {
      date: "2024-01-16",
      volume: 490,
      revenue: 4900000,
      transactions: 33,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 285 },
        { productId: "product-002", productName: "Pertamax", volume: 162 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 82 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-17",
      volume: 510,
      revenue: 5100000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 295 },
        { productId: "product-002", productName: "Pertamax", volume: 166 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 86 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-18",
      volume: 480,
      revenue: 4800000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 280 },
        { productId: "product-002", productName: "Pertamax", volume: 160 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 80 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-19",
      volume: 520,
      revenue: 5200000,
      transactions: 35,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 300 },
        { productId: "product-002", productName: "Pertamax", volume: 168 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 88 },
        { productId: "product-004", productName: "Solar", volume: 30 },
        { productId: "product-005", productName: "Dexlite", volume: 22 },
      ],
    },
    {
      date: "2024-01-20",
      volume: 500,
      revenue: 5000000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 290 },
        { productId: "product-002", productName: "Pertamax", volume: 164 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 84 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-21",
      volume: 470,
      revenue: 4700000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 275 },
        { productId: "product-002", productName: "Pertamax", volume: 158 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 78 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-22",
      volume: 530,
      revenue: 5300000,
      transactions: 36,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 310 },
        { productId: "product-002", productName: "Pertamax", volume: 170 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 90 },
        { productId: "product-004", productName: "Solar", volume: 31 },
        { productId: "product-005", productName: "Dexlite", volume: 23 },
      ],
    },
    {
      date: "2024-01-23",
      volume: 460,
      revenue: 4600000,
      transactions: 31,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 270 },
        { productId: "product-002", productName: "Pertamax", volume: 154 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 74 },
        { productId: "product-004", productName: "Solar", volume: 27 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-24",
      volume: 490,
      revenue: 4900000,
      transactions: 33,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 285 },
        { productId: "product-002", productName: "Pertamax", volume: 162 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 82 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-25",
      volume: 510,
      revenue: 5100000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 295 },
        { productId: "product-002", productName: "Pertamax", volume: 166 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 86 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-26",
      volume: 480,
      revenue: 4800000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 280 },
        { productId: "product-002", productName: "Pertamax", volume: 160 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 80 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-27",
      volume: 540,
      revenue: 5400000,
      transactions: 37,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 315 },
        { productId: "product-002", productName: "Pertamax", volume: 172 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 92 },
        { productId: "product-004", productName: "Solar", volume: 32 },
        { productId: "product-005", productName: "Dexlite", volume: 24 },
      ],
    },
    {
      date: "2024-01-28",
      volume: 500,
      revenue: 5000000,
      transactions: 34,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 290 },
        { productId: "product-002", productName: "Pertamax", volume: 164 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 84 },
        { productId: "product-004", productName: "Solar", volume: 29 },
        { productId: "product-005", productName: "Dexlite", volume: 21 },
      ],
    },
    {
      date: "2024-01-29",
      volume: 470,
      revenue: 4700000,
      transactions: 32,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 275 },
        { productId: "product-002", productName: "Pertamax", volume: 158 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 78 },
        { productId: "product-004", productName: "Solar", volume: 28 },
        { productId: "product-005", productName: "Dexlite", volume: 20 },
      ],
    },
    {
      date: "2024-01-30",
      volume: 520,
      revenue: 5200000,
      transactions: 35,
      byProduct: [
        { productId: "product-001", productName: "Pertalite", volume: 300 },
        { productId: "product-002", productName: "Pertamax", volume: 168 },
        { productId: "product-003", productName: "Pertamax Turbo", volume: 88 },
        { productId: "product-004", productName: "Solar", volume: 30 },
        { productId: "product-005", productName: "Dexlite", volume: 22 },
      ],
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
      currentStock: 2347,
      stockPercentage: 7.82,
      status: "CRITICAL",
    },
    {
      tankId: "tank-002",
      tankCode: "T02",
      tankName: "Tank Pertamax 1",
      productName: "Pertamax",
      capacity: 30000,
      currentStock: 9876,
      stockPercentage: 32.92,
      status: "LOW",
    },
    {
      tankId: "tank-003",
      tankCode: "T03",
      tankName: "Tank Pertamax Turbo",
      productName: "Pertamax Turbo",
      capacity: 20000,
      currentStock: 6543,
      stockPercentage: 32.72,
      status: "LOW",
    },
    {
      tankId: "tank-004",
      tankCode: "T04",
      tankName: "Tank Solar",
      productName: "Solar",
      capacity: 25000,
      currentStock: 23456,
      stockPercentage: 93.82,
      status: "NORMAL",
    },
  ],
  summary: {
    totalCapacity: 105000,
    totalStock: 42222,
    totalStockPercentage: 40.21,
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
export type MockOperator = (typeof operatorsData)[number];
export type MockShift = (typeof shiftsData)[number];
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

  static getOperators(): MockOperator[] {
    return operatorsData;
  }

  static getOperatorById(id: string): MockOperator | undefined {
    return operatorsData.find((op: MockOperator) => op.id === id);
  }

  static getActiveShiftByStationId(
    stationId: string
  ): (Omit<MockShift, "startTime"> & { startTime: Date }) | null {
    const shift = shiftsData.find(
      (s: MockShift) => s.stationId === stationId && s.status === "ACTIVE"
    );
    if (!shift) return null;
    return {
      ...shift,
      startTime: new Date(shift.startTime),
    };
  }

  static getShiftsByStationId(stationId: string): MockShift[] {
    return shiftsData.filter((s: MockShift) => s.stationId === stationId);
  }

  static getTodayShiftsByStationId(stationId: string): (Omit<
    MockShift,
    "startTime" | "endTime"
  > & {
    startTime: Date;
    endTime?: Date;
  })[] {
    // For preview: get all shifts for the station (not just today)
    // This ensures history shifts are always visible in preview
    const shifts = shiftsData.filter(
      (s: MockShift) => s.stationId === stationId
    );
    return shifts.map((shift) => ({
      ...shift,
      startTime: new Date(shift.startTime),
      endTime: shift.endTime ? new Date(shift.endTime) : undefined,
    }));
  }

  static getChartData(gasStationId: string): Array<{
    date: string;
    [productKey: string]: number | string;
  }> {
    const salesReport = this.getSalesReport(gasStationId);
    if (!salesReport) return [];

    return salesReport.dailySales.map((daily) => {
      const chartData: {
        date: string;
        [productKey: string]: number | string;
      } = {
        date: daily.date,
      };

      // Add volume per product from dailySales.byProduct if available
      // Transform product name to match chart key format: lowercase, remove spaces, and add _volume suffix
      if (daily.byProduct && Array.isArray(daily.byProduct)) {
        daily.byProduct.forEach((product) => {
          const productKey =
            product.productName.toLowerCase().replace(/\s+/g, "") + "_volume";
          chartData[productKey] = product.volume;
        });
      } else {
        // Fallback: distribute volume evenly if byProduct not available
        salesReport.byProduct.forEach((product) => {
          const baseVolume = product.volume / salesReport.dailySales.length;
          const productKey =
            product.productName.toLowerCase().replace(/\s+/g, "") + "_volume";
          chartData[productKey] = Math.round(baseVolume);
        });
      }

      return chartData;
    });
  }
}
