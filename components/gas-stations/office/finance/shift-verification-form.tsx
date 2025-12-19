"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Edit2, Save, CheckCircle2, Loader2, RotateCcw, ImageIcon } from "lucide-react";
import { ProductBadge } from "@/components/reusable/badges";
import {
  formatNumber,
  formatCurrency,
  parseFormattedNumber,
} from "@/lib/utils/format-client";
import {
  getShiftWithSales,
  markShiftAsVerified,
  unverifyShift,
} from "@/lib/actions/operator.actions";
import { updateNozzleReading } from "@/lib/actions/nozzle-reading.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { hasPermission, ROLES } from "@/lib/utils/permissions";

type ShiftVerificationFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  onVerified?: (shiftId: string) => void;
  mode?: "dialog" | "sheet"; // Mode tampilan: dialog atau sheet
  viewOnly?: boolean; // Mode view only (tanpa tombol edit/verify)
};

type ShiftData = {
  id: string;
  shift: string;
  status: string;
  isVerified: boolean;
  totalSales: number;
  nozzleDetails: Array<{
    nozzleId: string;
    nozzleCode: string;
    nozzleName: string;
    productName: string;
    openReading: number;
    closeReading: number;
    pumpTest: number;
    salesVolume: number;
    pricePerLiter: number;
    totalAmount: number;
    notes: string | null;
    openImageUrl?: string | null;
    closeImageUrl?: string | null;
  }>;
  nozzleReadings: Array<{
    id: string;
    nozzleId: string;
    readingType: string;
    totalizerReading: number;
    pumpTest: number;
    priceSnapshot: number;
    imageUrl?: string | null;
  }>;
  hasDeposit: boolean;
};

