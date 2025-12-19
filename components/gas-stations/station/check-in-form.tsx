"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  checkIn,
  deleteOperatorShift,
  getNextShiftForStation,
} from "@/lib/actions/operator-shift.actions";
import { bulkCreateNozzleReading } from "@/lib/actions/nozzle-reading.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { NozzleBadge } from "@/components/reusable/badges/nozzle-badge";
import { Upload, X } from "lucide-react";
import {
  FormInputField,
  FormSelectField,
  FormUploadField,
} from "@/components/reusable/form";
import { checkInSchema } from "@/lib/validations/operational.validation";
import { Fuel, Loader2 } from "lucide-react";
import { startOfDayUTC, getTodayLocalAsUTC } from "@/lib/utils/datetime";
import { formatDateDisplay } from "@/lib/utils/format-datetime";

// Schema untuk form UI (gabungan check in + readings)
const checkInFormSchema = z.object({
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  readings: z
    .array(
      z.object({
        nozzleId: z.string(),
        totalizerReading: z.coerce
          .number()
          .min(0, "Totalisator tidak boleh negatif"),
      })
    )
    .min(1),
  images: z.array(z.string()).min(1, "Foto bukti wajib diisi"),
});

type CheckInSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationId: string;
  gasStationId: string;
  nozzles: Array<{
    id: string;
    code: string;
    name: string;
    product: {
      name: string;
      sellingPrice: number;
    };
    latestReading?: {
      shift: string;
      open: number | null;
      close: number | null;
      operator: string;
    };
  }>;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  onSuccess?: () => void;
};

