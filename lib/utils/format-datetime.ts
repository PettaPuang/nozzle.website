/**
 * DateTime Display Formatting Utilities
 * 
 * CRITICAL RULES:
 * 1. Input dates dari server sudah dalam UTC (ISO string atau Date object)
 * 2. JavaScript Date otomatis konversi UTC → local timezone saat formatting
 * 3. Gunakan utilities ini untuk konsistensi format display di seluruh aplikasi
 * 
 * Format yang digunakan:
 * - Date only: "dd MMM yyyy" (e.g., "15 Jan 2024")
 * - Date + Time: "dd MMM yyyy HH:mm" (e.g., "15 Jan 2024 14:30")
 * - Time only: "HH:mm" (e.g., "14:30")
 */

import { format } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Format date untuk display (otomatis konversi ke local timezone)
 * 
 * @param date - Date object atau ISO string dari server (UTC)
 * @param formatStr - Format string untuk date-fns (default: "dd MMM yyyy")
 * @returns Formatted date string dalam local timezone user
 * 
 * @example
 * formatDateDisplay("2024-01-15T00:00:00.000Z") // "15 Jan 2024" (dalam local timezone)
 * formatDateDisplay(new Date(), "dd/MM/yyyy") // "15/01/2024"
 */
export function formatDateDisplay(
  date: Date | string | null | undefined,
  formatStr: string = "dd MMM yyyy"
): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) {
    return "";
  }
  
  return format(dateObj, formatStr, { locale: id });
}

/**
 * Format date dan time untuk display (otomatis konversi ke local timezone)
 * 
 * @param date - Date object atau ISO string dari server (UTC)
 * @param dateFormat - Format untuk tanggal (default: "dd MMM yyyy")
 * @param timeFormat - Format untuk waktu (default: "HH:mm")
 * @returns Formatted date + time string dalam local timezone user
 * 
 * @example
 * formatDateTimeDisplay("2024-01-15T14:30:00.000Z") // "15 Jan 2024 14:30"
 * formatDateTimeDisplay(new Date(), "dd/MM/yyyy", "HH:mm:ss") // "15/01/2024 14:30:00"
 */
export function formatDateTimeDisplay(
  date: Date | string | null | undefined,
  dateFormat: string = "dd MMM yyyy",
  timeFormat: string = "HH:mm"
): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) {
    return "";
  }
  
  const dateStr = format(dateObj, dateFormat, { locale: id });
  const timeStr = format(dateObj, timeFormat, { locale: id });
  
  return `${dateStr} ${timeStr}`;
}

/**
 * Format time saja untuk display (otomatis konversi ke local timezone)
 * 
 * @param date - Date object atau ISO string dari server (UTC)
 * @param formatStr - Format string untuk time (default: "HH:mm")
 * @returns Formatted time string dalam local timezone user
 * 
 * @example
 * formatTimeDisplay("2024-01-15T14:30:00.000Z") // "14:30"
 * formatTimeDisplay(new Date(), "HH:mm:ss") // "14:30:00"
 */
export function formatTimeDisplay(
  date: Date | string | null | undefined,
  formatStr: string = "HH:mm"
): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) {
    return "";
  }
  
  return format(dateObj, formatStr, { locale: id });
}

/**
 * Format date untuk input field (YYYY-MM-DD)
 * 
 * @param date - Date object atau ISO string dari server (UTC)
 * @returns Date string dalam format YYYY-MM-DD (local date, bukan UTC)
 * 
 * @example
 * formatDateInput("2024-01-15T00:00:00.000Z") // "2024-01-15" (dalam local timezone)
 */
export function formatDateInput(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Validate date
  if (isNaN(dateObj.getTime())) {
    return "";
  }
  
  // Gunakan local date untuk input (bukan UTC)
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

