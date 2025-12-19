"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatNumber } from "@/lib/utils/format-client";
import {
  getShiftWithSales,
  getShiftsToVerify,
  deleteOperatorShift,
  checkShiftCanBeVerified,
} from "@/lib/actions/operator.actions";
import { ShiftBadge } from "@/components/reusable/badges";
import { CheckCircle2, Trash2, Loader2, Menu } from "lucide-react";
import type { DepositWithDetails } from "@/lib/services/finance.service";
import { ShiftVerificationForm } from "./shift-verification-form";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { hasPermission, ROLES } from "@/lib/utils/permissions";

type ShiftVerificationTableProps = {
  gasStationId: string;
  onVerified?: (shiftId: string) => void;
};

type ShiftWithNozzleDetails = {
  id: string;
  operatorShiftId: string;
  operator: {
    username: string;
    profile: { name: string } | null;
  };
  date: Date;
  station: {
    name: string;
  };
  shift: string;
  startTime: Date | null;
  endTime: Date | null;
  nozzleDetails: Array<{
    nozzleId: string;
    nozzleCode: string;
    productName: string;
    openReading: number;
    closeReading: number;
    salesVolume?: number;
  }>;
};

export function ShiftVerificationTable({
  gasStationId,
  onVerified,
}: ShiftVerificationTableProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.roleCode;
  const canDelete = hasPermission(userRole as any, [
    ROLES.ADMINISTRATOR,
    ROLES.DEVELOPER,
  ]);

  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<ShiftWithNozzleDetails[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<ShiftWithNozzleDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const result = await getShiftsToVerify(gasStationId);
      if (result.success && result.data) {
        const shiftsToVerify = result.data as any[];

        // Fetch shift data untuk setiap shift
        const shiftDataPromises = shiftsToVerify.map((shift) =>
          getShiftWithSales(shift.id)
        );
        const shiftDataResults = await Promise.all(shiftDataPromises);

        const validShifts = shiftDataResults
          .filter((r) => r.success && r.data)
          .map((r, index) => {
            const shiftData = r.data as any;
            const shift = shiftsToVerify[index];
            return {
              id: shiftData.id,
              operatorShiftId: shiftData.id,
              operator: shift.operator || {
                username: "",
                profile: null,
              },
              date: shift.date,
              station: shift.station || { name: "" },
              shift: shift.shift,
              startTime: shift.startTime || null,
              endTime: shift.endTime || null,
              nozzleDetails: shiftData.nozzleDetails || [],
            };
          });

        setShifts(validShifts);
      }
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasStationId]);

  const handleOpenForm = async (shiftId: string) => {
    // Validasi sequential sebelum membuka form
    const checkResult = await checkShiftCanBeVerified(shiftId);
    if (!checkResult.success) {
      toast.error(checkResult.message || "Tidak bisa verify shift ini");
      return;
    }

    setSelectedShiftId(shiftId);
    setFormOpen(true);
  };

  const handleFormVerified = (shiftId: string) => {
    onVerified?.(shiftId);
    setFormOpen(false);
    setSelectedShiftId(null);
    // Refresh shifts - verified shift will no longer appear (hasDeposit = true)
    fetchShifts();
  };

  const handleOpenDeleteConfirm = (shift: ShiftWithNozzleDetails) => {
    setShiftToDelete(shift);
    setDeleteConfirmOpen(true);
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setDeleteConfirmOpen(false);
      setShiftToDelete(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!shiftToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteOperatorShift(shiftToDelete.id);
      if (result.success) {
        toast.success(result.message || "Shift berhasil dihapus");
        setDeleteConfirmOpen(false);
        setShiftToDelete(null);
        fetchShifts();
      } else {
        toast.error(result.message || "Gagal menghapus shift");
      }
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast.error("Gagal menghapus shift");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-xs lg:text-sm text-muted-foreground">
        Memuat data...
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="rounded-lg border p-3 lg:p-6 text-center">
        <p className="text-xs lg:text-sm text-muted-foreground">
          Tidak ada shift yang perlu diverifikasi
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs lg:text-sm">Operator</TableHead>
              <TableHead className="text-xs lg:text-sm">Tanggal</TableHead>
              <TableHead className="text-xs lg:text-sm">Station</TableHead>
              <TableHead className="text-xs lg:text-sm">Shift</TableHead>
              <TableHead className="text-xs lg:text-sm">Nozzle</TableHead>
              <TableHead className="text-xs lg:text-sm text-right w-[100px]">
                Buka
              </TableHead>
              <TableHead className="text-xs lg:text-sm text-right w-[100px]">
                Tutup
              </TableHead>
              <TableHead className="text-xs lg:text-sm text-right w-[100px]">
                Jumlah Liter
              </TableHead>
              <TableHead className="text-xs lg:text-sm text-center w-[80px]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift, shiftIndex) => {
              if (shift.nozzleDetails.length === 0) {
                return (
                  <TableRow key={shift.id}>
                    <TableCell className="text-xs lg:text-sm font-medium">
                      {shift.operator.profile?.name || shift.operator.username}
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm">
                      {format(new Date(shift.date), "dd MMM yyyy", {
                        locale: localeId,
                      })}
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm">
                      {shift.station.name}
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm">
                      <div className="space-y-1">
                        <ShiftBadge shift={shift.shift} />
                        {shift.startTime && shift.endTime && (
                          <div className="text-[10px] lg:text-xs text-muted-foreground">
                            {format(new Date(shift.startTime), "HH:mm", {
                              locale: localeId,
                            })}{" "}
                            s/d{" "}
                            {format(new Date(shift.endTime), "HH:mm", {
                              locale: localeId,
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm text-muted-foreground text-right">
                      -
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm text-muted-foreground text-right">
                      -
                    </TableCell>
                    <TableCell className="text-xs lg:text-sm text-muted-foreground text-right">
                      -
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Menu className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleOpenForm(shift.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Verifikasi
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => handleOpenDeleteConfirm(shift)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              }

              return shift.nozzleDetails.map((nozzle, nozzleIndex) => (
                <TableRow key={`${shift.id}-${nozzle.nozzleId}`}>
                  {nozzleIndex === 0 && (
                    <>
                      <TableCell
                        rowSpan={shift.nozzleDetails.length}
                        className="text-xs lg:text-sm font-medium"
                      >
                        {shift.operator.profile?.name ||
                          shift.operator.username}
                      </TableCell>
                      <TableCell
                        rowSpan={shift.nozzleDetails.length}
                        className="text-xs lg:text-sm"
                      >
                        {format(new Date(shift.date), "dd MMM yyyy", {
                          locale: localeId,
                        })}
                      </TableCell>
                      <TableCell
                        rowSpan={shift.nozzleDetails.length}
                        className="text-xs lg:text-sm"
                      >
                        {shift.station.name}
                      </TableCell>
                      <TableCell
                        rowSpan={shift.nozzleDetails.length}
                        className="text-xs lg:text-sm"
                      >
                        <div className="space-y-1">
                          <ShiftBadge shift={shift.shift} />
                          {shift.startTime && shift.endTime && (
                            <div className="text-[10px] lg:text-xs text-muted-foreground">
                              {format(new Date(shift.startTime), "HH:mm", {
                                locale: localeId,
                              })}{" "}
                              s/d{" "}
                              {format(new Date(shift.endTime), "HH:mm", {
                                locale: localeId,
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-xs lg:text-sm font-semibold">
                    {nozzle.nozzleCode}
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm text-right">
                    <span className="font-mono">
                      {formatNumber(Math.round(nozzle.openReading))}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm text-right">
                    <span className="font-mono">
                      {formatNumber(Math.round(nozzle.closeReading))}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm text-right">
                    <span className="font-mono">
                      {formatNumber(
                        Math.round(
                          nozzle.salesVolume ??
                            Math.max(
                              0,
                              nozzle.closeReading - nozzle.openReading
                            )
                        )
                      )}
                    </span>
                  </TableCell>
                  {nozzleIndex === 0 && (
                    <TableCell
                      rowSpan={shift.nozzleDetails.length}
                      className="text-center"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Menu className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleOpenForm(shift.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Verifikasi
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => handleOpenDeleteConfirm(shift)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>

      {/* Verification Form */}
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
          onVerified={handleFormVerified}
          mode="sheet"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={handleCancelDelete}>
        <DialogContent
          showCloseButton={!isDeleting}
          className="sm:max-w-[425px]"
        >
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Shift</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus shift ini? Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {shiftToDelete && (
            <div className="space-y-3">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <div className="font-semibold mb-2">⚠️ Peringatan:</div>
                <div>
                  Menghapus shift akan:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Menghapus semua nozzle readings</li>
                    <li>Menghapus deposit (jika ada)</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Operator:</span>
                  <span className="font-semibold">
                    {shiftToDelete.operator.profile?.name ||
                      shiftToDelete.operator.username}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-semibold">
                    {format(new Date(shiftToDelete.date), "dd MMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift:</span>
                  <ShiftBadge shift={shiftToDelete.shift} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Station:</span>
                  <span className="font-semibold">
                    {shiftToDelete.station.name}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Ya, Hapus"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
