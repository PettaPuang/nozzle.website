/**
 * Centralized DateTime Utilities
 *
 * CRITICAL RULES:
 * 1. ALL datetime values MUST be stored in UTC in database
 * 2. ALL datetime operations MUST use UTC
 * 3. Conversion to local timezone ONLY happens at display layer (client)
 *
 * This ensures consistency across:
 * - Different server regions (Vercel serverless)
 * - Different client timezones
 * - Daylight saving time changes
 */

/**
 * Normalize any date input to UTC Date object
 * Handles: Date object, ISO string, timestamp, or null/undefined
 *
 * @param input - Date input (can be Date, string, number, or null/undefined)
 * @returns Date object in UTC, or null if input is invalid/null
 */
export function normalizeToUTC(
  input: Date | string | number | null | undefined
): Date | null {
  if (!input) return null;

  let date: Date;

  if (input instanceof Date) {
    // If already a Date object, use it directly
    date = input;
  } else if (typeof input === "string") {
    // Parse ISO string or other date string
    date = new Date(input);
  } else if (typeof input === "number") {
    // Timestamp (milliseconds)
    date = new Date(input);
  } else {
    return null;
  }

  // Validate date
  if (isNaN(date.getTime())) {
    return null;
  }

  // Date object is already in UTC internally
  // JavaScript Date stores time as UTC milliseconds since epoch
  // When we create new Date(), it's already UTC internally
  return date;
}

/**
 * Get current UTC date/time
 * Use this instead of new Date() for consistency
 *
 * @returns Current Date in UTC
 */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Create UTC date from year, month, day (local date representation)
 * Useful for creating dates from user input (e.g., "2024-01-15")
 *
 * @param year - Year (e.g., 2024)
 * @param month - Month (0-11, where 0 = January)
 * @param day - Day of month (1-31)
 * @returns Date object representing start of day in UTC
 */