export function ShiftVerificationForm({
  open,
  onOpenChange,
  shiftId,
  onVerified,
  mode = "dialog",
  viewOnly = false,
}: ShiftVerificationFormProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.roleCode;
  const canUnverify = hasPermission(userRole as any, [
    ROLES.ADMINISTRATOR,
    ROLES.DEVELOPER,
    ROLES.FINANCE,
  ]);

  const [loading, setLoading] = useState(false);
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);
  const [updatingReading, setUpdatingReading] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editValues, setEditValues] = useState<
    Record<string, { openReading: number; closeReading: number; pumpTest: number }>
  >({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [unverifyConfirmOpen, setUnverifyConfirmOpen] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);

  useEffect(() => {
    if (open && shiftId) {
      fetchShiftData();
      setIsVerified(false);
      setIsEditMode(false);
      setEditValues({});
    }
  }, [open, shiftId]);

  useEffect(() => {
    if (shiftData && isEditMode) {
      // Initialize edit values dengan nilai saat ini
      const initialValues: Record<
        string,
        { openReading: number; closeReading: number; pumpTest: number }
      > = {};
      shiftData.nozzleDetails?.forEach((nozzle) => {
        initialValues[nozzle.nozzleId] = {
          openReading: nozzle.openReading,
          closeReading: nozzle.closeReading,
          pumpTest: nozzle.pumpTest,
        };
      });
      setEditValues(initialValues);
    }
  }, [shiftData, isEditMode]);

  const fetchShiftData = async () => {
    setLoading(true);
    try {
      const result = await getShiftWithSales(shiftId);
      if (result.success && result.data) {
        setShiftData(result.data as ShiftData);
      } else {
        toast.error("Gagal mengambil data shift");
      }
    } catch (error) {
      console.error("Error fetching shift data:", error);
      toast.error("Gagal mengambil data shift");
    } finally {
      setLoading(false);
    }
  };

  const getReadingId = (nozzleId: string, readingType: "OPEN" | "CLOSE") => {
    return shiftData?.nozzleReadings?.find(
      (r) => r.nozzleId === nozzleId && r.readingType === readingType
    )?.id;
  };

  const handleStartEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditValues({});
  };

  const handleSaveAllEdits = async () => {
    if (!shiftData) return;

    setUpdatingReading("saving-all");
    try {
      const updatePromises: Promise<any>[] = [];

      for (const [nozzleId, values] of Object.entries(editValues)) {
        const nozzle = shiftData.nozzleDetails?.find(
          (n) => n.nozzleId === nozzleId
        );
        if (!nozzle) continue;

        // Update OPEN reading jika berubah
        if (values.openReading !== nozzle.openReading) {
          const openReadingId = getReadingId(nozzleId, "OPEN");
          if (openReadingId) {
            updatePromises.push(
              updateNozzleReading(openReadingId, {
                totalizerReading: values.openReading,
              })
            );
          }
        }

        // Update CLOSE reading jika berubah
        if (values.closeReading !== nozzle.closeReading || values.pumpTest !== nozzle.pumpTest) {
          const closeReadingId = getReadingId(nozzleId, "CLOSE");
          if (closeReadingId) {
            const updateData: any = {};
            if (values.closeReading !== nozzle.closeReading) {
              updateData.totalizerReading = values.closeReading;
            }
            if (values.pumpTest !== nozzle.pumpTest) {
              updateData.pumpTest = values.pumpTest;
            }
            updatePromises.push(
              updateNozzleReading(closeReadingId, updateData)
            );
          }
        }
      }

      if (updatePromises.length === 0) {
        toast.info("Tidak ada perubahan yang perlu disimpan");
        setIsEditMode(false);
        setUpdatingReading(null);
        return;
      }

      const results = await Promise.all(updatePromises);
      const hasError = results.some((r) => !r.success);

      if (hasError) {
        toast.error("Beberapa totalisator gagal diupdate");
      } else {
        toast.success("Totalisator berhasil diupdate");
        await fetchShiftData();
        setIsEditMode(false);
        setEditValues({});
      }
    } catch (error) {
      console.error("Error updating readings:", error);
      toast.error("Gagal mengupdate totalisator");
    } finally {
      setUpdatingReading(null);
    }
  };

  const handleOpenConfirm = () => {
    setConfirmOpen(true);
  };

  const handleCancelConfirm = () => {
    if (!isVerifying) {
      setConfirmOpen(false);
    }
  };

  const handleVerify = async () => {
    if (!shiftData) return;

    setIsVerifying(true);
    try {
      const result = await markShiftAsVerified(shiftData.id);
      if (result.success) {
        setIsVerified(true);
        setConfirmOpen(false);
        onVerified?.(shiftData.id);
        toast.success("Shift berhasil diverifikasi");
        setTimeout(() => {
          onOpenChange(false);
        }, 1000);
      } else {
        toast.error(result.message || "Gagal memverifikasi shift");
      }
    } catch (error) {
      console.error("Error verifying shift:", error);
      toast.error("Gagal memverifikasi shift");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnverify = async () => {
    if (!shiftData) return;

    setIsUnverifying(true);
    try {
      const result = await unverifyShift(shiftData.id, {
        cascadeUnverify: true,
      });
      if (result.success) {
        toast.success(result.message || "Shift berhasil di-unverify");
        setUnverifyConfirmOpen(false);
        await fetchShiftData();
        onVerified?.(shiftData.id);
      } else {
        toast.error(result.message || "Gagal unverify shift");
      }
    } catch (error) {
      console.error("Error unverifying shift:", error);
      toast.error("Gagal unverify shift");
    } finally {
      setIsUnverifying(false);
    }
  };


  const getRecalculatedTotal = () => {
    if (!shiftData) return 0;

    if (isEditMode && Object.keys(editValues).length > 0) {
      return (
        shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
          const editValue = editValues[nozzle.nozzleId];
          if (editValue) {
            const editingSalesVolume = Math.max(
              0,
              editValue.closeReading - editValue.openReading - editValue.pumpTest
            );
            return sum + editingSalesVolume * nozzle.pricePerLiter;
          }
          return sum + nozzle.totalAmount;
        }, 0) || 0
      );
    }

    return shiftData.totalSales || 0;
  };

  const getTotalVolume = () => {
    if (!shiftData) return 0;

    if (isEditMode && Object.keys(editValues).length > 0) {
      return (
        shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
          const editValue = editValues[nozzle.nozzleId];
          if (editValue) {
            return sum + (editValue.closeReading - editValue.openReading);
          }
          return sum + (nozzle.closeReading - nozzle.openReading);
        }, 0) || 0
      );
    }

    return (
      shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
        return sum + (nozzle.closeReading - nozzle.openReading);
      }, 0) || 0
    );
  };

  const getTotalPumpTest = () => {
    if (!shiftData) return 0;

    if (isEditMode && Object.keys(editValues).length > 0) {
      return (
        shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
          const editValue = editValues[nozzle.nozzleId];
          if (editValue) {
            return sum + editValue.pumpTest;
          }
          return sum + nozzle.pumpTest;
        }, 0) || 0
      );
    }

    return (
      shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
        return sum + nozzle.pumpTest;
      }, 0) || 0
    );
  };

  const getTotalSales = () => {
    if (!shiftData) return 0;

    if (isEditMode && Object.keys(editValues).length > 0) {
      return (
        shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
          const editValue = editValues[nozzle.nozzleId];
          if (editValue) {
            const editingVolume = editValue.closeReading - editValue.openReading;
            const editingSalesVolume = Math.max(0, editingVolume - editValue.pumpTest);
            return sum + editingSalesVolume;
          }
          const volume = nozzle.closeReading - nozzle.openReading;
          const salesVolume = Math.max(0, volume - nozzle.pumpTest);
          return sum + salesVolume;
        }, 0) || 0
      );
    }

    return (
      shiftData.nozzleDetails?.reduce((sum: number, nozzle: any) => {
        const volume = nozzle.closeReading - nozzle.openReading;
        const salesVolume = Math.max(0, volume - nozzle.pumpTest);
        return sum + salesVolume;
      }, 0) || 0
    );
  };

  const handleEditChange = (
    nozzleId: string,
    field: "openReading" | "closeReading" | "pumpTest",
    value: number
  ) => {
    if (!shiftData) return;
    const nozzle = shiftData.nozzleDetails?.find(
      (n) => n.nozzleId === nozzleId
    );
    if (!nozzle) return;

    setEditValues((prev) => ({
      ...prev,
      [nozzleId]: {
        openReading: prev[nozzleId]?.openReading ?? nozzle.openReading,
        closeReading: prev[nozzleId]?.closeReading ?? nozzle.closeReading,
        pumpTest: prev[nozzleId]?.pumpTest ?? nozzle.pumpTest,
        [field]: value,
      },
    }));
  };

  const getShiftLabel = (shift: string): string => {
    switch (shift) {
      case "MORNING":
        return "Shift 1";
      case "AFTERNOON":
        return "Shift 2";
      case "NIGHT":
        return "Shift 3";
      default:
        return shift;
    }
  };

  const ImageDialog = ({
    imageUrl,
    alt,
    index,
    photoName,
  }: {
    imageUrl: string;
    alt: string;
    index: number;
    photoName?: string;
  }) => (
    <Dialog key={index}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 lg:gap-1.5 text-blue-600 hover:underline flex-1 text-left text-xs lg:text-sm p-1 lg:p-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <ImageIcon className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
          <span className="truncate">{photoName || alt}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] lg:max-w-4xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">{photoName || alt}</DialogTitle>
        <div className="relative w-full h-[60vh] lg:h-[70vh]">
          <Image
            src={imageUrl}
            alt={alt}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderTotalisatorPhotos = () => {
    if (!shiftData?.nozzleReadings || shiftData.nozzleReadings.length === 0) {
      return null;
    }

    // Filter hanya yang punya imageUrl
    const readingsWithImages = shiftData.nozzleReadings.filter(
      (r) => r.imageUrl
    );

    // Buat map untuk mendapatkan nozzleCode dari nozzleId
    const nozzleCodeMap = new Map<string, string>();
    shiftData.nozzleDetails?.forEach((nozzle) => {
      nozzleCodeMap.set(nozzle.nozzleId, nozzle.nozzleCode);
    });

    // Proses setiap reading dengan imageUrl (bisa array atau string)
    const shiftLabel = shiftData.shift ? getShiftLabel(shiftData.shift) : "";
    const processedReadings: Array<{
      reading: (typeof shiftData.nozzleReadings)[0];
      imageUrl: string;
      photoName: string;
    }> = [];

    readingsWithImages.forEach((reading) => {
      const imageUrls = Array.isArray(reading.imageUrl)
        ? reading.imageUrl
        : reading.imageUrl
        ? [reading.imageUrl]
        : [];

      const nozzleCode =
        nozzleCodeMap.get(reading.nozzleId) || reading.nozzleId;
      const readingTypeLabel =
        reading.readingType === "OPEN" ? "Open" : "Close";

      imageUrls.forEach((imageUrl, imgIndex) => {
        if (imageUrl) {
          const photoName = `Foto ${readingTypeLabel} (${nozzleCode})${
            shiftLabel ? ` - ${shiftLabel}` : ""
          }`;
          processedReadings.push({
            reading,
            imageUrl,
            photoName,
          });
        }
      });
    });

    const openReadings = processedReadings.filter(
      (r) => r.reading.readingType === "OPEN"
    );
    const closeReadings = processedReadings.filter(
      (r) => r.reading.readingType === "CLOSE"
    );

    const renderImageGroup = (
      title: string,
      readings: typeof processedReadings
    ) => {
      if (readings.length === 0) return null;

      return (
        <div>
          <div className="text-[10px] lg:text-xs text-muted-foreground mb-1.5 lg:mb-2">
            {title}
          </div>
          <div className="space-y-1 lg:space-y-1.5">
            {readings.map((item, index) => {
              return (
                <ImageDialog
                  key={`${item.reading.id}-${index}`}
                  imageUrl={item.imageUrl}
                  alt={item.photoName}
                  index={index}
                  photoName={item.photoName}
                />
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="rounded-lg border bg-gray-50 p-2 lg:p-4">
        <h4 className="font-semibold text-xs lg:text-sm mb-2 lg:mb-3">
          Foto Totalisator
        </h4>
        <div className="grid grid-cols-2 gap-1.5 lg:gap-4">
          {renderImageGroup("Pembukaan (Check In)", openReadings)}
          {renderImageGroup("Penutupan (Check Out)", closeReadings)}
        </div>
      </div>
    );
  };

  const TableHeaderRow = () => (
    <TableRow>
      <TableHead className="w-[80px] text-xs lg:text-sm">Nozzle</TableHead>
      <TableHead className="text-xs lg:text-sm">Produk</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Awal</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Akhir</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Volume</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Pump Test</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Sales</TableHead>
    </TableRow>
  );

  const TableHeaderRowEdit = () => (
    <TableRow>
      <TableHead className="w-[80px] text-xs lg:text-sm">Nozzle</TableHead>
      <TableHead className="text-xs lg:text-sm">Produk</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Awal</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Akhir</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Volume</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Pump Test</TableHead>
      <TableHead className="text-right text-xs lg:text-sm">Sales</TableHead>
    </TableRow>
  );

  const renderOperatorTable = () => {
    if (!shiftData) return null;

    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableHeaderRow />
          </TableHeader>
          <TableBody>
            {shiftData.nozzleDetails?.map((nozzle) => {
              const volume = nozzle.closeReading - nozzle.openReading;
              const salesVolume = Math.max(
                0,
                volume - nozzle.pumpTest
              );

              return (
                <TableRow key={nozzle.nozzleId}>
                  <TableCell className="font-semibold text-xs lg:text-sm">
                    {nozzle.nozzleCode}
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    <ProductBadge productName={nozzle.productName} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                    {formatNumber(Math.round(nozzle.openReading))}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                    {formatNumber(Math.round(nozzle.closeReading))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs lg:text-sm">
                    <span className="font-mono">
                      {formatNumber(Math.round(volume))}
                    </span>{" "}
                    L
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono text-xs lg:text-sm">
                    {formatNumber(Math.round(nozzle.pumpTest))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs lg:text-sm">
                    <span className="font-mono">
                      {formatNumber(Math.round(salesVolume))}
                    </span>{" "}
                    L
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderEditTable = () => {
    if (!shiftData || !isEditMode) return null;

    return (
      <div className="rounded-lg border overflow-x-auto">
        <div className="bg-blue-50 px-2 lg:px-3 py-1.5 lg:py-2 border-b">
          <h4 className="text-xs lg:text-sm font-semibold text-blue-900">
            Edit Totalisator (Finance)
          </h4>
        </div>
        <Table>
          <TableHeader>
            <TableHeaderRowEdit />
          </TableHeader>
          <TableBody>
            {shiftData.nozzleDetails?.map((nozzle) => {
              const editValue = editValues[nozzle.nozzleId] || {
                openReading: nozzle.openReading,
                closeReading: nozzle.closeReading,
                pumpTest: nozzle.pumpTest,
              };
              const editingVolume = editValue.closeReading - editValue.openReading;
              const editingSalesVolume = Math.max(
                0,
                editingVolume - editValue.pumpTest
              );
              const hasChanges =
                editValue.openReading !== nozzle.openReading ||
                editValue.closeReading !== nozzle.closeReading ||
                editValue.pumpTest !== nozzle.pumpTest;

              return (
                <TableRow key={nozzle.nozzleId}>
                  <TableCell className="font-semibold text-xs lg:text-sm">
                    {nozzle.nozzleCode}
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    <ProductBadge productName={nozzle.productName} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={formatNumber(editValue.openReading)}
                      onChange={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "openReading",
                          parsed
                        );
                      }}
                      onBlur={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "openReading",
                          parsed
                        );
                      }}
                      className={cn(
                        "w-32 lg:w-40 text-xs lg:text-sm font-mono text-right h-9 lg:h-10",
                        hasChanges && "border-orange-500"
                      )}
                      disabled={updatingReading !== null}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={formatNumber(editValue.closeReading)}
                      onChange={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "closeReading",
                          parsed
                        );
                      }}
                      onBlur={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "closeReading",
                          parsed
                        );
                      }}
                      className={cn(
                        "w-32 lg:w-40 text-xs lg:text-sm font-mono text-right h-9 lg:h-10",
                        hasChanges && "border-orange-500"
                      )}
                      disabled={updatingReading !== null}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs lg:text-sm">
                    <span
                      className={cn(
                        "font-mono",
                        hasChanges && "text-orange-600"
                      )}
                    >
                      {formatNumber(Math.round(editingVolume))}
                    </span>{" "}
                    L
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={formatNumber(editValue.pumpTest)}
                      onChange={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "pumpTest",
                          parsed
                        );
                      }}
                      onBlur={(e) => {
                        const parsed = parseFormattedNumber(e.target.value);
                        handleEditChange(
                          nozzle.nozzleId,
                          "pumpTest",
                          parsed
                        );
                      }}
                      className={cn(
                        "w-32 lg:w-40 text-xs lg:text-sm font-mono text-right h-9 lg:h-10",
                        hasChanges && "border-orange-500"
                      )}
                      disabled={updatingReading !== null}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs lg:text-sm">
                    <span
                      className={cn(
                        "font-mono",
                        hasChanges && "text-orange-600"
                      )}
                    >
                      {formatNumber(Math.round(editingSalesVolume))}
                    </span>{" "}
                    L
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Memuat data...
        </div>
      );
    }

    if (!shiftData) {
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Data shift tidak ditemukan
        </div>
      );
    }

    return (
      <div className="space-y-3 lg:space-y-4">
        {renderTotalisatorPhotos()}
        {renderOperatorTable()}
        {!viewOnly && renderEditTable()}
      </div>
    );
  };

  const renderFooter = () => {
    // View only mode - tombol tutup + unverify jika punya permission dan shift sudah completed
    if (viewOnly) {
      const isActive = shiftData?.status === "STARTED";
      const canUnverifyShift = canUnverify && shiftData && shiftData.status === "COMPLETED" && shiftData.isVerified;
      
      return (
        <>
          {canUnverifyShift && !isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnverifyConfirmOpen(true)}
              disabled={isUnverifying}
              className="text-xs lg:text-sm"
            >
              <RotateCcw className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
              Unverify
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUnverifying}
            className="text-xs lg:text-sm"
          >
            Tutup
          </Button>
        </>
      );
    }

    if (!shiftData || isVerified) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="text-xs lg:text-sm"
        >
          Tutup
        </Button>
      );
    }

    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isEditMode) {
              handleCancelEdit();
            } else {
              onOpenChange(false);
            }
          }}
          disabled={updatingReading !== null}
          className="text-xs lg:text-sm"
        >
          Batal
        </Button>
        {isEditMode ? (
          <Button
            size="sm"
            onClick={handleSaveAllEdits}
            disabled={updatingReading !== null}
            className="text-xs lg:text-sm"
          >
            <Save className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
            Simpan
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              disabled={updatingReading !== null}
              className="text-xs lg:text-sm"
            >
              <Edit2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={handleOpenConfirm}
              disabled={updatingReading !== null}
              className="text-xs lg:text-sm"
            >
              <CheckCircle2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
              Verifikasi Shift
            </Button>
          </>
        )}
      </>
    );
  };

  if (mode === "sheet") {
    return (
      <>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="p-2 overflow-y-auto">
            <SheetHeader className="px-2 pt-2">
              <SheetTitle className="text-xs lg:text-xl">
                Verifikasi Totalisator
              </SheetTitle>
              <SheetDescription className="text-xs lg:text-sm">
                Verifikasi dan edit nilai totalisator dari operator
              </SheetDescription>
            </SheetHeader>
            <div className="px-2 lg:px-4">{renderContent()}</div>
            <div className="flex justify-end gap-1.5 lg:gap-2 pt-2 lg:pt-4 border-t px-2 lg:px-4">
              {renderFooter()}
            </div>
          </SheetContent>
        </Sheet>

        {/* Confirmation Dialog */}
        <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
          <DialogContent
            showCloseButton={!isVerifying}
            className="sm:max-w-[425px]"
          >
            <DialogHeader>
              <DialogTitle>Konfirmasi Verifikasi Shift</DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin memverifikasi shift ini? Setelah
                diverifikasi, shift ini akan ditandai sebagai selesai dan tidak
                dapat diubah lagi.
              </DialogDescription>
            </DialogHeader>
            {shiftData && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Volume:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(Math.round(getTotalVolume()))} L
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pump Test:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(Math.round(getTotalPumpTest()))} L
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sales:</span>
                  <span className="font-semibold font-mono text-blue-600">
                    {formatNumber(Math.round(getTotalSales()))} L
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Jumlah Nozzle:</span>
                  <span className="font-semibold">
                    {shiftData.nozzleDetails?.length || 0}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelConfirm}
                disabled={isVerifying}
              >
                Batal
              </Button>
              <Button onClick={handleVerify} disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Ya, Verifikasi"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-2 lg:p-6 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base lg:text-xl">
            Verifikasi Totalisator
          </DialogTitle>
          <DialogDescription className="text-xs lg:text-sm">
            Verifikasi dan edit nilai totalisator dari operator
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">{renderContent()}</div>
        <DialogFooter className="pt-2 lg:pt-4 border-t">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>

      {/* Unverify Confirmation Dialog */}
      <Dialog open={unverifyConfirmOpen} onOpenChange={(open) => {
        if (!isUnverifying) {
          setUnverifyConfirmOpen(open);
        }
      }}>
        <DialogContent
          showCloseButton={!isUnverifying}
          className="sm:max-w-[425px]"
        >
          <DialogHeader>
            <DialogTitle>Konfirmasi Unverify Shift</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin unverify shift ini? Shift ini dan shift setelahnya akan di-unverify untuk menjaga konsistensi data.
            </DialogDescription>
          </DialogHeader>
          {shiftData && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              <div className="font-semibold mb-2">⚠️ Peringatan:</div>
              <div>
                Unverify shift akan:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Menghapus deposit (jika status PENDING/REJECTED)</li>
                  <li>Unverify shift ini</li>
                  <li>Unverify shift setelahnya (cascade)</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnverifyConfirmOpen(false)}
              disabled={isUnverifying}
            >
              Batal
            </Button>
            <Button onClick={handleUnverify} disabled={isUnverifying}>
              {isUnverifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Ya, Unverify"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent
          showCloseButton={!isVerifying}
          className="sm:max-w-[425px]"
        >
          <DialogHeader>
            <DialogTitle>Konfirmasi Verifikasi Shift</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin memverifikasi shift ini? Setelah
              diverifikasi, shift ini akan ditandai sebagai selesai dan tidak
              dapat diubah lagi.
            </DialogDescription>
          </DialogHeader>
          {shiftData && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Penjualan:</span>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(getRecalculatedTotal())}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jumlah Nozzle:</span>
                <span className="font-semibold">
                  {shiftData.nozzleDetails?.length || 0}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              disabled={isVerifying}
            >
              Batal
            </Button>
            <Button onClick={handleVerify} disabled={isVerifying}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Ya, Verifikasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
