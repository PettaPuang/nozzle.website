"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import {
  CheckCircle,
  XCircle,
  Eye,
  RotateCcw,
  Loader2,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";
import { verifyDeposit } from "@/lib/actions/deposit.actions";
import {
  getPendingDeposits,
  getDepositHistory,
} from "@/lib/actions/finance.actions";
import { getTitipanCOAs } from "@/lib/actions/coa.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import { formatCurrency, formatNumber } from "@/lib/utils/format-client";
import type { DepositWithDetails } from "@/lib/services/finance.service";
import {
  ShiftBadge,
  StatusBadge,
  getPaymentMethodLabel,
  ProductBadge,
} from "@/components/reusable/badges";
import type { DateRange } from "react-day-picker";
import { DatePicker } from "@/components/reusable/date-picker";
import { rollbackDepositApproval } from "@/lib/actions/rollback";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import { DepositHistoryTable } from "@/components/gas-stations/office/finance/deposit-history-table";

type ManagerDepositTabProps = {
  gasStationId: string;
  active?: boolean;
  userRole?: string;
};

export function ManagerDepositTab({
  gasStationId,
  active = true,
  userRole,
}: ManagerDepositTabProps) {
  const [loading, setLoading] = useState(false);
  const [pendingDeposits, setPendingDeposits] = useState<DepositWithDetails[]>(
    []
  );
  const [historyDeposits, setHistoryDeposits] = useState<DepositWithDetails[]>(
    []
  );
  const [selectedDeposit, setSelectedDeposit] =
    useState<DepositWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingRollback, setLoadingRollback] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [titipanCOAs, setTitipanCOAs] = useState<Array<{ id: string; name: string }>>([]);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  // For pending, show all data (no date filter)
  const [pendingDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -3650)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const router = useRouter();
  const fetchedGasStationIdRef = useRef<string | null>(null);

  // Check if user can rollback (DEVELOPER atau ADMINISTRATOR)
  const canRollback = userRole === "DEVELOPER" || userRole === "ADMINISTRATOR";

  useEffect(() => {
    if (
      active &&
      gasStationId &&
      fetchedGasStationIdRef.current !== gasStationId
    ) {
      fetchedGasStationIdRef.current = gasStationId;
      fetchDeposits();
      
      // Fetch titipan COAs
      getTitipanCOAs(gasStationId).then((result) => {
        if (result.success && result.data) {
          setTitipanCOAs(result.data);
        }
      });
    }
  }, [active, gasStationId]);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const [pendingResult, historyResult] = await Promise.all([
        getPendingDeposits(gasStationId),
        getDepositHistory(gasStationId),
      ]);

      if (pendingResult.success && pendingResult.data) {
        // Filter hanya deposit yang sudah ada (hasDeposit = true) untuk approval
        const depositsWithData = (
          pendingResult.data as DepositWithDetails[]
        ).filter((d) => d.hasDeposit);
        setPendingDeposits(depositsWithData);
      }
      if (historyResult.success && historyResult.data) {
        setHistoryDeposits(historyResult.data as DepositWithDetails[]);
      }
    } catch (error) {
      console.error("Error fetching deposits:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (deposit: DepositWithDetails) => {
    setSelectedDeposit(deposit);
    setDetailDialogOpen(true);
  };

  const handleVerify = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedDeposit) return;

    setLoading(true);
    try {
      const result = await verifyDeposit({
        depositId: selectedDeposit.id,
        status,
        adminReceivedAmount: undefined,
        notes,
      });

      if (result.success) {
        toast.success(result.message);
        // Wait a bit before closing to show success feedback
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDetailDialogOpen(false);
        setSelectedDeposit(null);
        setNotes("");
        router.refresh();
        fetchDeposits();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        {loading && !pendingDeposits.length && !historyDeposits.length ? (
          <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="space-y-3 lg:space-y-6">
            {/* Pending Deposits Table */}
            <DepositHistoryTable
              deposits={pendingDeposits}
              dateRange={pendingDateRange}
              onDateRangeChange={() => {}} // No date change for pending
              onViewDetail={handleOpenDetail}
              includePending={true}
              title="Pending Deposits"
              hideTitle={false}
              hideDatePicker={true}
              hideActionColumn={true}
            />

            {/* History Table */}
            <DepositHistoryTable
              deposits={historyDeposits}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onViewDetail={handleOpenDetail}
              hideActionColumn={true}
            />
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedDeposit && (
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent
            className="p-2 lg:p-6 max-w-[90vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto"
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle className="text-base lg:text-xl">
                Detail Deposit
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                {selectedDeposit &&
                  format(
                    new Date(selectedDeposit.operatorShift.date),
                    "dd MMMM yyyy",
                    { locale: localeId }
                  )}{" "}
                - {selectedDeposit?.operatorShift.station.name}
              </DialogDescription>
            </DialogHeader>

            {selectedDeposit && (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-3 lg:space-y-4">
                  {/* Operator Info */}
                  <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Operator:</span>
                      <span className="font-medium">
                        {selectedDeposit.operatorShift.operator.profile?.name ||
                          selectedDeposit.operatorShift.operator.username}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tanggal:</span>
                      <span className="font-medium">
                        {format(
                          new Date(selectedDeposit.operatorShift.date),
                          "dd MMM yyyy",
                          { locale: localeId }
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shift:</span>
                      <div className="flex items-center gap-1.5 lg:gap-2">
                        <ShiftBadge
                          shift={selectedDeposit.operatorShift.shift}
                        />
                        {selectedDeposit.operatorShift.startTime &&
                          selectedDeposit.operatorShift.endTime && (
                            <span className="text-[10px] lg:text-xs text-gray-500">
                              {format(
                                new Date(
                                  selectedDeposit.operatorShift.startTime
                                ),
                                "HH:mm"
                              )}{" "}
                              -{" "}
                              {format(
                                new Date(selectedDeposit.operatorShift.endTime),
                                "HH:mm"
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Station:</span>
                      <span className="font-medium">
                        {selectedDeposit.operatorShift.station.name}
                      </span>
                    </div>
                  </div>

                  {/* Detail Nozzle Table */}
                  {selectedDeposit.nozzleDetails &&
                    selectedDeposit.nozzleDetails.length > 0 && (
                      <div className="rounded-lg border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px] text-xs lg:text-sm">
                                Nozzle
                              </TableHead>
                              <TableHead className="text-xs lg:text-sm">
                                Produk
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Awal
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Akhir
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Pump Test
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Volume
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Harga
                              </TableHead>
                              <TableHead className="text-right text-xs lg:text-sm">
                                Total
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedDeposit.nozzleDetails.map((nozzle) => (
                              <TableRow key={nozzle.nozzleId}>
                                <TableCell className="font-semibold text-xs lg:text-sm">
                                  {nozzle.nozzleCode}
                                </TableCell>
                                <TableCell>
                                  <ProductBadge
                                    productName={nozzle.productName}
                                  />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                                  {formatNumber(Math.round(nozzle.openReading))}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                                  {formatNumber(
                                    Math.round(nozzle.closeReading)
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                                  {formatNumber(
                                    Math.round(nozzle.pumpTest || 0)
                                  )}{" "}
                                  L
                                </TableCell>
                                <TableCell className="text-right font-medium text-xs lg:text-sm">
                                  <span className="font-mono">
                                    {formatNumber(
                                      Math.round(nozzle.salesVolume)
                                    )}
                                  </span>{" "}
                                  L
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs lg:text-sm">
                                  {formatCurrency(nozzle.pricePerLiter)}
                                </TableCell>
                                <TableCell className="text-right font-bold font-mono text-xs lg:text-sm">
                                  {formatCurrency(nozzle.totalAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-right font-bold text-xs lg:text-sm"
                              >
                                Total
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs lg:text-sm font-mono">
                                {formatCurrency(
                                  selectedDeposit.totalSales ||
                                    selectedDeposit.totalAmount
                                )}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    )}

                  {/* Foto Totalisator */}
                  {selectedDeposit.nozzleDetails &&
                    selectedDeposit.nozzleDetails.length > 0 &&
                    (() => {
                      // Group foto berdasarkan imageUrl yang sama
                      const openImageMap = new Map<
                        string,
                        Array<{ nozzleCode: string; productName: string }>
                      >();
                      const closeImageMap = new Map<
                        string,
                        Array<{ nozzleCode: string; productName: string }>
                      >();

                      selectedDeposit.nozzleDetails.forEach((nozzle) => {
                        if (nozzle.openImageUrl) {
                          const url = nozzle.openImageUrl;
                          if (!openImageMap.has(url)) {
                            openImageMap.set(url, []);
                          }
                          openImageMap.get(url)!.push({
                            nozzleCode: nozzle.nozzleCode,
                            productName: nozzle.productName,
                          });
                        }
                        if (nozzle.closeImageUrl) {
                          const url = nozzle.closeImageUrl;
                          if (!closeImageMap.has(url)) {
                            closeImageMap.set(url, []);
                          }
                          closeImageMap.get(url)!.push({
                            nozzleCode: nozzle.nozzleCode,
                            productName: nozzle.productName,
                          });
                        }
                      });

                      const hasImages =
                        openImageMap.size > 0 || closeImageMap.size > 0;
                      if (!hasImages) return null;

                      const renderImageGroup = (
                        title: string,
                        imageMap: Map<string, Array<{ nozzleCode: string; productName: string }>>,
                        type: "open" | "close"
                      ) => {
                        const entries = Array.from(imageMap.entries());
                        if (entries.length === 0) return null;

                        return (
                          <div>
                            <div className="text-[10px] lg:text-xs text-muted-foreground mb-1.5 lg:mb-2">
                              {title}
                            </div>
                            <div className="space-y-1 lg:space-y-1.5">
                              {entries.map(([imageUrl, nozzles]) => {
                                const photoName = `Foto ${type === "open" ? "Open" : "Close"} (${nozzles.length > 1
                                  ? `${nozzles.length} Nozzle: ${nozzles
                                      .map((n) => n.nozzleCode)
                                      .join(", ")}`
                                  : `${nozzles[0].nozzleCode} - ${nozzles[0].productName}`})`;
                                return (
                                  <Dialog key={`${type}-${imageUrl}`}>
                                    <DialogTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex items-center gap-1 lg:gap-1.5 text-blue-600 hover:underline flex-1 text-left text-xs lg:text-sm p-1 lg:p-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                                      >
                                        <ImageIcon className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                                        <span className="truncate">{photoName}</span>
                                      </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[95vw] lg:max-w-4xl p-0 overflow-hidden">
                                      <DialogTitle className="sr-only">
                                        Totalisator {type === "open" ? "Pembukaan" : "Penutupan"} -{" "}
                                        {nozzles.length > 1
                                          ? `${
                                              nozzles.length
                                            } Nozzle: ${nozzles
                                              .map((n) => n.nozzleCode)
                                              .join(", ")}`
                                          : `${nozzles[0].nozzleCode} - ${nozzles[0].productName}`}
                                      </DialogTitle>
                                      <div className="relative w-full h-[60vh] lg:h-[70vh]">
                                        <Image
                                          src={imageUrl}
                                          alt={`Totalisator ${type === "open" ? "pembukaan" : "penutupan"} ${nozzles
                                            .map((n) => n.nozzleCode)
                                            .join(", ")}`}
                                          fill
                                          className="object-contain"
                                          unoptimized
                                        />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                );
                              })}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className="rounded-lg border bg-white p-2 lg:p-4">
                          <h4 className="font-semibold text-xs lg:text-sm mb-2 lg:mb-3">
                            Foto Totalisator
                          </h4>
                          <div className="grid grid-cols-2 gap-1.5 lg:gap-4">
                            {renderImageGroup("Pembukaan (Check In)", openImageMap, "open")}
                            {renderImageGroup("Penutupan (Check Out)", closeImageMap, "close")}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Deposit Summary */}
                  <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                    {/* Rincian Pembayaran */}
                    {selectedDeposit.depositDetails &&
                      selectedDeposit.depositDetails.length > 0 && (
                        <div className="pb-1.5 lg:pb-2 border-b">
                          <div className="text-gray-600 mb-1 lg:mb-1.5 font-semibold">
                            Rincian Pembayaran:
                          </div>
                          <div className="space-y-1 lg:space-y-1.5">
                            {selectedDeposit.depositDetails.map(
                              (detail, index) => (
                                <div
                                  key={detail.id || index}
                                  className="flex justify-between"
                                >
                                  <span className="text-gray-600">
                                    {detail.paymentAccount === "CASH"
                                      ? "Cash"
                                      : "Bank"}
                                    {detail.paymentMethod &&
                                      ` - ${getPaymentMethodLabel(
                                        detail.paymentMethod
                                      )}`}
                                    {detail.bankName && ` (${detail.bankName})`}
                                  </span>
                                  <span className="font-semibold font-mono">
                                    {formatCurrency(detail.operatorAmount)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Parse free fuel dan titipan products dari notes */}
                    {(() => {
                      const notes = selectedDeposit.notes || "";
                      let freeFuelAmount = 0;
                      let freeFuelReason: string | undefined = undefined;
                      let titipanProducts: Array<{ coaId: string; amount: number }> = [];

                      const freeFuelMatch = notes.match(
                        /Free Fuel \(Rp ([\d.,]+)\): (.+)/
                      );
                      if (freeFuelMatch) {
                        freeFuelAmount = parseFloat(
                          freeFuelMatch[1].replace(/\./g, "").replace(",", ".")
                        );
                        freeFuelReason = freeFuelMatch[2];
                      }

                      // Parse titipanProducts dari notes (format: TITIPAN_PRODUCTS_JSON:...)
                      const titipanProductsMatch = notes.match(
                        /TITIPAN_PRODUCTS_JSON:(.+?)(?:\n\n|$)/
                      );
                      if (titipanProductsMatch) {
                        try {
                          titipanProducts = JSON.parse(titipanProductsMatch[1]);
                        } catch (error) {
                          console.error("Error parsing titipanProducts from notes:", error);
                        }
                      }

                      const totalPayment = selectedDeposit.depositDetails
                        ? selectedDeposit.depositDetails.reduce(
                            (sum, detail) => sum + detail.operatorAmount,
                            0
                          )
                        : 0;
                      const totalSales =
                        selectedDeposit.totalSales ||
                        selectedDeposit.totalAmount;
                      const selisihPayment = totalPayment - totalSales;
                      const titipanTotal = titipanProducts.reduce((sum, t) => sum + (t.amount || 0), 0);
                      const totalSetoran =
                        totalPayment + freeFuelAmount + titipanTotal;
                      const selisihFinal = totalSetoran - totalSales;

                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Sales:</span>
                            <span className="font-semibold font-mono">
                              {formatCurrency(totalSales)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Total Setoran:
                            </span>
                            <span className="font-semibold font-mono">
                              {formatCurrency(totalPayment)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between">
                            <span className="text-gray-600">Selisih:</span>
                            <span
                              className={`font-semibold font-mono ${
                                Math.abs(selisihPayment) < 0.01
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(selisihPayment)}
                            </span>
                          </div>
                          {freeFuelAmount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Free Fuel:</span>
                              <span className="font-semibold font-mono text-orange-600">
                                {formatCurrency(freeFuelAmount)}
                              </span>
                            </div>
                          )}
                          {titipanProducts.map((titipan, index) => {
                            const coa = titipanCOAs.find((c) => c.id === titipan.coaId);
                            return titipan.amount > 0 ? (
                              <div key={index} className="flex justify-between">
                                <span className="text-gray-600">
                                  {coa?.name || "Titipan"}:
                                </span>
                                <span className="font-semibold font-mono text-blue-600">
                                  {formatCurrency(titipan.amount)}
                                </span>
                              </div>
                            ) : null;
                          })}
                          <Separator />
                          <div className="flex justify-between font-bold">
                            <span>Selisih:</span>
                            <span
                              className={`font-mono ${
                                Math.abs(selisihFinal) < 0.01
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(selisihFinal)}
                            </span>
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex justify-between pt-1.5 lg:pt-2 border-t">
                      <span className="text-gray-600">Declared Amount:</span>
                      <span className="font-semibold text-blue-600 font-mono">
                        {formatCurrency(selectedDeposit.operatorDeclaredAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <StatusBadge status={selectedDeposit.status} />
                    </div>
                  </div>

                  {/* Admin Input - Only show for PENDING status */}
                  {selectedDeposit.status === "PENDING" && (
                    <div className="space-y-2 lg:space-y-3 pt-2 lg:pt-3 border-t">
                      <div>
                        <Label htmlFor="notes" className="text-xs lg:text-sm">
                          Catatan (Opsional)
                        </Label>
                        <div className="mt-1.5 lg:mt-2">
                          <Textarea
                            id="notes"
                            placeholder="Tambahkan catatan..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="text-xs lg:text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show notes if exists for verified/rejected */}
                  {selectedDeposit.status !== "PENDING" &&
                    selectedDeposit.notes && (
                      <div className="space-y-1.5 lg:space-y-2 pt-2 lg:pt-3 border-t">
                        <p className="text-xs lg:text-sm font-medium">
                          Catatan:
                        </p>
                        <p className="text-xs lg:text-sm text-muted-foreground bg-gray-50 p-2 lg:p-2.5 rounded">
                          {selectedDeposit.notes}
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-1.5 lg:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDetailDialogOpen(false);
                  setSelectedDeposit(null);
                  setNotes("");
                }}
                disabled={loading}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
              {selectedDeposit?.status === "APPROVED" && canRollback && (
                <Button
                  size="sm"
                  onClick={() => setRollbackConfirmOpen(true)}
                  disabled={loading || loadingRollback}
                  className="text-xs lg:text-sm bg-black text-red-500 hover:bg-gray-900 hover:text-red-400"
                >
                  <RotateCcw className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                  Rollback Deposit
                </Button>
              )}
              {selectedDeposit?.status === "PENDING" &&
                hasPermission(userRole as RoleCode, [
                  "MANAGER",
                  "ADMINISTRATOR",
                  "DEVELOPER",
                ]) && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleVerify("REJECTED")}
                      disabled={loading}
                      className="gap-1.5 lg:gap-2 text-xs lg:text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 lg:h-4 lg:w-4" />
                          Tolak
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleVerify("APPROVED")}
                      disabled={loading}
                      className="gap-1.5 lg:gap-2 text-xs lg:text-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4" />
                          Verifikasi
                        </>
                      )}
                    </Button>
                  </>
                )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackConfirmOpen}
        onOpenChange={(open) => {
          if (!loadingRollback) {
            setRollbackConfirmOpen(open);
          }
        }}
      >
        <DialogContent className="p-2 lg:p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm lg:text-base">
              Konfirmasi Rollback Deposit
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin rollback deposit ini? Semua transaksi
              terkait akan di-reverse.
            </DialogDescription>
          </DialogHeader>
          {selectedDeposit && (
            <div className="space-y-2 lg:space-y-3">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 lg:p-3 text-xs lg:text-sm text-yellow-800">
                <div className="flex items-start gap-1.5 lg:gap-2">
                  <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold">Peringatan:</div>
                    <div>
                      Rollback akan:
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Reverse transaction REVENUE</li>
                        <li>Reverse transaction COGS</li>
                        <li>Update status deposit menjadi REJECTED</li>
                      </ul>
                    </div>
                    <div className="font-semibold mt-1">
                      Tindakan ini tidak dapat dibatalkan!
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sales:</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(selectedDeposit.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Admin Received:</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(
                      selectedDeposit.adminReceivedAmount ||
                        selectedDeposit.totalAmount
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Operator Declared:</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(selectedDeposit.operatorDeclaredAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRollbackConfirmOpen(false)}
              disabled={loadingRollback}
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!selectedDeposit) return;
                setLoadingRollback(true);
                try {
                  const result = await rollbackDepositApproval(
                    selectedDeposit.id
                  );
                  if (result.success) {
                    toast.success(result.message);
                    setSelectedDeposit(null);
                    setDetailDialogOpen(false);
                    setRollbackConfirmOpen(false);
                    await fetchDeposits();
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                } catch (error) {
                  console.error("Error rolling back deposit:", error);
                  toast.error("Gagal melakukan rollback deposit");
                } finally {
                  setLoadingRollback(false);
                }
              }}
              disabled={loadingRollback}
              className="text-xs lg:text-sm bg-black text-red-500 hover:bg-gray-900 hover:text-red-400"
            >
              {loadingRollback ? (
                <>
                  <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                  Ya, Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
