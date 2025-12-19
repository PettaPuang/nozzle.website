"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAllShifts } from "@/lib/actions/operator.actions";
import { ShiftBadge } from "@/components/reusable/badges";
import { ShiftVerificationForm } from "./shift-verification-form";
import {
  startOfWeekUTC,
  endOfDayUTC,
  addDaysUTC,
  startOfDayUTC,
  nowUTC,
} from "@/lib/utils/datetime";

type ShiftHistoryTableProps = {
  gasStationId: string;
  active?: boolean;
};

type Shift = {
  id: string;
  operator: {
    id: string;
    username: string;
    profile: { name: string } | null;
  };
  station: {
    name: string;
    code: string;
  };
  date: Date;
  shift: string;
  status: string;
  isVerified: boolean;
  startTime: Date | null;
  endTime: Date | null;
};

export function ShiftHistoryTable({
  gasStationId,
  active = true,
}: ShiftHistoryTableProps) {
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  
  // State untuk current week
  const today = nowUTC();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeekUTC(today, 1)
  );

  const weekEnd = endOfDayUTC(addDaysUTC(currentWeekStart, 6)); // Minggu

  // Generate array tanggal Senin-Minggu
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysUTC(currentWeekStart, i);
    return {
      date,
      dateKey: format(date, "yyyy-MM-dd"),
      label: format(date, "EEEE", { locale: localeId }),
      dateFormatted: format(date, "dd/MM/yyyy", { locale: localeId }),
    };
  });

  useEffect(() => {
    if (active && gasStationId) {
      fetchShifts();
    }
  }, [active, gasStationId, currentWeekStart]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const result = await getAllShifts(
        gasStationId,
        startOfDayUTC(currentWeekStart),
        weekEnd
      );
      if (result.success && result.data) {
        setShifts(result.data as Shift[]);
      }
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDaysUTC(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDaysUTC(currentWeekStart, 7));
  };

  // Group shifts by operator and date
  const shiftsByOperatorAndDate = new Map<
    string,
    Map<string, Shift[]>
  >();

  shifts.forEach((shift) => {
    const operatorId = shift.operator.id;
    const shiftDate = new Date(shift.date);
    const dateKey = format(startOfDayUTC(shiftDate), "yyyy-MM-dd");

    if (!shiftsByOperatorAndDate.has(operatorId)) {
      shiftsByOperatorAndDate.set(operatorId, new Map());
    }

    const operatorShifts = shiftsByOperatorAndDate.get(operatorId)!;
    if (!operatorShifts.has(dateKey)) {
      operatorShifts.set(dateKey, []);
    }

    operatorShifts.get(dateKey)!.push(shift);
  });

  // Get unique operators
  const operators = Array.from(shiftsByOperatorAndDate.keys()).map(
    (operatorId) => {
      const shift = shifts.find((s) => s.operator.id === operatorId);
      return shift!.operator;
    }
  );

  // Sort operators by name
  operators.sort((a, b) => {
    const nameA = a.profile?.name || a.username;
    const nameB = b.profile?.name || b.username;
    return nameA.localeCompare(nameB);
  });

  if (loading) {
    return (
      <div className="text-center py-8 text-xs lg:text-sm text-muted-foreground">
        Memuat data...
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs lg:text-sm text-center min-w-[80px] sticky left-0 bg-white z-10">
              <div className="flex items-center justify-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevWeek}
                  className="h-6 w-6 lg:h-7 lg:w-7"
                >
                  <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextWeek}
                  className="h-6 w-6 lg:h-7 lg:w-7"
                >
                  <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
                </Button>
              </div>
            </TableHead>
            {weekDates.map((weekDate) => (
              <TableHead
                key={weekDate.dateKey}
                className="text-xs lg:text-sm text-center min-w-[100px]"
              >
                <div className="flex flex-col">
                  <span>{weekDate.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {weekDate.dateFormatted}
                  </span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {operators.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-xs lg:text-sm text-center text-muted-foreground py-8"
              >
                Tidak ada data shift
              </TableCell>
            </TableRow>
          ) : (
            operators.map((operator) => {
            const operatorShifts = shiftsByOperatorAndDate.get(operator.id)!;
            const operatorName = operator.profile?.name || operator.username;

            return (
              <TableRow key={operator.id}>
                <TableCell className="text-xs lg:text-sm font-medium sticky left-0 bg-white z-10 min-w-[80px] align-top px-1 lg:px-4">
                  {operatorName}
                </TableCell>
                {weekDates.map((weekDate) => {
                  const dayShifts = operatorShifts.get(weekDate.dateKey) || [];
                  
                  if (dayShifts.length === 0) {
                    return (
                      <TableCell
                        key={weekDate.dateKey}
                        className="text-xs lg:text-sm text-center text-muted-foreground align-top px-1 lg:px-4"
                      >
                        -
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell
                      key={weekDate.dateKey}
                      className="text-xs lg:text-sm align-top text-center px-1 lg:px-4"
                    >
                      <div className="space-y-0.5 lg:space-y-1 flex flex-col items-center">
                        {dayShifts.map((shift) => {
                          const isActive = shift.status === "STARTED";
                          const isVerified = shift.isVerified && shift.status === "COMPLETED";
                          const isUnverified = shift.status === "COMPLETED" && !shift.isVerified;
                          const isDisabled = isActive || isUnverified;

                          return (
                            <div
                              key={shift.id}
                              className={`border rounded p-1 lg:p-1.5 bg-gray-50 w-full transition-all ${
                                isDisabled
                                  ? "opacity-50 cursor-not-allowed"
                                  : "cursor-pointer hover:bg-gray-300"
                              }`}
                              onClick={() => {
                                if (!isDisabled) {
                                  setSelectedShiftId(shift.id);
                                  setFormOpen(true);
                                }
                              }}
                            >
                              <div className="font-semibold text-[10px] lg:text-xs mb-0.5 text-center">
                                {shift.station.code}
                              </div>
                              <div className="mt-0.5 flex justify-center">
                                <ShiftBadge shift={shift.shift} />
                              </div>
                              {shift.startTime && shift.endTime && (
                                <div className="text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 text-center">
                                  {format(new Date(shift.startTime), "HH:mm", {
                                    locale: localeId,
                                  })}{" "}
                                  -{" "}
                                  {format(new Date(shift.endTime), "HH:mm", {
                                    locale: localeId,
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })
          )}
        </TableBody>
      </Table>

      {/* Shift Detail Sheet - View Only */}
      {selectedShiftId && (
        <ShiftVerificationForm
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) {
              setSelectedShiftId(null);
            }
          }}
          shiftId={selectedShiftId}
          mode="sheet"
          viewOnly={true}
          onVerified={(shiftId) => {
            // Refresh history table setelah unverify/delete
            fetchShifts();
          }}
        />
      )}
    </div>
  );
}

