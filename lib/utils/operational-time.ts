/**
 * Utility functions for operational time validation
 */

import { nowUTC } from "./datetime";

/**
 * Check if current time is within operational hours
 * @param openTime - Format: "HH:MM" (e.g., "06:00")
 * @param closeTime - Format: "HH:MM" (e.g., "22:00")
 * @returns boolean
 */
export function isWithinOperationalHours(
  openTime: string | null,
  closeTime: string | null
): boolean {
  if (!openTime || !closeTime) return false;

  const now = nowUTC();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute; // Convert to minutes

  // Parse open and close times
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  const openTimeInMinutes = openHour * 60 + openMinute;
  const closeTimeInMinutes = closeHour * 60 + closeMinute;

  // Handle cases where close time is past midnight
  if (closeTimeInMinutes < openTimeInMinutes) {
    // e.g., 22:00 to 02:00 (next day)
    return (
      currentTime >= openTimeInMinutes || currentTime <= closeTimeInMinutes
    );
  }

  // Normal case
  return currentTime >= openTimeInMinutes && currentTime <= closeTimeInMinutes;
}

/**
 * Check if current time is before operational hours
 * @param openTime - Format: "HH:MM" (e.g., "06:00")
 * @param closeTime - Format: "HH:MM" (e.g., "22:00")
 * @returns boolean - true if current time is before openTime
 */
export function isBeforeOperationalHours(
  openTime: string | null,
  closeTime: string | null
): boolean {
  if (!openTime || !closeTime) return false;

  const now = nowUTC();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute; // Convert to minutes

  // Parse open time
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const openTimeInMinutes = openHour * 60 + openMinute;

  // Parse close time (untuk handle case close time melewati midnight)
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);
  const closeTimeInMinutes = closeHour * 60 + closeMinute;

  // Handle cases where close time is past midnight
  if (closeTimeInMinutes < openTimeInMinutes) {
    // e.g., 22:00 to 02:00 (next day)
    // Sebelum operasional jika waktu sekarang antara closeTime dan openTime
    return currentTime > closeTimeInMinutes && currentTime < openTimeInMinutes;
  }

  // Normal case: sebelum operasional jika waktu sekarang < openTime
  return currentTime < openTimeInMinutes;
}

/**
 * Check if tank reading can be input based on reading type and operational hours
 * @param readingType - "OPEN" or "CLOSE"
 * @param openTime - Format: "HH:MM"
 * @param closeTime - Format: "HH:MM"
 * @returns { canInput: boolean, reason: string }
 */
export function canInputTankReading(
  readingType: "OPEN" | "CLOSE",
  openTime: string | null,
  closeTime: string | null
): { canInput: boolean; reason: string } {
  if (!openTime || !closeTime) {
    return {
      canInput: true,
      reason: "Jam operational belum diatur",
    };
  }

  const isOperational = isWithinOperationalHours(openTime, closeTime);

  if (readingType === "OPEN") {
    // Reading OPEN hanya bisa input SEBELUM jam operasional
    if (isOperational) {
      return {
        canInput: false,
        reason: `Reading awal shift hanya bisa diinput sebelum jam operasional (sebelum ${openTime})`,
      };
    }
    return {
      canInput: true,
      reason: "OK",
    };
  }

  if (readingType === "CLOSE") {
    // Reading CLOSE hanya bisa input SETELAH jam operasional
    if (isOperational) {
      return {
        canInput: false,
        reason: `Reading akhir shift hanya bisa diinput setelah jam operasional (setelah ${closeTime})`,
      };
    }
    return {
      canInput: true,
      reason: "OK",
    };
  }

  return { canInput: false, reason: "Unknown reading type" };
}

/**
 * Get human-readable time window message
 */
export function getReadingTimeWindow(
  readingType: "OPEN" | "CLOSE",
  openTime: string | null,
  closeTime: string | null
): string {
  if (!openTime || !closeTime) {
    return "Jam operational belum diatur";
  }

  if (readingType === "OPEN") {
    return `Reading awal shift hanya bisa diinput sebelum jam ${openTime}`;
  }

  return `Reading akhir shift hanya bisa diinput setelah jam ${closeTime}`;
}

/**
 * Check if check in can be performed based on operational hours
 * Check in hanya bisa dilakukan ANTARA jam operasional (dari openTime sampai closeTime)
 * @param openTime - Format: "HH:MM"
 * @param closeTime - Format: "HH:MM"
 * @returns { canCheckIn: boolean, reason: string }
 */
export function canCheckIn(
  openTime: string | null,
  closeTime: string | null
): { canCheckIn: boolean; reason: string } {
  if (!openTime || !closeTime) {
    return {
      canCheckIn: true,
      reason: "Jam operational belum diatur",
    };
  }

  const isOperational = isWithinOperationalHours(openTime, closeTime);

  // Check in hanya bisa dilakukan antara jam operasional
  if (!isOperational) {
    return {
      canCheckIn: false,
      reason: `Check in hanya bisa dilakukan antara jam operasional (${openTime} - ${closeTime})`,
    };
  }

  return {
    canCheckIn: true,
    reason: "OK",
  };
}