export function createUTCDate(year: number, month: number, day: number): Date {
  // Create date in UTC directly
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Get start of day in UTC for a given date
 * Returns date at 00:00:00.000 UTC
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns Start of day in UTC
 */
export function startOfDayUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  return new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth(),
      normalized.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Get end of day in UTC for a given date
 * Returns date at 23:59:59.999 UTC
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns End of day in UTC
 */
export function endOfDayUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  return new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth(),
      normalized.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Get today's date range in UTC
 * Returns { start: start of today UTC, end: end of today UTC }
 *
 * @returns Object with start and end Date in UTC
 */
export function todayRangeUTC(): { start: Date; end: Date } {
  const now = nowUTC();
  return {
    start: startOfDayUTC(now),
    end: endOfDayUTC(now),
  };
}

/**
 * Get "today" in UTC based on user's local timezone
 * Use this for client-side date ranges where "today" means the user's local date
 *
 * @returns Date object representing end of today in UTC (based on local date)
 *
 * @example
 * // If user is in WIB (UTC+7) and it's 00:24 on Dec 3 local time:
 * // This returns Dec 3 23:59:59 UTC (not Dec 2 UTC)
 * const todayUTC = getTodayLocalAsUTC();
 */
export function getTodayLocalAsUTC(): Date {
  // Get local date (user's timezone)
  const todayLocal = new Date();

  // Convert to UTC end of day
  return new Date(
    Date.UTC(
      todayLocal.getFullYear(),
      todayLocal.getMonth(),
      todayLocal.getDate(),
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Get local date from server's current timezone
 * Uses server's actual timezone to determine the current local date
 *
 * @returns Date object representing local date (start of day UTC)
 *
 * @example
 * // Server timezone: UTC+8, Current time: 2025-12-07 01:51 (local)
 * // Returns: 2025-12-07 (local date as UTC start of day)
 */
export function getLocalDateFromUTC(): Date {
  // Get current time from server (will use server's timezone)
  // new Date() without parameters uses server's local timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  // Return Date object with local date (start of day UTC)
  // This represents the local date but stored as UTC in database
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Add days to a date in UTC
 *
 * @param date - Base date (will be normalized to UTC)
 * @param days - Number of days to add (can be negative)
 * @returns New Date with days added
 */
export function addDaysUTC(
  date: Date | string | number | null | undefined,
  days: number
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  const result = new Date(normalized);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Add months to a date in UTC
 *
 * @param date - Base date (will be normalized to UTC)
 * @param months - Number of months to add (can be negative)
 * @returns New Date with months added
 */
export function addMonthsUTC(
  date: Date | string | number | null | undefined,
  months: number
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  const result = new Date(normalized);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * Get end of year in UTC for a given date
 * Returns date at 23:59:59.999 UTC on December 31st
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns End of year in UTC
 */
export function endOfYearUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  return new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      11, // December
      31,
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Get start of month in UTC for a given date
 * Returns date at 00:00:00.000 UTC on the first day of the month
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns Start of month in UTC
 */
export function startOfMonthUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  return new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Get end of month in UTC for a given date
 * Returns date at 23:59:59.999 UTC on the last day of the month
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns End of month in UTC
 */
export function endOfMonthUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();
  // Get last day of month: day 0 of next month
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));
}

/**
 * Get start of year in UTC for a given date
 * Returns date at 00:00:00.000 UTC on January 1st
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns Start of year in UTC
 */
export function startOfYearUTC(
  date: Date | string | number | null | undefined
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  return new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      0, // January
      1,
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Get start of week in UTC for a given date
 * Returns date at 00:00:00.000 UTC on the first day of the week (Monday)
 *
 * @param date - Input date (will be normalized to UTC)
 * @param weekStartsOn - Day of week that starts the week (0 = Sunday, 1 = Monday, default: 1)
 * @returns Start of week in UTC
 */
export function startOfWeekUTC(
  date: Date | string | number | null | undefined,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1
): Date {
  const normalized = normalizeToUTC(date) || nowUTC();
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();
  const day = normalized.getUTCDate();

  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) in UTC
  const dayOfWeek = normalized.getUTCDay();

  // Calculate days to subtract to get to start of week
  let daysToSubtract: number;
  if (weekStartsOn === 0) {
    // Week starts on Sunday
    daysToSubtract = dayOfWeek;
  } else {
    // Week starts on Monday (default)
    // Sunday (0) should go back 6 days, Monday (1) = 0 days, etc.
    daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }

  // Create date at start of week
  const result = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  result.setUTCDate(result.getUTCDate() - daysToSubtract);

  return result;
}

/**
 * Get date range for query (start and end of day in UTC)
 * Useful for Prisma queries with date filters
 *
 * @param date - Input date (will be normalized to UTC)
 * @returns Object with start and end Date in UTC
 */
export function getDateRangeUTC(
  date: Date | string | number | null | undefined
): {
  start: Date;
  end: Date;
} {
  const normalized = normalizeToUTC(date) || nowUTC();
  return {
    start: startOfDayUTC(normalized),
    end: endOfDayUTC(normalized),
  };
}

/**
 * Get date range for multiple days query
 *
 * @param startDate - Start date (will be normalized to UTC)
 * @param endDate - End date (will be normalized to UTC)
 * @returns Object with start and end Date in UTC
 */
export function getDateRangeBetweenUTC(
  startDate: Date | string | number | null | undefined,
  endDate: Date | string | number | null | undefined
): { start: Date; end: Date } {
  const start = normalizeToUTC(startDate);
  const end = normalizeToUTC(endDate);

  if (!start || !end) {
    throw new Error("Invalid date range: start and end dates are required");
  }

  return {
    start: startOfDayUTC(start),
    end: endOfDayUTC(end),
  };
}

/**
 * Convert local date string (YYYY-MM-DD) to UTC Date
 * Useful when client sends date-only string
 *
 * @param dateString - Date string in format YYYY-MM-DD
 * @returns Date object representing start of that day in UTC
 */
export function parseLocalDateToUTC(dateString: string): Date {
  // Parse YYYY-MM-DD format
  const parts = dateString.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date values: ${dateString}`);
  }

  // Create UTC date directly
  return createUTCDate(year, month, day);
}

/**
 * Zod preprocess function for datetime normalization
 * Use this in Zod schemas to ensure UTC conversion
 *
 * @example
 * z.preprocess(normalizeDateTimeUTC, z.date())
 */
export function normalizeDateTimeUTC(input: unknown): Date | null {
  if (input === null || input === undefined) return null;

  const normalized = normalizeToUTC(input as Date | string | number);
  return normalized;
}

/**
 * Zod preprocess function for date-only normalization
 * Converts date string (YYYY-MM-DD) to UTC Date
 * Always returns start of day UTC for date-only fields
 *
 * @example
 * z.preprocess(normalizeDateUTC, z.date())
 */
export function normalizeDateUTC(input: unknown): Date | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "string") {
    // Try parsing as local date first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      try {
        return parseLocalDateToUTC(input);
      } catch {
        // Fall through to normal parsing
      }
    }
  }

  // For Date objects or other formats, normalize to UTC and ensure start of day
  const normalized = normalizeDateTimeUTC(input);
  if (!normalized) return null;

  // Always return start of day UTC for date-only fields
  return startOfDayUTC(normalized);
}

/**
 * Determine operational date for tank reading
 * Tank reading dilakukan di luar jam operasional untuk menutup operasional hari sebelumnya
 *
 * Logika:
 * - Jika reading dibuat setelah 00:00 tapi sebelum openTime → date = hari kemarin (menutup operasional kemarin)
 * - Jika reading dibuat setelah closeTime → date = hari ini (menutup operasional hari ini)
 *
 * @param readingCreatedAt - Waktu saat reading dibuat (UTC)
 * @param openTime - Jam buka operasional (format "HH:MM", e.g., "06:00")
 * @param closeTime - Jam tutup operasional (format "HH:MM", e.g., "22:00")
 * @returns Tanggal operasional yang ditutup oleh reading ini (UTC)
 */
export function getOperationalDateForTankReading(
  readingCreatedAt: Date,
  openTime: string | null,
  closeTime: string | null
): Date {
  // Gunakan local time untuk semua operasi
  // readingCreatedAt sudah di-convert ke local time dari server
  const year = readingCreatedAt.getFullYear();
  const month = readingCreatedAt.getMonth();
  const day = readingCreatedAt.getDate();
  const readingDate = new Date(year, month, day, 0, 0, 0, 0); // Start of day LOCAL

  const readingHour = readingCreatedAt.getHours();
  const readingMinute = readingCreatedAt.getMinutes();
  const readingTimeInMinutes = readingHour * 60 + readingMinute;

  // Jika tidak ada jam operasional, gunakan tanggal saat reading dibuat
  if (!openTime || !closeTime) {
    // Convert back to UTC for storage
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  // Parse jam operasional
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);
  const openTimeInMinutes = openHour * 60 + openMinute;
  const closeTimeInMinutes = closeHour * 60 + closeMinute;

  // Tentukan operational date dalam local time
  let operationalDay = day;
  let operationalMonth = month;
  let operationalYear = year;

  // Handle case closeTime melewati midnight (e.g., 22:00 to 02:00)
  if (closeTimeInMinutes < openTimeInMinutes) {
    // Close time melewati midnight
    // Jika reading dibuat antara 00:00 dan openTime → date = hari kemarin
    // Jika reading dibuat antara closeTime dan 23:59 → date = hari ini
    if (readingTimeInMinutes >= 0 && readingTimeInMinutes < openTimeInMinutes) {
      // Reading dibuat setelah 00:00 tapi sebelum openTime → untuk hari kemarin
      const yesterday = new Date(year, month, day - 1, 0, 0, 0, 0);
      operationalYear = yesterday.getFullYear();
      operationalMonth = yesterday.getMonth();
      operationalDay = yesterday.getDate();
    }
    // else: untuk hari ini (sudah default)
  } else {
    // Normal case: closeTime tidak melewati midnight (e.g., 06:00 to 22:00)
    // Jika reading dibuat sebelum openTime → date = hari kemarin (menutup operasional kemarin)
    // Jika reading dibuat setelah closeTime → date = hari ini (menutup operasional hari ini)
    if (readingTimeInMinutes < openTimeInMinutes) {
      // Reading dibuat sebelum openTime → untuk hari kemarin
      const yesterday = new Date(year, month, day - 1, 0, 0, 0, 0);
      operationalYear = yesterday.getFullYear();
      operationalMonth = yesterday.getMonth();
      operationalDay = yesterday.getDate();
    }
    // else if readingTimeInMinutes >= closeTimeInMinutes: untuk hari ini (sudah default)
  }

  // Return as UTC date for database storage
  return new Date(
    Date.UTC(operationalYear, operationalMonth, operationalDay, 0, 0, 0, 0)
  );
}

/**
 * Get current operational date based on user local time and operational hours
 * Used to determine which operational day is currently active
 *
 * @param openTime - Opening time (HH:mm format, local time)
 * @param closeTime - Closing time (HH:mm format, local time)
 * @param timezoneOffset - User timezone offset in minutes (from getTimezoneOffset())
 * @returns Current operational date as UTC Date
 */
export function getCurrentOperationalDate(
  openTime: string | null,
  closeTime: string | null,
  timezoneOffset: number = 0
): Date {
  const serverTime = nowUTC();

  // Convert to user local time
  const userLocalTime = new Date(serverTime.getTime() - timezoneOffset * 60000);

  // Use same logic as tank reading to determine operational date
  return getOperationalDateForTankReading(userLocalTime, openTime, closeTime);
}
