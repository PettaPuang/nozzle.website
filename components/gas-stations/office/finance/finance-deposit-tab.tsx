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
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { ImageIcon } from "lucide-react";
import {
  getPendingDeposits,
  getDepositHistory,
} from "@/lib/actions/finance.actions";
import { getTitipanCOAs } from "@/lib/actions/coa.actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatCurrency, formatNumber } from "@/lib/utils/format-client";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import type { DepositWithDetails } from "@/lib/services/finance.service";
import {
  ShiftBadge,
  StatusBadge,
  PaymentMethodBadge,
  getPaymentMethodLabel,
  ProductBadge,
} from "@/components/reusable/badges";
import { DepositInputSheet } from "@/components/gas-stations/office/finance/deposit-input-form";
import type { DateRange } from "react-day-picker";
import { DepositInputTable } from "./deposit-input-table";
import { DepositHistoryTable } from "./deposit-history-table";

type FinanceDepositTabProps = {
  gasStationId: string;
  active?: boolean;
  userRole?: string;
};

export function FinanceDepositTab({
  gasStationId,
  active = true,
  userRole,
}: FinanceDepositTabProps) {
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
  const [depositSheetOpen, setDepositSheetOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [titipanCOAs, setTitipanCOAs] = useState<Array<{ id: string; name: string }>>([]);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const fetchedGasStationIdRef = useRef<string | null>(null);

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
        // Filter untuk input deposit:
        // 1. Shifts yang sudah diverifikasi tapi belum ada deposit (hasDeposit = false)
        // 2. Deposit dengan status PENDING (hasDeposit = true && status = PENDING)
        // 3. Deposit dengan status REJECTED (hasDeposit = true && status = REJECTED) - bisa diinput ulang
        const inputDeposits = (
          pendingResult.data as DepositWithDetails[]
        ).filter(
          (d) =>
            !d.hasDeposit ||
            (d.hasDeposit &&
              (d.status === "PENDING" || d.status === "REJECTED"))
        );
        setPendingDeposits(inputDeposits);
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

  const handleInputDeposit = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setDepositSheetOpen(true);
  };

  const handleOpenDetail = (deposit: DepositWithDetails) => {
    setSelectedDeposit(deposit);
    setDetailDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-6 lg:space-y-8">
        {loading && !pendingDeposits.length && !historyDeposits.length ? (
          <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            {/* Deposit Input Table */}
            <div>
              <h3 className="text-xs lg:text-sm font-semibold mb-1.5 lg:mb-3">
                Input Deposit
              </h3>
              <DepositInputTable
                deposits={pendingDeposits}
                onInputDeposit={handleInputDeposit}
                userRole={userRole}
              />
            </div>

            {/* Deposit History Table */}
            <div>
              <DepositHistoryTable
                deposits={historyDeposits}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onViewDetail={handleOpenDetail}
                hideActionColumn={true}
              />
            </div>
          </>
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

                  {/* Deposit Summary */}
                  <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                    {/* Rincian Pembayaran - dipindahkan ke atas */}
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

                  {/* Show notes if exists - hanya untuk view, tidak ada input */}
                  {selectedDeposit.notes && (
                    <div className="space-y-1.5 lg:space-y-2 pt-2 lg:pt-3 border-t">
                      <p className="text-xs lg:text-sm font-medium">Catatan:</p>
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
                }}
                disabled={loading}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Deposit Input Sheet */}
      {selectedShiftId && (
        <DepositInputSheet
          open={depositSheetOpen}
          onOpenChange={(open) => {
            setDepositSheetOpen(open);
            if (!open) {
              setSelectedShiftId(null);
              fetchDeposits();
            }
          }}
          shiftId={selectedShiftId}
          onSuccess={() => {
            fetchDeposits();
          }}
        />
      )}
    </>
  );
}
