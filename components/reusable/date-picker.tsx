"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  startOfDayUTC,
  endOfDayUTC,
  getTodayLocalAsUTC,
  addDaysUTC,
  startOfMonthUTC,
  startOfYearUTC,
} from "@/lib/utils/datetime";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DateRange as ReactDayPickerDateRange } from "react-day-picker";

import { cn } from "@/lib/utils";

export type DateRange = {
  from: Date;
  to: Date;
};
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface DatePickerProps {
  date?: ReactDayPickerDateRange;
  onSelect?: (date: ReactDayPickerDateRange | undefined) => void;
  className?: string;
  buttonClassName?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

interface DateParts {
  day: number;
  month: number;
  year: number;
}

export function DatePicker({
  date,
  onSelect,
  className,
  buttonClassName,
  size = "default",
}: DatePickerProps) {
  const getTodayDate = (): DateParts => {
    const today = new Date(); // Local time user
    return {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  };

  const getDateParts = (date: Date): DateParts => ({
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  });

  const getInitialDate = (): DateParts => {
    if (date?.from) {
      return getDateParts(date.from);
    }
    return getTodayDate();
  };

  const initialDate = getInitialDate();
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.day);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.month);
  const [selectedYear, setSelectedYear] = useState<number>(initialDate.year);

  // Custom mode: date range
  const [fromDay, setFromDay] = useState<number>(initialDate.day);
  const [fromMonth, setFromMonth] = useState<number>(initialDate.month);
  const [fromYear, setFromYear] = useState<number>(initialDate.year);
  const [toDay, setToDay] = useState<number>(initialDate.day);
  const [toMonth, setToMonth] = useState<number>(initialDate.month);
  const [toYear, setToYear] = useState<number>(initialDate.year);

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Detect which preset matches current date range
  const detectPreset = (from: Date, to: Date): string | null => {
    const today = new Date(); // Local time user
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
      0
    );

    // Input dates adalah UTC, extract UTC date dan compare dengan local date
    const fromDay = new Date(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      0,
      0,
      0,
      0
    );
    const toDay = new Date(
      to.getUTCFullYear(),
      to.getUTCMonth(),
      to.getUTCDate(),
      0,
      0,
      0,
      0
    );

    // Check if dates match exactly (same day)
    if (
      fromDay.getTime() === todayStart.getTime() &&
      toDay.getTime() === todayStart.getTime()
    ) {
      return "today";
    }

    // Last 7 Days
    const last7From = new Date(today);
    last7From.setDate(last7From.getDate() - 6);
    last7From.setHours(0, 0, 0, 0);
    if (
      fromDay.getTime() === last7From.getTime() &&
      toDay.getTime() === todayStart.getTime()
    ) {
      return "last7";
    }

    // Last Month
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthStart = new Date(lastMonthYear, lastMonth, 1, 0, 0, 0, 0);
    const lastMonthEnd = new Date(lastMonthYear, lastMonth + 1, 0, 0, 0, 0, 0);
    if (
      fromDay.getTime() === lastMonthStart.getTime() &&
      toDay.getTime() === lastMonthEnd.getTime()
    ) {
      return "lastMonth";
    }

    // This Month
    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    if (
      fromDay.getTime() === monthStart.getTime() &&
      toDay.getTime() === todayStart.getTime()
    ) {
      return "thisMonth";
    }

    // This Year
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    if (
      fromDay.getTime() === yearStart.getTime() &&
      toDay.getTime() === todayStart.getTime()
    ) {
      return "thisYear";
    }

    // Custom (different dates)
    if (fromDay.getTime() !== toDay.getTime()) {
      return "custom";
    }

    return null;
  };

  // Track initial values to detect changes
  const initialValues = useMemo(() => {
    if (date?.from && date?.to) {
      const fromTime = date.from.getTime();
      const toTime = date.to.getTime();
      if (fromTime !== toTime) {
        return {
          isCustom: true,
          from: getDateParts(date.from),
          to: getDateParts(date.to),
        };
      }
      return {
        isCustom: false,
        single: getDateParts(date.from),
      };
    }
    return null;
  }, [date]);

  // Check if there are changes
  const hasChanges = useMemo(() => {
    // Jika ada preset yang dipilih dan berbeda dengan initial, itu adalah perubahan
    if (selectedPreset && selectedPreset !== "custom") {
      // Cek apakah preset saat ini berbeda dengan initial
      if (date?.from && date?.to) {
        const detectedPreset = detectPreset(date.from, date.to);
        return selectedPreset !== detectedPreset;
      }
      return true; // Jika belum ada initial date, pilihan preset adalah perubahan
    }

    if (!initialValues) {
      // No initial date, check if different from today
      const today = getTodayDate();
      if (isCustomMode) {
        return (
          fromDay !== today.day ||
          fromMonth !== today.month ||
          fromYear !== today.year ||
          toDay !== today.day ||
          toMonth !== today.month ||
          toYear !== today.year
        );
      }
      return (
        selectedDay !== today.day ||
        selectedMonth !== today.month ||
        selectedYear !== today.year
      );
    }

    if (
      isCustomMode &&
      initialValues.isCustom &&
      initialValues.from &&
      initialValues.to
    ) {
      return (
        fromDay !== initialValues.from.day ||
        fromMonth !== initialValues.from.month ||
        fromYear !== initialValues.from.year ||
        toDay !== initialValues.to.day ||
        toMonth !== initialValues.to.month ||
        toYear !== initialValues.to.year
      );
    }

    if (!isCustomMode && !initialValues.isCustom && initialValues.single) {
      return (
        selectedDay !== initialValues.single.day ||
        selectedMonth !== initialValues.single.month ||
        selectedYear !== initialValues.single.year
      );
    }

    // Mode changed, consider it as change
    return true;
  }, [
    isCustomMode,
    selectedDay,
    selectedMonth,
    selectedYear,
    fromDay,
    fromMonth,
    fromYear,
    toDay,
    toMonth,
    toYear,
    initialValues,
    selectedPreset,
    date,
  ]);

  React.useEffect(() => {
    setIsMounted(true);
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  React.useEffect(() => {
    if (!date?.from) {
      const today = getTodayDate();
      setSelectedDay(today.day);
      setSelectedMonth(today.month);
      setSelectedYear(today.year);
      setSelectedPreset(null);
      return;
    }

    const fromParts = getDateParts(date.from);
    setSelectedDay(fromParts.day);
    setSelectedMonth(fromParts.month);
    setSelectedYear(fromParts.year);

    if (date.to) {
      const toParts = getDateParts(date.to);
      setFromDay(fromParts.day);
      setFromMonth(fromParts.month);
      setFromYear(fromParts.year);
      setToDay(toParts.day);
      setToMonth(toParts.month);
      setToYear(toParts.year);

      const detectedPreset = detectPreset(date.from, date.to);
      setSelectedPreset(detectedPreset);
      if (detectedPreset === "custom") {
        setIsCustomMode(true);
      }
    } else {
      setSelectedPreset(null);
    }
  }, [date]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setIsCustomMode(false);
    }
  };

  // Helper function to compare dates (gunakan local time)
  const compareDates = (
    year1: number,
    month1: number,
    day1: number,
    year2: number,
    month2: number,
    day2: number
  ): number => {
    const date1 = new Date(year1, month1 - 1, day1);
    const date2 = new Date(year2, month2 - 1, day2);
    return date1.getTime() - date2.getTime();
  };

  // Generic date navigation handlers
  const createDateHandlers = (
    day: number,
    month: number,
    year: number,
    setDay: (d: number) => void,
    setMonth: React.Dispatch<React.SetStateAction<number>>,
    setYear: React.Dispatch<React.SetStateAction<number>>,
    constraint?: { year: number; month: number; day: number },
    constraintType?: "max" | "min" // "max" for from date (constraint is to date), "min" for to date (constraint is from date)
  ) => {
    const adjustDayForMonth = (newYear: number, newMonth: number) => {
      // Hitung jumlah hari dalam bulan menggunakan local time
      const daysInMonth = new Date(newYear, newMonth, 0).getDate();
      if (day > daysInMonth) {
        setDay(daysInMonth);
        return daysInMonth;
      }
      return day;
    };

    const handlePrevDay = () => {
      const currentDate = new Date(year, month - 1, day);
      currentDate.setDate(currentDate.getDate() - 1);
      const newDay = currentDate.getDate();
      const newMonth = currentDate.getMonth() + 1;
      const newYear = currentDate.getFullYear();

      if (constraint) {
        // For from date (constraintType === "max"): newDate must be <= constraint (to date)
        // For to date (constraintType === "min"): constraint (from date) must be <= newDate
        let isValid = false;
        if (constraintType === "max") {
          isValid =
            compareDates(
              newYear,
              newMonth,
              newDay,
              constraint.year,
              constraint.month,
              constraint.day
            ) <= 0;
        } else if (constraintType === "min") {
          isValid =
            compareDates(
              constraint.year,
              constraint.month,
              constraint.day,
              newYear,
              newMonth,
              newDay
            ) <= 0;
        }

        if (isValid) {
          setDay(newDay);
          setMonth(newMonth);
          setYear(newYear);
        }
      } else {
        setDay(newDay);
        setMonth(newMonth);
        setYear(newYear);
      }
    };

    const handleNextDay = () => {
      const currentDate = new Date(year, month - 1, day);
      currentDate.setDate(currentDate.getDate() + 1);
      const newDay = currentDate.getDate();
      const newMonth = currentDate.getMonth() + 1;
      const newYear = currentDate.getFullYear();

      if (constraint) {
        // For from date (constraintType === "max"): newDate must be <= constraint (to date)
        // For to date (constraintType === "min"): constraint (from date) must be <= newDate
        let isValid = false;
        if (constraintType === "max") {
          // From date: newDate <= constraint (to date)
          isValid =
            compareDates(
              newYear,
              newMonth,
              newDay,
              constraint.year,
              constraint.month,
              constraint.day
            ) <= 0;
        } else if (constraintType === "min") {
          // To date: constraint (from date) <= newDate
          isValid =
            compareDates(
              constraint.year,
              constraint.month,
              constraint.day,
              newYear,
              newMonth,
              newDay
            ) <= 0;
        }

        if (isValid) {
          setDay(newDay);
          setMonth(newMonth);
          setYear(newYear);
        }
      } else {
        setDay(newDay);
        setMonth(newMonth);
        setYear(newYear);
      }
    };

    const handlePrevMonth = () => {
      setMonth((prevMonth: number) => {
        const newMonth = prevMonth === 1 ? 12 : prevMonth - 1;
        const newYear = prevMonth === 1 ? year - 1 : year;
        const finalDay = adjustDayForMonth(newYear, newMonth);

        if (constraint) {
          // For from date (constraintType === "max"): newDate must be <= constraint (to date)
          // For to date (constraintType === "min"): constraint (from date) must be <= newDate
          let isValid = false;
          if (constraintType === "max") {
            isValid =
              compareDates(
                newYear,
                newMonth,
                finalDay,
                constraint.year,
                constraint.month,
                constraint.day
              ) <= 0;
          } else if (constraintType === "min") {
            isValid =
              compareDates(
                constraint.year,
                constraint.month,
                constraint.day,
                newYear,
                newMonth,
                finalDay
              ) <= 0;
          }

          if (isValid) {
            setYear(newYear);
            return newMonth;
          }
          return prevMonth;
        }
        setYear(newYear);
        return newMonth;
      });
    };

    const handleNextMonth = () => {
      setMonth((prevMonth: number) => {
        const newMonth = prevMonth === 12 ? 1 : prevMonth + 1;
        const newYear = prevMonth === 12 ? year + 1 : year;
        const finalDay = adjustDayForMonth(newYear, newMonth);

        if (constraint) {
          // For from date (constraintType === "max"): newDate must be <= constraint (to date)
          // For to date (constraintType === "min"): constraint (from date) must be <= newDate
          let isValid = false;
          if (constraintType === "max") {
            isValid =
              compareDates(
                newYear,
                newMonth,
                finalDay,
                constraint.year,
                constraint.month,
                constraint.day
              ) <= 0;
          } else if (constraintType === "min") {
            isValid =
              compareDates(
                constraint.year,
                constraint.month,
                constraint.day,
                newYear,
                newMonth,
                finalDay
              ) <= 0;
          }

          if (isValid) {
            setYear(newYear);
            return newMonth;
          }
          return prevMonth;
        }
        setYear(newYear);
        return newMonth;
      });
    };

    const handlePrevYear = () => {
      setYear((prevYear: number) => {
        const newYear = prevYear - 1;
        const finalDay = adjustDayForMonth(newYear, month);

        if (constraint) {
          // For from date (constraintType === "max"): newDate must be <= constraint (to date)
          // For to date (constraintType === "min"): constraint (from date) must be <= newDate
          let isValid = false;
          if (constraintType === "max") {
            isValid =
              compareDates(
                newYear,
                month,
                finalDay,
                constraint.year,
                constraint.month,
                constraint.day
              ) <= 0;
          } else if (constraintType === "min") {
            isValid =
              compareDates(
                constraint.year,
                constraint.month,
                constraint.day,
                newYear,
                month,
                finalDay
              ) <= 0;
          }

          if (isValid) {
            return newYear;
          }
          return prevYear;
        }
        return newYear;
      });
    };

    const handleNextYear = () => {
      setYear((prevYear: number) => {
        const newYear = prevYear + 1;
        const finalDay = adjustDayForMonth(newYear, month);

        if (constraint) {
          // For from date (constraintType === "max"): newDate must be <= constraint (to date)
          // For to date (constraintType === "min"): constraint (from date) must be <= newDate
          let isValid = false;
          if (constraintType === "max") {
            isValid =
              compareDates(
                newYear,
                month,
                finalDay,
                constraint.year,
                constraint.month,
                constraint.day
              ) <= 0;
          } else if (constraintType === "min") {
            isValid =
              compareDates(
                constraint.year,
                constraint.month,
                constraint.day,
                newYear,
                month,
                finalDay
              ) <= 0;
          }

          if (isValid) {
            return newYear;
          }
          return prevYear;
        }
        return newYear;
      });
    };

    return {
      handlePrevDay,
      handleNextDay,
      handlePrevMonth,
      handleNextMonth,
      handlePrevYear,
      handleNextYear,
    };
  };

  // Normal mode handlers
  const normalHandlers = createDateHandlers(
    selectedDay,
    selectedMonth,
    selectedYear,
    setSelectedDay,
    setSelectedMonth,
    setSelectedYear
  );

  // Custom mode handlers for from date
  const fromHandlers = createDateHandlers(
    fromDay,
    fromMonth,
    fromYear,
    setFromDay,
    setFromMonth,
    setFromYear,
    { year: toYear, month: toMonth, day: toDay },
    "max" // from date tidak boleh lebih dari to date
  );

  // Custom mode handlers for to date
  const toHandlers = createDateHandlers(
    toDay,
    toMonth,
    toYear,
    setToDay,
    setToMonth,
    setToYear,
    { year: fromYear, month: fromMonth, day: fromDay },
    "min" // to date tidak boleh kurang dari from date
  );

  const handleClear = () => {
    const today = getTodayDate();
    setSelectedDay(today.day);
    setSelectedMonth(today.month);
    setSelectedYear(today.year);
    setFromDay(today.day);
    setFromMonth(today.month);
    setFromYear(today.year);
    setToDay(today.day);
    setToMonth(today.month);
    setToYear(today.year);
    setIsCustomMode(false);
    setSelectedPreset(null);
    onSelect?.(undefined);
  };

  const handleSet = () => {
    // If preset is selected and still matches, use preset
    if (selectedPreset && selectedPreset !== "custom") {
      const today = new Date(); // Local time user
      const selectedDate = new Date(
        selectedYear,
        selectedMonth - 1,
        selectedDay,
        0,
        0,
        0,
        0
      );

      let presetFrom: Date;
      let presetTo: Date;

      switch (selectedPreset) {
        case "today": {
          const todayLocalUTC = getTodayLocalAsUTC();
          presetFrom = startOfDayUTC(todayLocalUTC);
          presetTo = endOfDayUTC(todayLocalUTC);
          break;
        }
        case "last7": {
          const todayLocalUTC = getTodayLocalAsUTC();
          const last7 = addDaysUTC(todayLocalUTC, -6);
          presetFrom = startOfDayUTC(last7);
          presetTo = endOfDayUTC(todayLocalUTC);
          break;
        }
        case "lastMonth": {
          const currentMonthStart = new Date(
            today.getFullYear(),
            today.getMonth(),
            1,
            0,
            0,
            0,
            0
          );
          const lastMonthYear =
            currentMonthStart.getMonth() === 0
              ? currentMonthStart.getFullYear() - 1
              : currentMonthStart.getFullYear();
          const lastMonth =
            currentMonthStart.getMonth() === 0
              ? 11
              : currentMonthStart.getMonth() - 1;
          const lastMonthEnd = new Date(lastMonthYear, lastMonth + 1, 0);
          presetFrom = startOfDayUTC(
            new Date(Date.UTC(lastMonthYear, lastMonth, 1, 0, 0, 0, 0))
          );
          presetTo = endOfDayUTC(
            new Date(
              Date.UTC(
                lastMonthYear,
                lastMonth,
                lastMonthEnd.getDate(),
                0,
                0,
                0,
                0
              )
            )
          );
          break;
        }
        case "thisMonth": {
          const todayLocalUTC = getTodayLocalAsUTC();
          presetFrom = startOfDayUTC(
            new Date(
              Date.UTC(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
            )
          );
          presetTo = endOfDayUTC(todayLocalUTC);
          break;
        }
        case "thisYear": {
          const todayLocalUTC = getTodayLocalAsUTC();
          presetFrom = startOfDayUTC(
            new Date(Date.UTC(today.getFullYear(), 0, 1, 0, 0, 0, 0))
          );
          presetTo = endOfDayUTC(todayLocalUTC);
          break;
        }
        default:
          // Fallback to selected date - convert to UTC
          const fallbackFrom = startOfDayUTC(
            new Date(
              Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
            )
          );
          const fallbackTo = endOfDayUTC(
            new Date(
              Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
            )
          );
          onSelect?.({ from: fallbackFrom, to: fallbackTo });
          setOpen(false);
          setIsCustomMode(false);
          setSelectedPreset(null);
          return;
      }

      // Check if selected date matches preset (compare local dates)
      const selectedLocalTime = selectedDate.getTime();
      const presetLocalFrom = new Date(
        presetFrom.getUTCFullYear(),
        presetFrom.getUTCMonth(),
        presetFrom.getUTCDate()
      ).getTime();

      if (selectedLocalTime === presetLocalFrom) {
        onSelect?.({ from: presetFrom, to: presetTo });
      } else {
        // User changed date manually, use selected date converted to UTC
        const manualFrom = startOfDayUTC(
          new Date(
            Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
          )
        );
        const manualTo = endOfDayUTC(
          new Date(
            Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
          )
        );
        onSelect?.({ from: manualFrom, to: manualTo });
      }
    } else if (isCustomMode) {
      // Custom mode: convert local date to UTC
      const fromDate = startOfDayUTC(
        new Date(Date.UTC(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0))
      );
      const toDate = endOfDayUTC(
        new Date(Date.UTC(toYear, toMonth - 1, toDay, 0, 0, 0, 0))
      );
      onSelect?.({ from: fromDate, to: toDate });
    } else {
      // Normal mode: convert local date to UTC
      const selectedFrom = startOfDayUTC(
        new Date(
          Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
        )
      );
      const selectedTo = endOfDayUTC(
        new Date(
          Date.UTC(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0)
        )
      );
      onSelect?.({ from: selectedFrom, to: selectedTo });
    }
    setOpen(false);
    setIsCustomMode(false);
    setSelectedPreset(null);
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);

    if (preset === "custom") {
      setIsCustomMode(true);
      const today = getTodayDate();
      // Default custom mode: awal dan akhir = today
      setFromDay(today.day);
      setFromMonth(today.month);
      setFromYear(today.year);
      setToDay(today.day);
      setToMonth(today.month);
      setToYear(today.year);
      return;
    }

    // Untuk preset non-custom, langsung apply dan close popover
    const today = new Date(); // Local time user
    const todayLocalUTC = getTodayLocalAsUTC();
    let from: Date;
    let to: Date;

    switch (preset) {
      case "today":
        from = startOfDayUTC(todayLocalUTC);
        to = endOfDayUTC(todayLocalUTC);
        break;
      case "last7": {
        const last7 = addDaysUTC(todayLocalUTC, -6);
        from = startOfDayUTC(last7);
        to = endOfDayUTC(todayLocalUTC);
        break;
      }
      case "lastMonth": {
        const currentMonthStartDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
          0,
          0,
          0,
          0
        );
        const lastMonthYear2 =
          currentMonthStartDate.getMonth() === 0
            ? currentMonthStartDate.getFullYear() - 1
            : currentMonthStartDate.getFullYear();
        const lastMonth2 =
          currentMonthStartDate.getMonth() === 0
            ? 11
            : currentMonthStartDate.getMonth() - 1;
        const lastMonthEnd2 = new Date(lastMonthYear2, lastMonth2 + 1, 0);
        from = startOfDayUTC(
          new Date(Date.UTC(lastMonthYear2, lastMonth2, 1, 0, 0, 0, 0))
        );
        to = endOfDayUTC(
          new Date(
            Date.UTC(
              lastMonthYear2,
              lastMonth2,
              lastMonthEnd2.getDate(),
              0,
              0,
              0,
              0
            )
          )
        );
        break;
      }
      case "thisMonth":
        from = startOfDayUTC(
          new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0))
        );
        to = endOfDayUTC(todayLocalUTC);
        break;
      case "thisYear":
        from = startOfDayUTC(
          new Date(Date.UTC(today.getFullYear(), 0, 1, 0, 0, 0, 0))
        );
        to = endOfDayUTC(todayLocalUTC);
        break;
      default:
        return;
    }

    // Langsung apply preset dan close popover
    onSelect?.({ from, to });
    setOpen(false);
    setIsCustomMode(false);
    setSelectedPreset(null);
  };

  const getMonthName = (month: number) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    return months[month - 1];
  };

  // Format UTC date untuk display tanpa konversi timezone
  const formatUTCDate = (date: Date, formatStr: string) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    // Buat Date object dengan UTC date parts di local timezone untuk format
    // Ini memastikan format() menampilkan tanggal yang sama dengan UTC date parts
    const localDate = new Date(year, month, day);
    return format(localDate, formatStr, { locale: id });
  };

  // Reusable Date Selector Component
  const DateSelector = ({
    day,
    month,
    year,
    handlers,
    label,
  }: {
    day: number;
    month: number;
    year: number;
    handlers: ReturnType<typeof createDateHandlers>;
    label?: string;
  }) => (
    <div className={cn(isMobile ? "p-1" : "p-3")}>
      {label && !isMobile && (
        <div className="text-xs font-medium mb-2">{label}</div>
      )}
      <div
        className={cn(
          "grid grid-cols-3 items-center",
          isMobile ? "gap-0.5" : "gap-2"
        )}
      >
        {/* Day */}
        <div
          className={cn(
            "flex items-center border rounded-md",
            isMobile ? "gap-0.5 p-0.5" : "gap-1 p-1"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handlePrevDay}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronLeft className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
          </Button>
          <div
            className={cn(
              "flex-1 text-center font-medium",
              isMobile ? "text-[10px]" : "text-sm"
            )}
          >
            {day}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handleNextDay}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronRight
              className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")}
            />
          </Button>
        </div>

        {/* Month */}
        <div
          className={cn(
            "flex items-center border rounded-md",
            isMobile ? "gap-0.5 p-0.5" : "gap-1 p-1"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handlePrevMonth}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronLeft className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
          </Button>
          <div
            className={cn(
              "flex-1 text-center font-medium",
              isMobile ? "text-[10px]" : "text-sm"
            )}
          >
            {getMonthName(month)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handleNextMonth}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronRight
              className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")}
            />
          </Button>
        </div>

        {/* Year */}
        <div
          className={cn(
            "flex items-center border rounded-md",
            isMobile ? "gap-0.5 p-0.5" : "gap-1 p-1"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handlePrevYear}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronLeft className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")} />
          </Button>
          <div
            className={cn(
              "flex-1 text-center font-medium",
              isMobile ? "text-[10px]" : "text-sm"
            )}
          >
            {year}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlers.handleNextYear}
            className={cn("h-8 w-8", isMobile && "h-5 w-5")}
          >
            <ChevronRight
              className={cn("h-4 w-4", isMobile && "h-2.5 w-2.5")}
            />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size={size}
            className={cn(
              size === "sm"
                ? "min-w-[120px] lg:min-w-[200px] max-w-[180px] lg:max-w-none text-xs shrink-0"
                : "w-[300px]",
              "justify-start text-left font-normal",
              !date && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon
              className={cn(
                "mr-2 shrink-0",
                size === "sm" ? "h-3 w-3 lg:h-3.5 lg:w-3.5" : "h-4 w-4"
              )}
            />
            <span className={size === "sm" ? "truncate" : ""}>
              {date?.from ? (
                date.to &&
                date.from.getUTCFullYear() === date.to.getUTCFullYear() &&
                date.from.getUTCMonth() === date.to.getUTCMonth() &&
                date.from.getUTCDate() === date.to.getUTCDate() ? (
                  formatUTCDate(
                    date.from,
                    size === "sm" ? "dd MMM yyyy" : "d MMM yyyy"
                  )
                ) : date.to ? (
                  <>
                    {formatUTCDate(
                      date.from,
                      size === "sm" ? "dd MMM yyyy" : "d MMM yyyy"
                    )}{" "}
                    -{" "}
                    {formatUTCDate(
                      date.to,
                      size === "sm" ? "dd MMM yyyy" : "d MMM yyyy"
                    )}
                  </>
                ) : (
                  formatUTCDate(
                    date.from,
                    size === "sm" ? "dd MMM yyyy" : "d MMM yyyy"
                  )
                )
              ) : (
                <span>
                  {size === "sm" ? "Pilih tanggal..." : "Select Date"}
                </span>
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto p-0",
            isMobile
              ? "max-w-[95vw] max-h-[85vh] overflow-y-auto"
              : "max-w-[90vw] lg:max-w-none"
          )}
          align="start"
          side={isMobile ? "left" : "bottom"}
          sideOffset={isMobile ? 4 : 4}
          suppressHydrationWarning
        >
          <div className="border rounded-lg bg-background">
            {/* Quick Presets */}
            <div className={cn(isMobile ? "p-1.5" : "p-3")}>
              <div
                className={cn(
                  "font-medium mb-1.5",
                  isMobile ? "text-[10px] mb-1" : "text-sm mb-2"
                )}
              >
                Quick Select
              </div>
              <div
                className={cn("grid grid-cols-3", isMobile ? "gap-1" : "gap-2")}
              >
                {[
                  { key: "today", label: "Today" },
                  { key: "last7", label: "Last 7 Days" },
                  { key: "lastMonth", label: "Last Month" },
                  { key: "thisMonth", label: "This Month" },
                  { key: "thisYear", label: "This Year" },
                  { key: "custom", label: "Custom" },
                ].map((preset) => (
                  <Button
                    key={preset.key}
                    variant={
                      selectedPreset === preset.key ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handlePresetSelect(preset.key)}
                    className={cn(
                      "justify-start",
                      isMobile && "text-[10px] h-7 px-2"
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom Date Range Selection - Only show when custom mode */}
            {isCustomMode && isMounted && (
              <>
                <DateSelector
                  day={fromDay}
                  month={fromMonth}
                  year={fromYear}
                  handlers={fromHandlers}
                />
                <DateSelector
                  day={toDay}
                  month={toMonth}
                  year={toYear}
                  handlers={toHandlers}
                />
                <Separator />
              </>
            )}

            {/* Set/Clear Buttons - Only show if there are changes */}
            {isMounted && hasChanges && (
              <>
                <Separator />
                <div
                  className={cn(
                    "flex items-center justify-end gap-2",
                    isMobile ? "p-1.5" : "p-3"
                  )}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className={cn(isMobile && "text-[10px] h-7 px-2")}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSet}
                    className={cn(isMobile && "text-[10px] h-7 px-2")}
                  >
                    Set
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
