// ============================================
// NUMBER FORMATTING (Display) - Client Safe
// ============================================

/**
 * Format number with thousand separators (Indonesian format)
 * Example: 1234567 -> "1.234.567"
 */
export function formatNumber(
  value: number | null | undefined,
  options?: {
    decimals?: number;
    locale?: string;
  }
): string {
  const { decimals = 0, locale = "id-ID" } = options || {};
  
  if (value === null || value === undefined) {
    return "0";
  }
  
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

/**
 * Format number as currency (Indonesian Rupiah)
 * Example: 1234567 -> "Rp 1.234.567"
 */
export function formatCurrency(
  value: number | null | undefined,
  options?: {
    decimals?: number;
    showSymbol?: boolean;
  }
): string {
  const { decimals = 0, showSymbol = true } = options || {};
  
  if (value === null || value === undefined) {
    return showSymbol ? "Rp 0" : "0";
  }
  
  if (showSymbol) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse formatted string to number
 * Removes thousand separators and converts to number
 * Example: "1.234.567" -> 1234567
 */
export function parseFormattedNumber(value: string | number): number {
  // If already a number, return it
  if (typeof value === "number") {
    return value;
  }
  
  if (!value || value === "") {
    return 0;
  }
  
  // Convert to string if not already
  const strValue = String(value);
  
  // For Indonesian format, dots (.) are thousand separators
  // Remove all dots (thousand separators) first
  const withoutDots = strValue.replace(/\./g, "");
  
  // Remove all non-digit characters except comma (for decimal)
  const cleaned = withoutDots.replace(/[^\d,]/g, "");
  
  // Replace comma with dot if it's a decimal separator (for decimal numbers)
  const normalized = cleaned.replace(",", ".");
  
  // Parse as integer (not float) since we're dealing with liter (whole numbers)
  const parsed = parseInt(normalized, 10);
  
  return isNaN(parsed) ? 0 : parsed;
}