export function CheckInSheet({
  open,
  onOpenChange,
  stationId,
  gasStationId,
  nozzles,
  gasStationOpenTime,
  gasStationCloseTime,
  onSuccess,
}: CheckInSheetProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<z.infer<
    typeof checkInFormSchema
  > | null>(null);
  const [previewShift, setPreviewShift] = useState<
    "MORNING" | "AFTERNOON" | "NIGHT" | null
  >(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof checkInFormSchema>>({
    resolver: zodResolver(checkInFormSchema) as any,
    defaultValues: {
      shift: "MORNING",
      readings: nozzles.map((nozzle) => ({
        nozzleId: nozzle.id,
        totalizerReading: nozzle.latestReading?.close || 0,
      })),
      images: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "readings",
  });

  // Helper function untuk mendapatkan tanggal hari ini dalam UTC
  // Menggunakan tanggal lokal user untuk konsistensi dengan UX
  // Check in harus menggunakan tanggal lokal user karena shift berdasarkan hari kerja lokal
  const getTodayDate = () => {
    // Ambil tanggal lokal user dan konversi ke UTC start of day
    // Gunakan startOfDayUTC untuk konsistensi dengan backend
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

  // Fetch preview shift saat form dibuka
  useEffect(() => {
    if (open && stationId) {
      fetchPreviewShift();
    } else {
      setPreviewShift(null);
      // Reset form saat sheet ditutup
      form.reset({
        shift: "MORNING",
        readings: nozzles.map((nozzle) => ({
          nozzleId: nozzle.id,
          totalizerReading: nozzle.latestReading?.close || 0,
        })),
        images: [],
      });
      setImagePreviews([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stationId]);

  const fetchPreviewShift = async () => {
    setLoadingShift(true);
    try {
      const todayDate = getTodayDate();
      const result = await getNextShiftForStation(stationId, todayDate);
      if (result.success && result.data) {
        setPreviewShift(result.data);
        form.setValue("shift", result.data); // Set untuk validation
      } else {
        setPreviewShift("MORNING"); // Fallback
        form.setValue("shift", "MORNING");
      }
    } catch (error) {
      console.error("Error fetching preview shift:", error);
      setPreviewShift("MORNING"); // Fallback
      form.setValue("shift", "MORNING");
    } finally {
      setLoadingShift(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);

    // Validate all files first
    for (const file of fileArray) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} terlalu besar. Max 5MB per file`);
        return;
      }
    }

    setUploadingImages(true);

    // Upload all files to server
    const uploadPromises = fileArray.map(async (file) => {
      // Create preview first
      const reader = new FileReader();
      const previewPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      // Upload to server
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Gagal upload file");
        }

        const data = await response.json();
        const preview = await previewPromise;

        return { url: data.url, preview };
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(
          error instanceof Error ? error.message : "Gagal upload foto"
        );
        throw error;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map((r) => r.url);
      const newPreviews = results.map((r) => r.preview);

      setImagePreviews((prev) => [...prev, ...newPreviews]);
      form.setValue("images", [
        ...(form.getValues("images") || []),
        ...newUrls,
      ]);
      toast.success("Foto berhasil diupload");
    } catch (error) {
      // Error already handled in individual uploads
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    const newImages =
      form.getValues("images")?.filter((_, i) => i !== index) || [];

    setImagePreviews(newPreviews);
    form.setValue("images", newImages);
  };

  const handleSubmit = async (data: z.infer<typeof checkInFormSchema>) => {
    // Validate operational hours before check in (menggunakan waktu local browser untuk konsistensi)
    if (!gasStationOpenTime || !gasStationCloseTime) {
      // Jika jam operasional belum diatur, izinkan check in
    } else {
      const now = new Date(); // Waktu local browser
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [openHour, openMinute] = gasStationOpenTime.split(":").map(Number);
      const [closeHour, closeMinute] = gasStationCloseTime
        .split(":")
        .map(Number);
      const openTimeInMinutes = openHour * 60 + openMinute;
      const closeTimeInMinutes = closeHour * 60 + closeMinute;

      let isOperational: boolean;
      // Handle case closeTime melewati midnight
      if (closeTimeInMinutes < openTimeInMinutes) {
        isOperational =
          currentTime >= openTimeInMinutes || currentTime <= closeTimeInMinutes;
      } else {
        // Normal case
        isOperational =
          currentTime >= openTimeInMinutes && currentTime <= closeTimeInMinutes;
      }

      // Check in hanya bisa dilakukan antara jam operasional
      if (!isOperational) {
        toast.error(
          `Check in hanya bisa dilakukan antara jam operasional (${gasStationOpenTime} - ${gasStationCloseTime})`
        );
        return;
      }
    }

    // Validasi totalisator tidak boleh lebih kecil dari bacaan sebelumnya
    let hasError = false;
    data.readings.forEach((reading, index) => {
      const nozzle = nozzles[index];
      const lastReading = nozzle.latestReading?.close;
      if (lastReading !== null && lastReading !== undefined) {
        if (reading.totalizerReading < lastReading) {
          form.setError(`readings.${index}.totalizerReading` as any, {
            type: "manual",
            message: `Totalisator tidak boleh lebih kecil dari bacaan terakhir (${formatNumber(
              lastReading
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
      // 1. Check in dulu
      const todayDate = getTodayDate();
      const checkInResult = await checkIn({
        stationId,
        gasStationId,
        shift: pendingData.shift,
        date: todayDate,
      });

      if (!checkInResult.success || !checkInResult.data) {
        toast.error(checkInResult.message);
        setLoading(false);
        return;
      }

      // 2. Input reading OPEN dengan auto-generate notes jika berbeda dengan bacaan terakhir
      const readingResult = await bulkCreateNozzleReading({
        operatorShiftId: checkInResult.data.id,
        readingType: "OPEN",
        readings: pendingData.readings.map((reading, index) => {
          const nozzle = nozzles[index];
          const lastReading = nozzle.latestReading?.close;
          const currentReading = reading.totalizerReading;

          // Auto-generate notes jika nilai berbeda dengan bacaan terakhir
          let autoNotes: string | undefined = undefined;
          if (
            lastReading !== null &&
            lastReading !== undefined &&
            currentReading !== lastReading
          ) {
            const difference = currentReading - lastReading;
            autoNotes = `Bacaan berbeda dari bacaan terakhir. Bacaan terakhir: ${formatNumber(
              lastReading
            )}, Bacaan saat ini: ${formatNumber(currentReading)}, Selisih: ${
              difference > 0 ? "+" : ""
            }${formatNumber(difference)}`;
          }

          // Semua reading menggunakan imageUrl yang sama (foto totalisator pembukaan)
          // imageUrl bisa string URL atau array of URLs
          const imageUrls = pendingData.images || [];
          const imageUrl =
            imageUrls.length > 0
              ? imageUrls.length === 1
                ? imageUrls[0]
                : imageUrls // Single URL atau array of URLs
              : undefined; // Optional jika tidak ada gambar

          return {
            ...reading,
            pumpTest: 0,
            imageUrl: imageUrl,
            priceSnapshot: nozzles[index].product.sellingPrice, // Snapshot harga dari product
            notes: autoNotes,
          };
        }),
      });

      if (readingResult.success) {
        toast.success("Check in dan input reading berhasil");
        setConfirmOpen(false);
        onOpenChange(false);
        form.reset();
        setImagePreviews([]);
        setPendingData(null);
        onSuccess?.();
      } else {
        // Jika reading gagal, hapus shift yang sudah dibuat (rollback)
        toast.error(readingResult.message);
        try {
          // Hapus shift yang sudah dibuat karena reading gagal
          const deleteResult = await deleteOperatorShift(checkInResult.data.id);
          if (deleteResult.success) {
            toast.error("Check-in dibatalkan karena input reading gagal");
          } else {
            toast.error(
              "Shift dibuat tapi reading gagal. Silakan hubungi admin."
            );
          }
        } catch (deleteError) {
          console.error("Error deleting shift:", deleteError);
          toast.error(
            "Shift dibuat tapi reading gagal. Silakan hubungi admin."
          );
        }
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-2 overflow-y-auto">
        <SheetHeader className="px-2 pt-2">
          <SheetTitle className="text-base lg:text-xl">
            Check In & Input Reading Pembukaan
          </SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            Pilih shift dan masukkan angka totalisator awal
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] lg:h-[calc(100vh-140px)] px-2 lg:px-4 pb-2 lg:pb-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-2 lg:space-y-4"
            >
              {/* Shift Preview (Auto-detected) */}
              <div className="rounded-lg border bg-card p-2 lg:p-4">
                <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                  <label className="text-xs lg:text-sm font-medium">
                    Shift
                  </label>
                  <div>
                    {loadingShift ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs lg:text-sm text-muted-foreground">
                          Mendeteksi shift...
                        </span>
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={
                          previewShift
                            ? `${formatDateDisplay(
                                getTodayDate(),
                                "dd MMM yyyy"
                              )} - ${
                                previewShift === "MORNING"
                                  ? "Shift 1"
                                  : previewShift === "AFTERNOON"
                                  ? "Shift 2"
                                  : "Shift 3"
                              }`
                            : `${formatDateDisplay(
                                getTodayDate(),
                                "dd MMM yyyy"
                              )} - Shift 1`
                        }
                        disabled
                        className="text-xs lg:text-sm bg-muted cursor-not-allowed"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Nozzle Readings */}
              <div className="space-y-1.5 lg:space-y-3 py-1.5 lg:py-2 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <Fuel className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-primary" />
                  <h3 className="font-semibold text-xs lg:text-base">
                    Input Totalisator Pembukaan
                  </h3>
                </div>

                <div className="space-y-1.5 lg:space-y-2">
                  {fields.map((field, index) => {
                    const nozzle = nozzles[index];
                    const lastReading = nozzle.latestReading?.close;

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-[2fr_1fr_1fr] gap-1.5 lg:gap-3 items-center p-1.5 lg:p-3 rounded-lg border bg-white"
                      >
                        {/* Column 1: Nozzle Info */}
                        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0">
                          <NozzleBadge
                            code={nozzle.code}
                            productName={nozzle.product.name}
                            className="text-[10px] lg:text-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs lg:text-sm font-medium truncate">
                              {nozzle.name}
                            </p>
                          </div>
                        </div>

                        {/* Column 2: Last Reading */}
                        <div className="flex flex-col justify-center border-l pl-1.5 lg:pl-3 min-w-0">
                          <span className="text-[10px] lg:text-xs text-muted-foreground mb-0.5 lg:mb-1">
                            Bacaan Terakhir:
                          </span>
                          <span className="font-mono text-xs lg:text-sm font-semibold text-gray-700">
                            {lastReading ? formatNumber(lastReading) : "-"}
                          </span>
                        </div>

                        {/* Column 3: Totalisator Input */}
                        <div className="min-w-0">
                          <Controller
                            name={`readings.${index}.totalizerReading` as any}
                            control={form.control}
                            rules={{
                              validate: (value) => {
                                const lastReading = nozzle.latestReading?.close;
                                if (
                                  lastReading !== null &&
                                  lastReading !== undefined
                                ) {
                                  if (value < lastReading) {
                                    return `Totalisator tidak boleh lebih kecil dari bacaan terakhir (${formatNumber(
                                      lastReading
                                    )})`;
                                  }
                                }
                                return true;
                              },
                            }}
                            render={({ field, fieldState }) => (
                              <div>
                                <Input
                                  type="text"
                                  placeholder="0"
                                  className={`text-right font-mono ${
                                    fieldState.error ? "border-red-500" : ""
                                  }`}
                                  value={
                                    field.value ? formatNumber(field.value) : ""
                                  }
                                  onChange={(e) => {
                                    const rawValue = e.target?.value || "";
                                    const numValue =
                                      parseFormattedNumber(rawValue);
                                    field.onChange(numValue);
                                  }}
                                  onBlur={() => field.onBlur()}
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
                    );
                  })}
                </div>
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-2 lg:space-y-3 py-1.5 lg:py-2 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <h3 className="font-semibold text-xs lg:text-base">
                    Foto Totalisator <span className="text-red-500">*</span>
                  </h3>
                </div>

                <div className="space-y-2 lg:space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="multiple-upload"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-16 lg:h-20 flex-col gap-0.5 lg:gap-1 text-xs lg:text-sm"
                    onClick={() =>
                      document.getElementById("multiple-upload")?.click()
                    }
                    disabled={uploadingImages}
                  >
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      {uploadingImages ? (
                        <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 lg:h-5 lg:w-5" />
                      )}
                      <span>
                        {uploadingImages
                          ? "Uploading..."
                          : "Upload Foto Reading"}
                      </span>
                    </div>
                    <span className="text-[10px] lg:text-xs text-muted-foreground font-normal">
                      Bisa upload multiple foto (JPG, PNG, max 5MB per foto)
                    </span>
                  </Button>

                  {/* Image Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 lg:gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 lg:h-32 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-0.5 right-0.5 lg:top-1 lg:right-1 h-5 w-5 lg:h-6 lg:w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3 lg:h-4 lg:w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.formState.errors.images && (
                    <p className="text-xs lg:text-sm text-red-500">
                      {form.formState.errors.images.message}
                    </p>
                  )}
                </div>
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
                  {loading ? "Menyimpan..." : "Check In & Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent className="p-2 lg:p-6" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xs lg:text-sm">
              Konfirmasi Check In
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin melakukan check in dengan data berikut?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
            {pendingData && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift:</span>
                  <span className="font-semibold">
                    {previewShift
                      ? previewShift === "MORNING"
                        ? "Shift 1"
                        : previewShift === "AFTERNOON"
                        ? "Shift 2"
                        : "Shift 3"
                      : pendingData.shift === "MORNING"
                      ? "Shift 1"
                      : pendingData.shift === "AFTERNOON"
                      ? "Shift 2"
                      : "Shift 3"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jumlah Nozzle:</span>
                  <span className="font-semibold">
                    {pendingData.readings.length}
                  </span>
                </div>
                {pendingData.images && pendingData.images.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Jumlah Foto:</span>
                    <span className="font-semibold">
                      {pendingData.images.length}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 lg:pt-2 border-t">
                  <div className="text-gray-600 mb-1 lg:mb-1.5">
                    Detail Reading:
                  </div>
                  <div className="space-y-1 lg:space-y-1.5 max-h-32 lg:max-h-40 overflow-y-auto">
                    {pendingData.readings.map((reading, index) => {
                      const nozzle = nozzles.find(
                        (n) => n.id === reading.nozzleId
                      );
                      return (
                        <div
                          key={reading.nozzleId}
                          className="flex justify-between items-center text-xs lg:text-sm"
                        >
                          <span className="text-gray-600 font-medium">
                            {nozzle?.name || nozzle?.code || "Unknown"}
                          </span>
                          <span className="font-mono font-semibold">
                            {formatNumber(reading.totalizerReading)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
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
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Ya, Check In"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
