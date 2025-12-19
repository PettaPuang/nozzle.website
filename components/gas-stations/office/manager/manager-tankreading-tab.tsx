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
  approveTankReading,
  getPendingTankReadings,
  getTankReadingHistory,
} from "@/lib/actions/tank-reading.actions";
import { rollbackTankReadingApproval } from "@/lib/actions/rollback";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import type { TankReadingWithRelations } from "@/lib/services/tank-reading.service";
import { format } from "date-fns";
import {
  startOfDayUTC,
  endOfDayUTC,
  nowUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import { formatNumber } from "@/lib/utils/format-client";
import { toast } from "sonner";
import { DatePicker } from "@/components/reusable/date-picker";
import type { DateRange } from "react-day-picker";

type TankReadingApprovalTabProps = {
  gasStationId: string;
  active?: boolean;
  userRole?: string;
};

type TankReadingForClient = {
  id: string;
  tankId: string;
  literValue: number;
  imageUrl: string | null;
  notes: string | null;
  loaderId: string;
  approverId: string | null;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  realtimeStock?: number;
  stockOpen?: number;
  tank: {
    id: string;
    code: string;
    name: string;
    product: {
      id: string;
      name: string;
      purchasePrice: number;
      ron: number | null;
    };
  };
  loader: {
    id: string;
    username: string;
    email: string;
    profile: {
      name: string;
    } | null;
  };
  approver: {
    id: string;
    username: string;
    email: string;
    profile: {
      name: string;
    } | null;
  } | null;
};

export function TankReadingApprovalTab({
  gasStationId,
  active = true,
  userRole,
}: TankReadingApprovalTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingReadings, setPendingReadings] = useState<
    TankReadingForClient[]
  >([]);
  const [historyReadings, setHistoryReadings] = useState<
    TankReadingForClient[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedReading, setSelectedReading] =
    useState<TankReadingForClient | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [loadingRollback, setLoadingRollback] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);

  // Check if user can rollback (DEVELOPER only)
  const canRollback = userRole
    ? hasPermission(userRole as RoleCode, ["DEVELOPER"])
    : false;
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Gunakan tanggal lokal user untuk "hari ini"
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)), // Default: last 7 days
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
      fetchPendingReadings();
      fetchHistoryReadings();
    }
  }, [active, gasStationId]);

  const fetchPendingReadings = async () => {
    setLoading(true);
    try {
      const result = await getPendingTankReadings(gasStationId);
      if (result.success && result.data) {
        setPendingReadings(result.data as TankReadingForClient[]);
      } else {
        toast.error(result.message || "Gagal memuat data tank reading pending");
      }
    } catch (error) {
      console.error("Error fetching pending tank readings:", error);
      toast.error("Gagal memuat data tank reading pending");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryReadings = async () => {
    setHistoryLoading(true);
    try {
      const result = await getTankReadingHistory(gasStationId);
      if (result.success && result.data) {
        setHistoryReadings(result.data as TankReadingForClient[]);
      } else {
        toast.error(result.message || "Gagal memuat data history tank reading");
      }
    } catch (error) {
      console.error("Error fetching history tank readings:", error);
      toast.error("Gagal memuat data history tank reading");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReading) return;
    setIsProcessing(true);
    try {
      const result = await approveTankReading(selectedReading.id, true);
      if (result.success) {
        setSelectedReading(null);
        toast.success(result.message);
        await fetchPendingReadings();
        await fetchHistoryReadings();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error approving tank reading:", error);
      toast.error("Failed to process approval");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReading) return;
    setIsProcessing(true);
    try {
      const result = await approveTankReading(selectedReading.id, false);
      if (result.success) {
        setSelectedReading(null);
        toast.success(result.message);
        await fetchPendingReadings();
        await fetchHistoryReadings();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error rejecting tank reading:", error);
      toast.error("Failed to process rejection");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedReading) return;

    setLoadingRollback(true);
    try {
      const result = await rollbackTankReadingApproval(selectedReading.id);
      if (result.success) {
        toast.success(result.message || "Tank reading berhasil di-rollback");
        setRollbackConfirmOpen(false);
        setSelectedReading(null);
        fetchPendingReadings();
        fetchHistoryReadings();
        router.refresh();
      } else {
        toast.error(result.message || "Gagal melakukan rollback tank reading");
      }
    } catch (error) {
      console.error("Error rolling back tank reading:", error);
      toast.error("Gagal melakukan rollback tank reading");
    } finally {
      setLoadingRollback(false);
    }
  };

  const handleViewDetail = (reading: TankReadingForClient) => {
    setSelectedReading(reading);
  };

  const handleImageClick = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setImagePreviewOpen(true);
  };

  return (
    <>
      <div className="space-y-3 lg:space-y-4">
        {/* Pending Tank Readings */}
        <div className="space-y-1.5 lg:space-y-3">
          <h3 className="text-xs lg:text-sm font-semibold px-1 lg:px-2">
            Pending Tank Reading
          </h3>
          {loading && !pendingReadings.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : pendingReadings.length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada tank reading pending approval
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
                    <TableHead>Tank Reading</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Dibuat Oleh / Approver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReadings.map((reading) => (
                    <TableRow 
                      key={reading.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetail(reading)}
                    >
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(
                          new Date(reading.createdAt),
                          "dd MMM yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TankBadge
                            tankCode={reading.tank.code}
                            productName={reading.tank.product.name}
                          />
                          <span className="font-medium">
                            {reading.tank.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ProductBadge
                          productName={reading.tank.product.name}
                          ron={reading.tank.product.ron?.toString() || null}
                          showRON={false}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-blue-600 font-mono text-xs lg:text-sm">
                            {formatNumber(reading.literValue)}
                          </span>
                          <span className="text-gray-600 font-mono text-[10px] lg:text-xs">
                            Realtime: {formatNumber(reading.realtimeStock || 0)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {reading.realtimeStock !== undefined &&
                        reading.realtimeStock !== null ? (
                          <span
                            className={`font-semibold font-mono text-xs lg:text-sm ${
                              reading.literValue -
                                (reading.realtimeStock || 0) <
                              0
                                ? "text-red-600"
                                : reading.literValue -
                                    (reading.realtimeStock || 0) >
                                  0
                                ? "text-green-600"
                                : "text-gray-600"
                            }`}
                          >
                            {reading.literValue -
                              (reading.realtimeStock || 0) >=
                            0
                              ? "+"
                              : ""}
                            {formatNumber(
                              reading.literValue - (reading.realtimeStock || 0)
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs lg:text-sm">
                          <div>
                            <span className="text-gray-600">Dibuat:</span>{" "}
                            <span className="font-medium">
                              {reading.loader.username || reading.loader.email}
                            </span>
                          </div>
                          {reading.approver && (
                            <div>
                              <span className="text-gray-600">Approve:</span>{" "}
                              <span className="font-medium">
                                {reading.approver.username ||
                                  reading.approver.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={reading.approvalStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* History Tank Readings */}
        <div className="space-y-1.5 lg:space-y-3">
          <div className="flex items-center justify-between px-1 lg:px-2">
            <h3 className="text-xs lg:text-sm font-semibold">
              History Tank Reading
            </h3>
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
          {historyLoading && !historyReadings.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : historyReadings.filter((reading) => {
              if (!dateRange.from || !dateRange.to) return false;
              const readingDate = new Date(reading.createdAt);
              return (
                readingDate >= startOfDayUTC(dateRange.from) &&
                readingDate <= endOfDayUTC(dateRange.to)
              );
            }).length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada riwayat tank reading
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
                    <TableHead>Tank Reading</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Dibuat Oleh / Approver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyReadings
                    .filter((reading) => {
                      if (!dateRange.from || !dateRange.to) return false;
                      const readingDate = new Date(reading.createdAt);
                      return (
                        readingDate >= startOfDayUTC(dateRange.from) &&
                        readingDate <= endOfDayUTC(dateRange.to)
                      );
                    })
                    .map((reading) => (
                      <TableRow
                        key={reading.id}
                        onClick={() => handleViewDetail(reading)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(
                            new Date(reading.createdAt),
                            "dd MMM yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TankBadge
                              tankCode={reading.tank.code}
                              productName={reading.tank.product.name}
                            />
                            <span className="font-medium">
                              {reading.tank.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ProductBadge
                            productName={reading.tank.product.name}
                            ron={reading.tank.product.ron?.toString() || null}
                            showRON={false}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-blue-600 font-mono text-xs lg:text-sm">
                              {formatNumber(reading.literValue)}
                            </span>
                            <span className="text-gray-600 font-mono text-[10px] lg:text-xs">
                              Realtime: {formatNumber(reading.realtimeStock || 0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {reading.realtimeStock !== undefined &&
                          reading.realtimeStock !== null ? (
                            <span
                              className={`font-semibold font-mono text-xs lg:text-sm ${
                                reading.literValue -
                                  (reading.realtimeStock || 0) <
                                0
                                  ? "text-red-600"
                                  : reading.literValue -
                                      (reading.realtimeStock || 0) >
                                    0
                                  ? "text-green-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {reading.literValue -
                                (reading.realtimeStock || 0) >=
                              0
                                ? "+"
                                : ""}
                              {formatNumber(
                                reading.literValue -
                                  (reading.realtimeStock || 0)
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs lg:text-sm">
                            <div>
                              <span className="text-gray-600">Dibuat:</span>{" "}
                              <span className="font-medium">
                                {reading.loader.username ||
                                  reading.loader.email}
                              </span>
                            </div>
                            {reading.approver && (
                              <div>
                                <span className="text-gray-600">Approve:</span>{" "}
                                <span className="font-medium">
                                  {reading.approver.username ||
                                    reading.approver.email}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={reading.approvalStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Detail & Confirm Dialog */}
      {selectedReading && (
        <Dialog
          open={!!selectedReading}
          onOpenChange={(open) => {
            if (!open && !isProcessing) {
              setSelectedReading(null);
            }
          }}
        >
          <DialogContent
            className="p-2 lg:p-6 max-h-[90vh] flex flex-col"
            showCloseButton={false}
          >
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base lg:text-xl">
                Detail Tank Reading
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                {selectedReading.approvalStatus === "PENDING"
                  ? "Review detail tank reading sebelum approve atau reject"
                  : "Detail informasi tank reading"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 lg:space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Tank Reading Info */}
              <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tank:</span>
                  <span className="font-semibold">
                    {selectedReading.tank.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <ProductBadge
                    productName={selectedReading.tank.product.name}
                    ron={selectedReading.tank.product.ron?.toString() || null}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dibuat Oleh:</span>
                  <span className="font-semibold">
                    {selectedReading.loader.username ||
                      selectedReading.loader.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal Dibuat:</span>
                  <span className="font-semibold">
                    {format(
                      new Date(selectedReading.createdAt),
                      "dd MMM yyyy HH:mm"
                    )}
                  </span>
                </div>
                {selectedReading.approver && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {selectedReading.approvalStatus === "APPROVED"
                          ? "Approve Oleh:"
                          : "Reject Oleh:"}
                      </span>
                      <span className="font-semibold">
                        {selectedReading.approver.username ||
                          selectedReading.approver.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tanggal Approval:</span>
                      <span className="font-semibold">
                        {format(
                          new Date(selectedReading.updatedAt),
                          "dd MMM yyyy HH:mm"
                        )}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <StatusBadge status={selectedReading.approvalStatus} />
                </div>
              </div>

              {/* Volume Summary */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 lg:p-3 space-y-2">
                {/* Stock Realtime - jika ada snapshot */}
                {selectedReading.realtimeStock !== undefined &&
                  selectedReading.realtimeStock !== null && (
                    <div className="flex justify-between text-xs lg:text-sm py-1">
                      <span>Stock Realtime (Snapshot):</span>
                      <span className="font-mono font-semibold text-gray-600">
                        {formatNumber(selectedReading.realtimeStock)} L
                      </span>
                    </div>
                  )}
                
                <div className={`flex justify-between text-xs lg:text-sm py-1 ${selectedReading.realtimeStock !== undefined && selectedReading.realtimeStock !== null ? 'border-t border-blue-200' : ''}`}>
                  <span>Tank Reading:</span>
                  <span className="font-mono font-semibold text-blue-600">
                    {formatNumber(selectedReading.literValue)} L
                  </span>
                </div>
                {selectedReading.realtimeStock !== undefined &&
                  selectedReading.realtimeStock !== null && (
                    <div className="flex justify-between text-xs lg:text-sm py-1 border-t border-blue-200">
                      <span>Variance (Snapshot):</span>
                      <span
                        className={`font-mono font-semibold ${
                          selectedReading.literValue -
                            (selectedReading.realtimeStock || 0) <
                          0
                            ? "text-red-600"
                            : selectedReading.literValue -
                              (selectedReading.realtimeStock || 0) >
                            0
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {selectedReading.literValue -
                          (selectedReading.realtimeStock || 0) >=
                        0
                          ? "+"
                          : ""}
                        {formatNumber(
                          selectedReading.literValue -
                            (selectedReading.realtimeStock || 0)
                        )} L
                      </span>
                    </div>
                  )}
              </div>

              {/* Notes */}
              {selectedReading.notes && (
                <div className="rounded-lg bg-gray-50 p-2 lg:p-3">
                  <div className="text-xs lg:text-sm font-semibold mb-1">
                    Catatan:
                  </div>
                  <div className="text-xs lg:text-sm text-gray-700">
                    {selectedReading.notes}
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {selectedReading.imageUrl && (
                <div className="rounded-lg bg-gray-50 p-2 lg:p-3">
                  <div className="text-xs lg:text-sm font-semibold mb-2">
                    Foto Bukti:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedReading.imageUrl.split(",").map((url, idx) => (
                      <img
                        key={idx}
                        src={url.trim()}
                        alt={`Bukti ${idx + 1}`}
                        className="w-20 h-20 lg:w-24 lg:h-24 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => handleImageClick(url.trim())}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 shrink-0 pt-2">
              {selectedReading.approvalStatus === "PENDING" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedReading(null)}
                    disabled={isProcessing}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isProcessing}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Approve
                      </>
                    )}
                  </Button>
                </>
              )}
              {selectedReading.approvalStatus !== "PENDING" && (
                <>
                  {canRollback &&
                    selectedReading.approvalStatus === "APPROVED" && (
                      <Button
                        variant="outline"
                        onClick={() => setRollbackConfirmOpen(true)}
                        disabled={loadingRollback}
                        size="sm"
                        className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                      >
                        <RotateCcw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Rollback
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedReading(null)}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Tutup
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Preview Foto Bukti</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Preview Foto Bukti"
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
        <DialogContent
          className="p-2 lg:p-6 max-h-[90vh] flex flex-col"
          showCloseButton={false}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base lg:text-xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Konfirmasi Rollback Tank Reading
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin melakukan rollback tank reading ini?
            </DialogDescription>
          </DialogHeader>

          {selectedReading && (
            <div className="space-y-2 lg:space-y-3 overflow-y-auto flex-1 min-h-0">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tank:</span>
                  <span className="font-semibold">
                    {selectedReading.tank.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tank Reading:</span>
                  <span className="font-semibold">
                    {formatNumber(selectedReading.literValue)} L
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal Approval:</span>
                  <span className="font-semibold">
                    {format(
                      new Date(selectedReading.updatedAt),
                      "dd MMM yyyy HH:mm"
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 lg:p-3 text-xs lg:text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-yellow-800">Peringatan:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-yellow-700">
                      <li>
                        Rollback akan membatalkan approval dan reverse
                        transaction accounting
                      </li>
                      <li>Status tank reading akan diubah menjadi REJECTED</li>
                      <li>
                        Jika ada tank reading lain setelah ini, perhitungan
                        stock akan terpengaruh
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 shrink-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setRollbackConfirmOpen(false)}
              disabled={loadingRollback}
              size="sm"
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              variant="outline"
              onClick={handleRollback}
              disabled={loadingRollback}
              size="sm"
              className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              {loadingRollback ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
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
