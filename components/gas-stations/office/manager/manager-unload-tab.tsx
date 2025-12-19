"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { StatusBadge, TankBadge } from "@/components/reusable/badges";
import { ProductBadge } from "@/components/reusable/form";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  approveUnload,
  getPendingUnloads,
  getUnloadHistory,
} from "@/lib/actions/unload.actions";
import type { UnloadWithRelations } from "@/lib/services/unload.service";
import { format } from "date-fns";
import { formatNumber } from "@/lib/utils/format-client";
import { toast } from "sonner";
import {
  nowUTC,
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import { DatePicker } from "@/components/reusable/date-picker";
import type { DateRange } from "react-day-picker";
import { rollbackUnloadApproval } from "@/lib/actions/rollback";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";

type UnloadApprovalTabProps = {
  gasStationId: string;
  active?: boolean;
  userRole?: string;
};

export function UnloadApprovalTab({
  gasStationId,
  active = true,
  userRole,
}: UnloadApprovalTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingUnloads, setPendingUnloads] = useState<UnloadWithRelations[]>(
    []
  );
  const [historyUnloads, setHistoryUnloads] = useState<UnloadWithRelations[]>(
    []
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedUnload, setSelectedUnload] =
    useState<UnloadWithRelations | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [loadingRollback, setLoadingRollback] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Gunakan tanggal lokal user untuk "hari ini"
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)), // Default: last 7 days
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const fetchedGasStationIdRef = useRef<string | null>(null);

  // Check if user can correct unload (DEVELOPER only)
  const canCorrectUnload = userRole
    ? hasPermission(userRole as any, ["DEVELOPER"])
    : false;

  useEffect(() => {
    if (
      active &&
      gasStationId &&
      fetchedGasStationIdRef.current !== gasStationId
    ) {
      fetchedGasStationIdRef.current = gasStationId;
      fetchPendingUnloads();
      fetchHistoryUnloads();
    }
  }, [active, gasStationId]);

  const fetchPendingUnloads = async () => {
    setLoading(true);
    try {
      const result = await getPendingUnloads(gasStationId);
      if (result.success && result.data) {
        setPendingUnloads(result.data as UnloadWithRelations[]);
      } else {
        toast.error(result.message || "Gagal memuat data unload pending");
      }
    } catch (error) {
      console.error("Error fetching pending unloads:", error);
      toast.error("Gagal memuat data unload pending");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryUnloads = async () => {
    setHistoryLoading(true);
    try {
      const result = await getUnloadHistory(gasStationId);
      if (result.success && result.data) {
        setHistoryUnloads(result.data as UnloadWithRelations[]);
      } else {
        toast.error(result.message || "Gagal memuat data history unload");
      }
    } catch (error) {
      console.error("Error fetching history unloads:", error);
      toast.error("Gagal memuat data history unload");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUnload) return;
    setIsProcessing(true);
    try {
      const result = await approveUnload(selectedUnload.id, true);
      if (result.success) {
        setSelectedUnload(null);
        toast.success(result.message);
        await fetchPendingUnloads();
        await fetchHistoryUnloads();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error approving unload:", error);
      toast.error("Failed to process approval");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUnload) return;
    setIsProcessing(true);
    try {
      const result = await approveUnload(selectedUnload.id, false);
      if (result.success) {
        setSelectedUnload(null);
        toast.success(result.message);
        await fetchPendingUnloads();
        await fetchHistoryUnloads();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error rejecting unload:", error);
      toast.error("Failed to process rejection");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDetail = (unload: UnloadWithRelations) => {
    setSelectedUnload(unload);
  };

  return (
    <>
      <div className="space-y-3 lg:space-y-4">
        {/* Pending Unloads */}
        <div className="space-y-1.5 lg:space-y-3">
          <h3 className="text-xs lg:text-sm font-semibold px-1 lg:px-2">
            Pending Unload
          </h3>
          {loading && !pendingUnloads.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : pendingUnloads.length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada unload pending approval
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tank</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Unloader</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUnloads.map((unload) => (
                    <TableRow 
                      key={unload.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetail(unload)}
                    >
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(unload.createdAt),
                          "dd MMM yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{unload.tank.name}</div>
                      </TableCell>
                      <TableCell>
                        <ProductBadge
                          productName={unload.tank.product.name}
                          ron={unload.tank.product.ron}
                          showRON={false}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-blue-600 font-mono">
                          {formatNumber(unload.literAmount)} L
                        </span>
                      </TableCell>
                      <TableCell>
                        {unload.unloader.profile?.name ||
                          unload.unloader.username}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* History Unloads */}
        <div className="space-y-1.5 lg:space-y-3">
          <div className="flex items-center justify-between px-1 lg:px-2">
            <h3 className="text-xs lg:text-sm font-semibold">History Unload</h3>
            <DatePicker
              date={dateRange}
              onSelect={(date) => {
                if (date) {
                  setDateRange(date);
                }
              }}
              size="sm"
            />
          </div>
          {historyLoading && !historyUnloads.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : historyUnloads.filter((unload) => {
              if (!dateRange.from || !dateRange.to) return false;
              const unloadDate = new Date(unload.createdAt);
              return (
                unloadDate >= startOfDayUTC(dateRange.from) &&
                unloadDate <= endOfDayUTC(dateRange.to)
              );
            }).length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada riwayat unload
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tank</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Delivered (L)</TableHead>
                    <TableHead>Real (L)</TableHead>
                    <TableHead>Susut (L)</TableHead>
                    <TableHead>Unloader / Approval</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyUnloads
                    .filter((unload) => {
                      if (!dateRange.from || !dateRange.to) return false;
                      const unloadDate = new Date(unload.createdAt);
                      return (
                        unloadDate >= startOfDayUTC(dateRange.from) &&
                        unloadDate <= endOfDayUTC(dateRange.to)
                      );
                    })
                    .map((unload) => {
                      // Calculate delivered volume (prioritize deliveredVolume, fallback to initialOrderVolume or literAmount)
                      const deliveredVolume = unload.deliveredVolume || 
                        (unload.initialOrderVolume && Number(unload.initialOrderVolume) > 0 
                          ? unload.initialOrderVolume 
                          : unload.literAmount);
                      
                      // Calculate shrinkage
                      const shrinkage = Number(deliveredVolume) - Number(unload.literAmount);
                      
                      return (
                        <TableRow
                          key={unload.id}
                          onClick={() => handleViewDetail(unload)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(
                              new Date(unload.createdAt),
                              "dd MMM yyyy HH:mm"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TankBadge
                                tankCode={unload.tank.code}
                                productName={unload.tank.product.name}
                              />
                              <span className="font-medium">
                                {unload.tank.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ProductBadge
                              productName={unload.tank.product.name}
                              ron={unload.tank.product.ron}
                              showRON={false}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600 font-mono">
                              {formatNumber(deliveredVolume)} L
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-blue-600 font-mono">
                              {formatNumber(unload.literAmount)} L
                            </span>
                          </TableCell>
                          <TableCell>
                            {shrinkage > 0 ? (
                              <span className="font-semibold text-orange-600 font-mono">
                                {formatNumber(shrinkage)} L
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="text-xs lg:text-sm">
                                <span className="text-muted-foreground">Unloader: </span>
                                <span className="font-medium">
                                  {unload.unloader.profile?.name ||
                                    unload.unloader.username}
                                </span>
                              </div>
                              {unload.manager ? (
                                <div className="text-xs lg:text-sm">
                                  <span className="text-muted-foreground">Approval: </span>
                                  <span className="font-medium">
                                    {unload.manager.profile?.name ||
                                      unload.manager.username}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-xs lg:text-sm text-muted-foreground">
                                  Approval: -
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={unload.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Detail & Confirm Dialog */}
      {selectedUnload && (
        <Dialog
          open={!!selectedUnload}
          onOpenChange={(open) => {
            if (!open && !isProcessing) {
              setSelectedUnload(null);
            }
          }}
        >
          <DialogContent
            className="p-2 lg:p-6 max-h-[90vh] flex flex-col"
            showCloseButton={false}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base lg:text-xl">
                Detail Unload
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                {selectedUnload.status === "PENDING"
                  ? "Review detail unload sebelum approve atau reject"
                  : "Detail informasi unload"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 lg:space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Unload Info */}
              <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tank:</span>
                  <span className="font-semibold">
                    {selectedUnload.tank.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <ProductBadge
                    productName={selectedUnload.tank.product.name}
                    ron={selectedUnload.tank.product.ron}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unloader:</span>
                  <span className="font-semibold">
                    {selectedUnload.unloader.profile?.name ||
                      selectedUnload.unloader.username}
                  </span>
                </div>
                {selectedUnload.invoiceNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice:</span>
                    <span className="font-semibold">
                      {selectedUnload.invoiceNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-semibold">
                    {format(
                      new Date(selectedUnload.createdAt),
                      "dd MMM yyyy HH:mm"
                    )}
                  </span>
                </div>
                {selectedUnload.manager && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {selectedUnload.status === "APPROVED"
                        ? "Diapprove Oleh:"
                        : "Direject Oleh:"}
                    </span>
                    <span className="font-semibold">
                      {selectedUnload.manager.profile?.name ||
                        selectedUnload.manager.username}
                    </span>
                  </div>
                )}
                {selectedUnload.manager && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tanggal Approval:</span>
                    <span className="font-semibold">
                      {format(
                        new Date(selectedUnload.updatedAt),
                        "dd MMM yyyy HH:mm"
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <StatusBadge status={selectedUnload.status} />
                </div>
              </div>

              {/* Volume Summary */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 lg:p-3">
                <div className="flex justify-between text-xs lg:text-sm py-1">
                  <span>Jumlah:</span>
                  <span className="font-mono font-semibold text-blue-600">
                    {formatNumber(selectedUnload.literAmount)} L
                  </span>
                </div>
                {/* Show Delivered Volume jika ada (unload biasa) */}
                {selectedUnload.deliveredVolume &&
                  Number(selectedUnload.deliveredVolume) > 0 && (
                    <>
                      <div className="flex justify-between text-xs lg:text-sm py-1 border-t border-blue-200">
                        <span>Delivered Volume:</span>
                        <span className="font-mono font-semibold">
                          {formatNumber(selectedUnload.deliveredVolume)} L
                        </span>
                      </div>
                      {selectedUnload.status === "APPROVED" && (
                        <div className="flex justify-between text-xs lg:text-sm py-1 border-t border-blue-200">
                          <span>Susut Perjalanan:</span>
                          <span className="font-mono font-semibold text-orange-600">
                            {formatNumber(
                              Number(selectedUnload.deliveredVolume) -
                                Number(selectedUnload.literAmount)
                            )}{" "}
                            L
                          </span>
                        </div>
                      )}
                    </>
                  )}
                {/* Show Initial Order Volume jika tidak ada deliveredVolume (legacy) */}
                {!selectedUnload.deliveredVolume &&
                  selectedUnload.initialOrderVolume &&
                  Number(selectedUnload.initialOrderVolume) > 0 && (
                    <>
                      <div className="flex justify-between text-xs lg:text-sm py-1 border-t border-blue-200">
                        <span>Volume Pesanan:</span>
                        <span className="font-mono font-semibold">
                          {formatNumber(selectedUnload.initialOrderVolume)} L
                        </span>
                      </div>
                      {selectedUnload.status === "APPROVED" && (
                        <div className="flex justify-between text-xs lg:text-sm py-1 border-t border-blue-200">
                          <span>Susut Perjalanan:</span>
                          <span className="font-mono font-semibold text-orange-600">
                            {formatNumber(
                              Number(selectedUnload.initialOrderVolume) -
                                Number(selectedUnload.literAmount)
                            )}{" "}
                            L
                          </span>
                        </div>
                      )}
                    </>
                  )}
              </div>

              {/* Image Preview */}
              {selectedUnload.imageUrl && (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="p-2 lg:p-3 border-b bg-gray-50">
                    <span className="text-xs lg:text-sm font-medium">
                      Foto Bukti
                    </span>
                  </div>
                  <div className="p-2 lg:p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImageUrl(selectedUnload.imageUrl || null);
                        setImagePreviewOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 underline text-xs lg:text-sm"
                    >
                      Lihat Foto Bukti
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedUnload.notes && (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="p-2 lg:p-3 border-b bg-gray-50">
                    <span className="text-xs lg:text-sm font-medium">
                      Catatan
                    </span>
                  </div>
                  <div className="p-2 lg:p-3">
                    <p className="text-xs lg:text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedUnload.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-1.5 lg:gap-2 shrink-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUnload(null);
                }}
                disabled={isProcessing}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
              {selectedUnload.status === "PENDING" && (
                <>
                  <Button
                    size="sm"
                    onClick={handleReject}
                    disabled={isProcessing}
                    variant="destructive"
                    className="text-xs lg:text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    variant="default"
                    className="text-xs lg:text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                        Approve
                      </>
                    )}
                  </Button>
                </>
              )}
              {selectedUnload.status === "APPROVED" && canCorrectUnload && (
                <Button
                  size="sm"
                  onClick={() => setRollbackConfirmOpen(true)}
                  disabled={isProcessing || loadingRollback}
                  className="text-xs lg:text-sm bg-black text-red-500 hover:bg-gray-900 hover:text-red-400"
                >
                  <RotateCcw className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                  Rollback Unload
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent
          className="p-2 lg:p-6 max-w-[90vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base lg:text-xl">
              Foto Bukti
            </DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="flex justify-center items-center">
              <img
                src={previewImageUrl}
                alt="Preview bukti unload"
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            </div>
          )}
          <DialogFooter className="shrink-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImagePreviewOpen(false)}
              className="text-xs lg:text-sm"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackConfirmOpen}
        onOpenChange={(open) => {
          if (!loadingRollback) {
            setRollbackConfirmOpen(open);
          }
        }}
      >
        <DialogContent className="p-2 lg:p-6 max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm lg:text-base">
              Konfirmasi Rollback Unload
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin rollback unload ini? Semua transaksi
              terkait akan di-reverse.
            </DialogDescription>
          </DialogHeader>
          {selectedUnload && (
            <div className="space-y-2 lg:space-y-3 overflow-y-auto flex-1 min-h-0">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 lg:p-3 text-xs lg:text-sm text-yellow-800">
                <div className="flex items-start gap-1.5 lg:gap-2">
                  <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold">Peringatan:</div>
                    <div>
                      Rollback akan:
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Reverse transaction UNLOAD</li>
                        <li>
                          Rollback deliveredVolume di purchase transaction
                        </li>
                        <li>Update status unload menjadi REJECTED</li>
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
                  <span className="text-gray-600">Tank:</span>
                  <span className="font-semibold">
                    {selectedUnload.tank.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span className="font-semibold">
                    {selectedUnload.tank.product.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered Volume:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(
                      selectedUnload.deliveredVolume ||
                        selectedUnload.literAmount
                    )}{" "}
                    L
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Real Volume:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(selectedUnload.literAmount)} L
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2 shrink-0 pt-2">
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
                if (!selectedUnload) return;
                setLoadingRollback(true);
                try {
                  const result = await rollbackUnloadApproval(
                    selectedUnload.id
                  );
                  if (result.success) {
                    toast.success(result.message);
                    setSelectedUnload(null);
                    setRollbackConfirmOpen(false);
                    await fetchPendingUnloads();
                    await fetchHistoryUnloads();
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                } catch (error) {
                  console.error("Error rolling back unload:", error);
                  toast.error("Gagal melakukan rollback unload");
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
