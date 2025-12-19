/**
 * Tank Stock Calculation Utilities
 *
 * Centralized logic untuk perhitungan stock tank:
 * - Current stock (system)
 * - Daily reconciliation
 * - Variance calculation
 * - Loss estimation
 */

/**
 * Calculate current stock from approved unloads
 *
 * Formula: SUM(approved_unloads.literAmount)
 */
export function calculateCurrentStock(approvedUnloads: number[]): number {
  return approvedUnloads.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Calculate tank stock by calculation (daily)
 *
 * Formula: stockOpen + unloads - (sales + pumpTest)
 * Total OUT = sales + pumpTest (keduanya adalah liter yang keluar dari tank)
 */
export function calculateTankStockByCalculation(params: {
  stockOpen: number;
  unloads: number;
  sales: number;
  pumpTest?: number;
}): number {
  const { stockOpen, unloads, sales, pumpTest = 0 } = params;
  const totalOut = sales + pumpTest;
  return stockOpen + unloads - totalOut;
}

/**
 * Calculate variance open (susut overnight)
 *
 * Formula: stockOpenToday - (stockCloseYesterday OR tankStockYesterday)
 *
 * Priority: Use Close Yesterday if exists, otherwise use Tank Stock Yesterday
 *
 * Positive = Expansion (unexpected gain)
 * Negative = Loss (expected overnight evaporation)
 */
export function calculateVarianceOpen(params: {
  stockOpenToday: number | null;
  stockCloseYesterday: number | null;
  tankStockYesterday?: number | null;
}): number | null {
  const { stockOpenToday, stockCloseYesterday, tankStockYesterday } = params;

  // Cannot calculate if no Open reading today
  if (stockOpenToday === null) {
    return null;
  }

  // Priority 1: Compare with Close Yesterday
  if (stockCloseYesterday !== null) {
    return stockOpenToday - stockCloseYesterday;
  }

  // Priority 2: Compare with Tank Stock Yesterday (calculated)
  if (tankStockYesterday !== null && tankStockYesterday !== undefined) {
    return stockOpenToday - tankStockYesterday;
  }

  // No comparison data available (first day)
  return null;
}

/**
 * Calculate variance (selisih antara stock realtime dan tank reading)
 *
 * Formula: tankReading - stockRealtime
 *
 * Positive = Physical stock > System stock (unexpected gain)
 * Negative = Loss (Physical < System, likely theft/leakage/measurement error)
 */
export function calculateVariance(params: {
  tankReading: number | null;
  stockRealtime: number;
}): number | null {
  const { tankReading, stockRealtime } = params;

  if (tankReading === null) {
    return null;
  }

  return tankReading - stockRealtime;
}

/**
 * Calculate total variance for summary (monthly/period)
 *
 * Formula: Current Physical Stock - (Total Unload - Total Sales)
 *
 * This shows the cumulative variance over a period
 * Negative = Loss (Physical < System, likely theft/leakage)
 * Positive = Gain (Physical > System, measurement error/data entry issue)
 */
export function calculateTotalVarianceSummary(params: {
  totalUnload: number;
  totalSales: number;
  currentPhysicalStock: number;
}): number {
  const { totalUnload, totalSales, currentPhysicalStock } = params;

  // System Stock = Total Unload - Total Sales
  const systemStock = totalUnload - totalSales;

  // Variance = Physical Stock - System Stock
  // Negative = Loss (Physical < System)
  // Positive = Gain (Physical > System)
  return currentPhysicalStock - systemStock;
}

/**
 * Estimate loss (only if variance is negative)
 *
 * Loss = negative variance (stock hilang)
 * Returns positive number representing loss amount
 */
export function calculateEstimatedLoss(params: {
  varianceClose: number | null;
}): number | null {
  const { varianceClose } = params;

  if (varianceClose === null) {
    return null;
  }

  // Only count as loss if variance is negative
  return varianceClose < 0 ? Math.abs(varianceClose) : null;
}

/**
 * Calculate fill percentage
 *
 * Formula: (currentStock / capacity) * 100
 */
export function calculateFillPercentage(params: {
  currentStock: number;
  capacity: number;
}): number {
  const { currentStock, capacity } = params;

  if (capacity <= 0) {
    return 0;
  }

  return (currentStock / capacity) * 100;
}

/**
 * Check if tank is critically low
 *
 * Returns true if fill percentage is below threshold
 */
export function isTankCriticallyLow(params: {
  currentStock: number;
  capacity: number;
  threshold?: number;
}): boolean {
  const { currentStock, capacity, threshold = 20 } = params;

  const fillPercentage = calculateFillPercentage({ currentStock, capacity });
  return fillPercentage < threshold;
}

/**
 * Check if there's significant loss
 *
 * Returns true if loss exceeds threshold percentage of total stock
 */
export function hasSignificantLoss(params: {
  estimatedLoss: number | null;
  stockOpen: number;
  threshold?: number;
}): boolean {
  const { estimatedLoss, stockOpen, threshold = 5 } = params;

  if (estimatedLoss === null || stockOpen === 0) {
    return false;
  }

  const lossPercentage = (estimatedLoss / stockOpen) * 100;
  return lossPercentage >= threshold;
}

/**
 * Calculate daily reconciliation
 *
 * Simplified: hanya menghitung variance dari tank reading vs stock realtime
 * Variance hanya dihitung jika ada tank reading (setelah penutupan)
 * Returns complete daily report for a tank
 */
export function calculateDailyReconciliation(params: {
  tankStockYesterday: number | null;
  unloads: number;
  sales: number;
  pumpTest?: number;
  tankReading: number | null;
}) {
  const {
    tankStockYesterday,
    unloads,
    sales,
    pumpTest = 0,
    tankReading,
  } = params;

  // Stock realtime = stock kemarin + unloads - (sales + pumpTest)
  const baseStock = tankStockYesterday || 0;
  const stockRealtime = calculateTankStockByCalculation({
    stockOpen: baseStock,
    unloads,
    sales,
    pumpTest,
  });

  // Variance hanya dihitung jika ada tank reading
  // Tank reading dilakukan setelah penutupan, jadi variance = tankReading - stockRealtime
  // Variance menunjukkan selisih antara fisik (tank reading) dengan sistem (stock realtime)
  const variance = tankReading !== null
    ? tankReading - stockRealtime
    : null;

  // Total variance = variance (hanya jika ada tank reading)
  const totalVariance = variance;

  // Estimated loss = negative variance (loss)
  const estimatedLoss = variance !== null && variance < 0 ? Math.abs(variance) : null;

  return {
    tankStockCalculation: stockRealtime,
    variance,
    totalVariance,
    estimatedLoss,
    hasLoss: estimatedLoss !== null && estimatedLoss > 0,
  };
}

/**
 * Type definitions for type safety
 */
export type TankReconciliation = ReturnType<
  typeof calculateDailyReconciliation
>;

/**
 * Calculate sales volume from a pair of OPEN and CLOSE readings
 *
 * Formula: Close Reading - Open Reading - Pump Test
 *
 * @param openReading - Totalisator value (cumulative meter reading) at shift start
 * @param closeReading - Totalisator value (cumulative meter reading) at shift end
 * @param pumpTest - Volume used for pump testing (optional)
 * @returns Sales volume in liters (non-negative)
 */
export function calculateSalesFromReadings(params: {
  openReading: number;
  closeReading: number;
  pumpTest?: number;
}): number {
  const { openReading, closeReading, pumpTest = 0 } = params;

  const saleVolume = closeReading - openReading - pumpTest;

  // Ensure non-negative (handle edge cases like counter reset)
  return Math.max(0, saleVolume);
}

/**
 * Calculate total sales from multiple nozzle readings grouped by shift
 *
 * Groups readings by nozzle, matches OPEN-CLOSE pairs, and calculates sales
 *
 * @param readings - Array of nozzle readings with type (OPEN/CLOSE)
 * @returns Total sales volume in liters
 */
export function calculateSalesFromNozzleReadings(
  readings: Array<{
    nozzleId: string;
    readingType: "OPEN" | "CLOSE";
    literValue: number; // Totalisator reading from NozzleReading.totalizerReading
    pumpTest?: number;
  }>
): number {
  // Group readings by nozzle
  const readingsByNozzle = readings.reduce((acc, reading) => {
    if (!acc[reading.nozzleId]) {
      acc[reading.nozzleId] = { open: null, close: null };
    }
    if (reading.readingType === "OPEN") {
      acc[reading.nozzleId].open = reading;
    } else if (reading.readingType === "CLOSE") {
      acc[reading.nozzleId].close = reading;
    }
    return acc;
  }, {} as Record<string, { open: any; close: any }>);

  // Calculate sales for each nozzle
  let totalSales = 0;
  for (const nozzleId in readingsByNozzle) {
    const { open, close } = readingsByNozzle[nozzleId];
    if (open && close) {
      const sales = calculateSalesFromReadings({
        openReading: Number(open.literValue),
        closeReading: Number(close.literValue),
        pumpTest: Number(close.pumpTest || 0),
      });
      totalSales += sales;
    }
  }

  return totalSales;
}

/**
 * Calculate total pump test volume from multiple nozzle readings grouped by shift
 *
 * Groups readings by nozzle, matches OPEN-CLOSE pairs, and sums pump test
 *
 * @param readings - Array of nozzle readings with type (OPEN/CLOSE)
 * @returns Total pump test volume in liters
 */
export function calculatePumpTestFromNozzleReadings(
  readings: Array<{
    nozzleId: string;
    readingType: "OPEN" | "CLOSE";
    pumpTest?: number;
  }>
): number {
  // Group readings by nozzle
  const readingsByNozzle = readings.reduce((acc, reading) => {
    if (!acc[reading.nozzleId]) {
      acc[reading.nozzleId] = { open: null, close: null };
    }
    if (reading.readingType === "OPEN") {
      acc[reading.nozzleId].open = reading;
    } else if (reading.readingType === "CLOSE") {
      acc[reading.nozzleId].close = reading;
    }
    return acc;
  }, {} as Record<string, { open: any; close: any }>);

  // Sum pump test for each nozzle (only from CLOSE readings)
  let totalPumpTest = 0;
  for (const nozzleId in readingsByNozzle) {
    const { open, close } = readingsByNozzle[nozzleId];
    if (open && close) {
      totalPumpTest += Number(close.pumpTest || 0);
    }
  }

  return totalPumpTest;
}