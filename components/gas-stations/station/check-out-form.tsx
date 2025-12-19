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
import { bulkCreateNozzleReading } from "@/lib/actions/nozzle-reading.actions";
import { checkOut } from "@/lib/actions/operator-shift.actions";
import { getShiftWithSales } from "@/lib/actions/operator.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { NozzleBadge } from "@/components/reusable/badges/nozzle-badge";
import { Upload, X, Loader2 } from "lucide-react";
import { Fuel } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const readingSchema = z.object({
  nozzleId: z.string(),
  totalizerReading: z.coerce.number().min(0, "Totalisator tidak boleh negatif"),
  pumpTest: z.coerce.number().min(0, "Pump test tidak boleh negatif").default(0),
});

const formSchema = z.object({
  readings: z.array(readingSchema).min(1),
  images: z.array(z.string()).min(1, "Foto bukti wajib diisi"),
});

type CheckOutSheetProps = {
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

type NozzleOpenReading = {
  nozzleId: string;
  openReading: number;
};

export function CheckOutSheet({
  open,
  onOpenChange,
  operatorShiftId,
  nozzles,
  onSuccess,
}: CheckOutSheetProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [openReadings, setOpenReadings] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showPumpTest, setShowPumpTest] = useState(false);
  const [pendingData, setPendingData] = useState<z.infer<
    typeof formSchema
  > | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      readings: nozzles.map((nozzle) => ({
        nozzleId: nozzle.id,
        totalizerReading: 0,
        pumpTest: 0,
      })),
      images: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "readings",
  });

  // Fetch OPEN readings when sheet opens
  const fetchOpenReadings = async () => {
    if (!operatorShiftId) return;

    try {
      const result = await getShiftWithSales(operatorShiftId);

      if (result.success && result.data) {
        const data = result.data as {
          nozzleReadings?: Array<{
            nozzleId: string;
            readingType: string;
            totalizerReading: number;
          }>;
        };

        const readingsMap: Record<string, number> = {};

        // Initialize semua nozzle dengan null (akan ditampilkan sebagai "-")
        nozzles.forEach((nozzle) => {
          readingsMap[nozzle.id] = null as any;
        });

        // Update dengan data OPEN reading yang ada
        if (data.nozzleReadings) {
          data.nozzleReadings.forEach((reading) => {
            if (reading.readingType === "OPEN") {
              readingsMap[reading.nozzleId] = Number(reading.totalizerReading);
            }
          });
        }

        setOpenReadings(readingsMap);
      }
    } catch (error) {
      console.error("Error fetching open readings:", error);
    }
  };

  // Fetch open readings when sheet opens
  useEffect(() => {
    if (open && operatorShiftId) {
      fetchOpenReadings();
    }
  }, [open, operatorShiftId]);

  // Set default values untuk totalisator tutup dari open reading
  useEffect(() => {
    if (open && operatorShiftId && Object.keys(openReadings).length > 0) {
      nozzles.forEach((nozzle, index) => {
        const openReading = openReadings[nozzle.id];
        if (openReading !== undefined && openReading !== null) {
          form.setValue(`readings.${index}.totalizerReading` as any, openReading);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, operatorShiftId, openReadings]);

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
            message: `Totalisator tutup tidak boleh lebih kecil dari bacaan buka (${formatNumber(openReading)})`,
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
      // 1. Create CLOSE readings
      // Semua reading menggunakan imageUrl yang sama (foto totalisator penutupan)
      const imageUrls = pendingData.images || [];
      const imageUrl = imageUrls.length > 0 
        ? (imageUrls.length === 1 ? imageUrls[0] : imageUrls) // Single URL atau array of URLs
        : undefined; // Optional jika tidak ada gambar

      const readingResult = await bulkCreateNozzleReading({
        operatorShiftId,
        readingType: "CLOSE",
        readings: pendingData.readings.map((reading) => ({
          ...reading,
          pumpTest: reading.pumpTest || 0,
          imageUrl: imageUrl,
          priceSnapshot: nozzles.find((n) => n.id === reading.nozzleId)?.product.sellingPrice || 0,
        })),
      });

      if (!readingResult.success) {
        toast.error(readingResult.message);
        setLoading(false);
        return;
      }

      // 2. Check out shift
      const checkOutResult = await checkOut({
        operatorShiftId,
      });

      if (checkOutResult.success) {
        toast.success(checkOutResult.message);
        setConfirmOpen(false);
        onOpenChange(false);
        form.reset();
        setImagePreviews([]);
        setPendingData(null);
        setShowPumpTest(false);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-2 overflow-y-auto">
        <SheetHeader className="px-2 pt-2">
          <SheetTitle className="text-base lg:text-xl">
            Check Out & Input Reading Penutupan
          </SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            Masukkan angka totalisator akhir untuk semua nozzle
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] lg:h-[calc(100vh-140px)] px-2 lg:px-4 pb-2 lg:pb-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-2 lg:space-y-4"
            >
              {/* Nozzle Readings */}
              <div className="space-y-1.5 lg:space-y-3 py-1.5 lg:py-2 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center justify-between pb-1.5 lg:pb-2 border-b">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Fuel className="h-3.5 w-3.5 lg:h-5 lg:w-5 text-primary" />
                    <h3 className="font-semibold text-xs lg:text-base">
                      Input Totalisator Penutupan
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Checkbox
                      id="show-pump-test"
                      checked={showPumpTest}
                      onCheckedChange={(checked) => {
                        setShowPumpTest(checked === true);
                        if (!checked) {
                          // Reset semua pump test ke 0 jika checkbox di-uncheck
                          form.getValues("readings").forEach((_, index) => {
                            form.setValue(`readings.${index}.pumpTest` as any, 0);
                          });
                        }
                      }}
                    />
                    <Label
                      htmlFor="show-pump-test"
                      className="text-xs lg:text-sm cursor-pointer"
                    >
                      Ada Pump Test
                    </Label>
                  </div>
                </div>

                <div className="space-y-1.5 lg:space-y-2">
                  {fields.map((field, index) => {
                    const nozzle = nozzles[index];
                    const openReading = openReadings[nozzle.id];

                    return (
                      <div
                        key={field.id}
                        className="space-y-1.5 lg:space-y-2 p-1.5 lg:p-3 rounded-lg border bg-white"
                      >
                        {/* Row 1: Nozzle Info | Open Reading | Totalisator Tutup */}
                        <div className="grid grid-cols-[2fr_1fr_1fr] gap-1.5 lg:gap-3 items-center">
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

                          {/* Column 2: Open Reading */}
                          <div className="flex flex-col justify-center border-l pl-1.5 lg:pl-3 min-w-0">
                            <span className="text-[10px] lg:text-xs text-muted-foreground mb-0.5 lg:mb-1">
                              Buka:
                            </span>
                            <span className="font-mono text-xs lg:text-sm font-semibold text-gray-700">
                              {openReading !== undefined && openReading !== null
                                ? formatNumber(openReading)
                                : "-"}
                            </span>
                          </div>

                          {/* Column 3: Totalisator Input */}
                          <div className="min-w-0">
                            <label className="text-[10px] lg:text-xs text-muted-foreground mb-0.5 lg:mb-1 block">
                              Tutup:
                            </label>
                            <Controller
                              name={`readings.${index}.totalizerReading` as any}
                              control={form.control}
                              rules={{
                                validate: (value) => {
                                  const openReading = openReadings[nozzle.id];
                                  if (openReading !== undefined && openReading !== null) {
                                    if (value < openReading) {
                                      return `Totalisator tutup tidak boleh lebih kecil dari bacaan buka (${formatNumber(openReading)})`;
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

                        {/* Row 2: Pump Test Input - hanya tampil jika checkbox dicentang */}
                        {showPumpTest && (
                          <div className="min-w-0">
                            <label className="text-[10px] lg:text-xs text-muted-foreground mb-0.5 lg:mb-1 block">
                              Pump Test (L):
                            </label>
                            <Controller
                              name={`readings.${index}.pumpTest` as any}
                              control={form.control}
                              render={({ field }) => (
                                <Input
                                  type="text"
                                  placeholder="0"
                                  className="text-right font-mono"
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
                              )}
                            />
                          </div>
                        )}
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
                    id="multiple-upload-checkout"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-16 lg:h-20 flex-col gap-0.5 lg:gap-1 text-xs lg:text-sm"
                    onClick={() =>
                      document
                        .getElementById("multiple-upload-checkout")
                        ?.click()
                    }
                    disabled={uploadingImages}
                  >
                    <div className="flex items-center gap-1.5 lg:gap-2">
                      {uploadingImages ? (
                        <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 lg:h-5 lg:w-5" />
                      )}
                      <span>{uploadingImages ? "Uploading..." : "Upload Foto Reading"}</span>
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
                  {loading ? "Menyimpan..." : "Check Out & Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent
          className="p-2 lg:p-6"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-xs lg:text-sm">
              Konfirmasi Check Out
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin melakukan check out dengan data berikut?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
            {pendingData && (
              <>
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
                  <div className="text-gray-600 mb-1 lg:mb-1.5 font-semibold">
                    Detail Reading:
                  </div>
                  <div className="rounded-lg border bg-white overflow-hidden">
                    <div className="overflow-x-auto max-h-48 lg:max-h-64 overflow-y-auto">
                      <table className="w-full text-xs lg:text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-1.5 lg:p-2 font-semibold text-gray-700">
                              Nozzle
                            </th>
                            <th className="text-right p-1.5 lg:p-2 font-semibold text-gray-700">
                              Buka
                            </th>
                            <th className="text-right p-1.5 lg:p-2 font-semibold text-gray-700">
                              Tutup
                            </th>
                            <th className="text-right p-1.5 lg:p-2 font-semibold text-gray-700">
                              Sales
                            </th>
                            {(pendingData.readings.some((r) => (r.pumpTest || 0) > 0)) && (
                              <th className="text-right p-1.5 lg:p-2 font-semibold text-gray-700">
                                Pump Test
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {pendingData.readings.map((reading, index) => {
                            const nozzle = nozzles[index];
                            const openReading = openReadings[nozzle.id];
                            const salesVolume = openReading !== undefined
                              ? Math.max(0, reading.totalizerReading - openReading - (reading.pumpTest || 0))
                              : 0;
                            return (
                              <tr key={reading.nozzleId} className="border-t">
                                <td className="p-1.5 lg:p-2">
                                  <div className="font-medium text-gray-900">
                                    {nozzle.name}
                                  </div>
                                </td>
                                <td className="p-1.5 lg:p-2 text-right font-mono">
                                  {openReading !== undefined
                                    ? formatNumber(openReading)
                                    : "-"}
                                </td>
                                <td className="p-1.5 lg:p-2 text-right font-mono font-semibold">
                                  {formatNumber(reading.totalizerReading)}
                                </td>
                                <td className="p-1.5 lg:p-2 text-right font-mono font-semibold text-green-600">
                                  {formatNumber(salesVolume)} L
                                </td>
                                {(pendingData.readings.some((r) => (r.pumpTest || 0) > 0)) && (
                                  <td className="p-1.5 lg:p-2 text-right font-mono text-orange-600">
                                    {(reading.pumpTest || 0) > 0
                                      ? `${formatNumber(reading.pumpTest || 0)} L`
                                      : "-"}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
                "Ya, Check Out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
