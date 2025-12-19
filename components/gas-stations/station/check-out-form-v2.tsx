"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { bulkCreateNozzleReading } from "@/lib/actions/nozzle-reading.actions";
import { checkOut } from "@/lib/actions/operator-shift.actions";
import { getShiftWithSales } from "@/lib/actions/operator.actions";
import { toast } from "sonner";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { NozzleBadge } from "@/components/reusable/badges/nozzle-badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { startOfDayUTC } from "@/lib/utils/datetime";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

const readingSchema = z.object({
  nozzleId: z.string(),
  totalizerReading: z.coerce.number().min(0, "Totalisator tidak boleh negatif"),
  pumpTest: z.coerce
    .number()
    .min(0, "Pump test tidak boleh negatif")
    .default(0),
  images: z.array(z.string()).min(1, "Foto wajib diisi per nozzle"),
});

const formSchema = z.object({
  readings: z.array(readingSchema).min(1),
});

type CheckOutSheetV2Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatorShiftId: string;
  nozzles: Array<{
    id: string;
    code: string;
    name: string;
    product: {
      name: string;
      sellingPrice: number;
    };
  }>;
  onSuccess?: () => void;
};

export function CheckOutSheetV2({
  open,
  onOpenChange,
  operatorShiftId,
  nozzles,
  onSuccess,
}: CheckOutSheetV2Props) {
  const [loading, setLoading] = useState(false);
  const [uploadingNozzleId, setUploadingNozzleId] = useState<string | null>(
    null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<z.infer<
    typeof formSchema
  > | null>(null);
  const [openReadings, setOpenReadings] = useState<Record<string, number>>({});
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<string | null>(null);
  const [showPumpTest, setShowPumpTest] = useState<Record<string, boolean>>({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      readings: nozzles.map((nozzle) => ({
        nozzleId: nozzle.id,
        totalizerReading: 0,
        pumpTest: 0,
        images: [],
      })),
    },
  });

  useEffect(() => {
    if (open && operatorShiftId) {
      fetchOpenReadings();
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operatorShiftId]);

  const getTodayDate = () => {
    const todayLocal = new Date();
    return startOfDayUTC(
      new Date(
        Date.UTC(
          todayLocal.getFullYear(),
          todayLocal.getMonth(),
          todayLocal.getDate(),
          0,
          0,
          0,
          0
        )
      )
    );
  };

  const fetchOpenReadings = async () => {
    try {
      const result = await getShiftWithSales(operatorShiftId);
      if (result.success && result.data) {
        const shiftData = result.data as {
          nozzleReadings?: Array<{
            nozzleId: string;
            readingType: string;
            totalizerReading: number;
          }>;
          shift?: string;
        };

        const openReadingsMap: Record<string, number> = {};

        // Initialize semua nozzle dengan null (akan ditampilkan sebagai "-")
        nozzles.forEach((nozzle) => {
          openReadingsMap[nozzle.id] = null as any;
        });

        // Update dengan data OPEN reading yang ada
        if (shiftData.nozzleReadings) {
          shiftData.nozzleReadings.forEach((reading) => {
            if (reading.readingType === "OPEN") {
              openReadingsMap[reading.nozzleId] = Number(
                reading.totalizerReading
              );
            }
          });
        }

        // Set shift information
        if (shiftData.shift) {
          setCurrentShift(shiftData.shift);
        }

        setOpenReadings(openReadingsMap);

        // Set initial values based on open readings
        const updatedReadings = nozzles.map((nozzle) => {
          const openReading = openReadingsMap[nozzle.id];
          return {
            nozzleId: nozzle.id,
            totalizerReading:
              openReading !== undefined && openReading !== null
                ? openReading
                : 0,
            pumpTest: 0,
            images: [],
          };
        });
        form.reset({ readings: updatedReadings });
      }
    } catch (error) {
      console.error("Error fetching open readings:", error);
      toast.error("Gagal mengambil data reading pembukaan");
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    nozzleIndex: number
  ) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const nozzleId = nozzles[nozzleIndex].id;

    for (const file of fileArray) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} terlalu besar. Max 5MB per file`);
        return;
      }
    }

    setUploadingNozzleId(nozzleId);

    const uploadPromises = fileArray.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        return { url: data.url };
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`Gagal upload ${file.name}`);
        throw error;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map((r) => r.url);

      const currentImages =
        form.getValues(`readings.${nozzleIndex}.images`) || [];
      form.setValue(`readings.${nozzleIndex}.images`, [
        ...currentImages,
        ...newUrls,
      ]);
      toast.success("Foto berhasil diupload");
    } catch (error) {
      // Error already handled
    } finally {
      setUploadingNozzleId(null);
    }
  };

  const removeImage = (nozzleIndex: number, imageIndex: number) => {
    const currentImages =
      form.getValues(`readings.${nozzleIndex}.images`) || [];
    const newImages = currentImages.filter((_, i) => i !== imageIndex);
    form.setValue(`readings.${nozzleIndex}.images`, newImages);
  };

  const openImagePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setPreviewDialogOpen(true);
  };

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    // Validasi totalisator tutup tidak boleh lebih kecil dari bacaan buka
    let hasError = false;
    data.readings.forEach((reading, index) => {
      const nozzle = nozzles[index];
      const openReading = openReadings[nozzle.id];
      if (openReading !== undefined && openReading !== null) {
        if (reading.totalizerReading < openReading) {
          form.setError(`readings.${index}.totalizerReading` as any, {
            type: "manual",
            message: `Totalisator tutup tidak boleh lebih kecil dari bacaan buka (${formatNumber(
              openReading
            )})`,
          });
          hasError = true;
        }
      }
    });

    if (hasError) {
      return;
    }

    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setLoading(true);
    try {
      const readingResult = await bulkCreateNozzleReading({
        operatorShiftId,
        readingType: "CLOSE",
        readings: pendingData.readings.map((reading) => ({
          ...reading,
          pumpTest: reading.pumpTest || 0,
          imageUrl:
            reading.images.length === 1 ? reading.images[0] : reading.images,
          priceSnapshot:
            nozzles.find((n) => n.id === reading.nozzleId)?.product
              .sellingPrice || 0,
        })),
      });

      if (!readingResult.success) {
        toast.error(readingResult.message);
        setLoading(false);
        return;
      }

      const checkOutResult = await checkOut({ operatorShiftId });

      if (checkOutResult.success) {
        toast.success(checkOutResult.message);
        setConfirmOpen(false);
        onOpenChange(false);
        form.reset();
        setPendingData(null);
        onSuccess?.();
      } else {
        toast.error(checkOutResult.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    if (!loading) {
      setConfirmOpen(false);
      setPendingData(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="p-2 overflow-hidden flex flex-col">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-xs lg:text-xl">Check Out</SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              Input reading penutupan untuk menyelesaikan shift
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3 lg:space-y-4 p-2"
              >
                {/* Nozzle List */}
                <div className="space-y-2 lg:space-y-3">
                  <h3 className="font-semibold text-xs lg:text-base">
                    Nozzle Readings <span className="text-red-500">*</span>
                  </h3>

                  {nozzles.map((nozzle, index) => {
                    const images = form.watch(`readings.${index}.images`) || [];
                    const hasImages = images.length > 0;
                    const openReading = openReadings[nozzle.id];

                    return (
                      <div
                        key={nozzle.id}
                        className="rounded-lg border bg-card"
                      >
                        <div className="w-full p-2 lg:p-3 flex items-center justify-between border-b">
                          <div className="flex items-center gap-2">
                            <NozzleBadge code={nozzle.code} />
                            <span className="text-xs lg:text-sm font-medium">
                              {nozzle.name}
                            </span>
                            {hasImages && (
                              <span className="text-xs text-green-600 font-medium">
                                ✓ {images.length} foto
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`pump-test-${nozzle.id}`}
                              checked={showPumpTest[nozzle.id] || false}
                              onCheckedChange={(checked) => {
                                setShowPumpTest((prev) => ({
                                  ...prev,
                                  [nozzle.id]: !!checked,
                                }));
                                if (!checked) {
                                  form.setValue(
                                    `readings.${index}.pumpTest`,
                                    0
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`pump-test-${nozzle.id}`}
                              className="text-xs lg:text-sm text-muted-foreground cursor-pointer"
                            >
                              Pump Test
                            </Label>
                          </div>
                        </div>

                        <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
                          {/* Totalisator Input Row */}
                          <div className="grid grid-cols-[1fr_2fr_1fr] gap-1.5 lg:gap-3 items-center">
                            {/* Column 1: Label */}
                            <div className="min-w-0">
                              <label className="text-xs lg:text-sm text-muted-foreground">
                                Totalisator Tutup:
                              </label>
                            </div>

                            {/* Column 2: Open Reading */}
                            <div className="flex items-center justify-between lg:pl-3 min-w-0 p-1.5 rounded bg-gray-50">
                              <span className="text-[10px] lg:text-xs text-muted-foreground">
                                Bacaan Buka:
                              </span>
                              <span className="font-mono text-xs lg:text-sm font-semibold text-gray-700">
                                {openReading !== undefined &&
                                openReading !== null
                                  ? formatNumber(openReading)
                                  : "-"}
                              </span>
                            </div>

                            {/* Column 3: Totalisator Input */}
                            <div className="min-w-0">
                              <Controller
                                name={`readings.${index}.totalizerReading`}
                                control={form.control}
                                render={({ field, fieldState }) => (
                                  <div>
                                    <Input
                                      type="text"
                                      placeholder="0"
                                      className={`text-right font-mono text-xs lg:text-sm ${
                                        fieldState.error ? "border-red-500" : ""
                                      }`}
                                      value={
                                        field.value
                                          ? formatNumber(field.value)
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const parsed = parseFormattedNumber(
                                          e.target.value
                                        );
                                        field.onChange(parsed);
                                      }}
                                      onBlur={field.onBlur}
                                    />
                                    {fieldState.error && (
                                      <p className="text-[10px] lg:text-xs text-red-500 mt-0.5">
                                        {fieldState.error.message}
                                      </p>
                                    )}
                                  </div>
                                )}
                              />
                            </div>
                          </div>

                          {/* Pump Test Input */}
                          {showPumpTest[nozzle.id] && (
                            <div className="grid grid-cols-[1fr_2fr_1fr] gap-1.5 lg:gap-3 items-center">
                              {/* Column 1: Label */}
                              <div className="min-w-0">
                                <label className="text-xs lg:text-sm text-muted-foreground">
                                  Pump Test (L):
                                </label>
                              </div>

                              {/* Column 2: Empty */}
                              <div className="min-w-0"></div>

                              {/* Column 3: Pump Test Input */}
                              <div className="min-w-0">
                                <Controller
                                  name={`readings.${index}.pumpTest`}
                                  control={form.control}
                                  render={({ field }) => (
                                    <Input
                                      type="text"
                                      placeholder="0"
                                      className="text-right font-mono text-xs lg:text-sm"
                                      value={
                                        field.value
                                          ? formatNumber(field.value)
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const parsed = parseFormattedNumber(
                                          e.target.value
                                        );
                                        field.onChange(parsed);
                                      }}
                                      onBlur={field.onBlur}
                                    />
                                  )}
                                />
                              </div>
                            </div>
                          )}

                          {/* Upload Foto */}
                          <div className="grid grid-cols-[1fr_2fr_1fr] gap-1.5 lg:gap-3 items-start">
                            {/* Column 1: Label */}
                            <div className="min-w-0">
                              <label className="text-xs lg:text-sm text-muted-foreground">
                                Foto Totalisator:{" "}
                                <span className="text-red-500">*</span>
                              </label>
                            </div>

                            {/* Column 2: Image Links */}
                            <div className="min-w-0 space-y-1">
                              {images.length > 0 ? (
                                images.map((img, imgIndex) => {
                                  const shiftLabel =
                                    currentShift === "MORNING"
                                      ? "Shift 1"
                                      : currentShift === "AFTERNOON"
                                      ? "Shift 2"
                                      : currentShift === "NIGHT"
                                      ? "Shift 3"
                                      : "";
                                  return (
                                    <div
                                      key={imgIndex}
                                      className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-50"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openImagePreview(img)}
                                        className="flex items-center gap-1.5 text-blue-600 hover:underline flex-1 text-left"
                                      >
                                        <ImageIcon className="h-3 w-3" />
                                        Foto Close ({nozzle.code})
                                        {shiftLabel && ` - ${shiftLabel}`} -{" "}
                                        {format(getTodayDate(), "dd/MM/yyyy", {
                                          locale: localeId,
                                        })}
                                      </button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() =>
                                          removeImage(index, imgIndex)
                                        }
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </div>

                            {/* Column 3: Upload Button */}
                            <div className="min-w-0">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileChange(e, index)}
                                className="hidden"
                                id={`upload-checkout-${nozzle.id}`}
                                disabled={uploadingNozzleId === nozzle.id}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full text-xs lg:text-sm h-8 lg:h-9"
                                onClick={() =>
                                  document
                                    .getElementById(
                                      `upload-checkout-${nozzle.id}`
                                    )
                                    ?.click()
                                }
                                disabled={uploadingNozzleId === nozzle.id}
                              >
                                {uploadingNozzleId === nozzle.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2 animate-spin" />
                                    <span className="text-xs lg:text-sm">Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                                    <span className="text-xs lg:text-sm">Upload Foto</span>
                                  </>
                                )}
                              </Button>
                              {form.formState.errors.readings?.[index]
                                ?.images && (
                                <p className="text-xs text-red-500 mt-1">
                                  {
                                    form.formState.errors.readings[index]
                                      ?.images?.message
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-1.5 lg:gap-2 pt-2 lg:pt-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                    className="w-auto text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                  >
                    Batal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-auto text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                  >
                    {loading ? "Menyimpan..." : "Check Out & Simpan"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent showCloseButton={!loading}>
          <DialogHeader>
            <DialogTitle>Konfirmasi Check Out</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menyelesaikan shift ini?
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Jumlah Nozzle:</span>
                <span className="font-semibold">
                  {pendingData.readings.length}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              {loading ? "Menyimpan..." : "Ya, Check Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview Foto</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative w-full">
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
