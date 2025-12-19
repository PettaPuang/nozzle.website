"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Gauge, Loader2, Upload, X } from "lucide-react";
import {
  FormInputField,
  FormTextareaField,
  ProductBadge,
} from "@/components/reusable/form";
import { createTankReadingSchema } from "@/lib/validations/operational.validation";
import { z } from "zod";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getOperationalDateForTankReading } from "@/lib/utils/datetime";

type TankReadingFormInput = z.infer<typeof createTankReadingSchema>;

// Explicit form type untuk handle z.coerce
type TankReadingFormValues = {
  tankId: string;
  literValue: number;
  imageUrl: string;
  notes?: string;
};

type TankReadingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tankId: string;
  tankName: string;
  tankCapacity: number;
  currentStock: number;
  productName: string;
  productRon: string | null;
  gasStationOpenTime?: string | null;
  gasStationCloseTime?: string | null;
  onSubmit: (data: TankReadingFormInput) => Promise<void>;
};

export function TankReadingForm({
  open,
  onOpenChange,
  tankId,
  tankName,
  tankCapacity,
  currentStock,
  productName,
  productRon,
  gasStationOpenTime,
  gasStationCloseTime,
  onSubmit,
}: TankReadingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<TankReadingFormValues | null>(
    null
  );
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Calculate operational date yang akan ditutup
  const operationalDate = getOperationalDateForTankReading(
    new Date(), // Current time in user's local timezone
    gasStationOpenTime || null,
    gasStationCloseTime || null
  );

  const form = useForm<TankReadingFormValues>({
    resolver: zodResolver(createTankReadingSchema) as any,
    defaultValues: {
      tankId,
      literValue: 0,
      imageUrl: "",
      notes: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        tankId,
        literValue: 0,
        imageUrl: "",
        notes: "",
      });
      setImagePreviews([]);
    }
  }, [open, tankId, form]);

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
      
      // Update form dengan array URLs atau single URL
      const currentUrls = form.getValues("imageUrl");
      const currentUrlsArray = Array.isArray(currentUrls) 
        ? currentUrls 
        : currentUrls 
        ? [currentUrls] 
        : [];
      
      const updatedUrls = [...currentUrlsArray, ...newUrls];
      form.setValue("imageUrl", updatedUrls.length === 1 ? updatedUrls[0] : updatedUrls);
      
      toast.success("Foto berhasil diupload");
    } catch (error) {
      // Error already handled in individual uploads
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    const currentUrls = form.getValues("imageUrl");
    const currentUrlsArray = Array.isArray(currentUrls) 
      ? currentUrls 
      : currentUrls 
      ? [currentUrls] 
      : [];
    
    const newUrls = currentUrlsArray.filter((_, i) => i !== index);

    setImagePreviews(newPreviews);
    form.setValue("imageUrl", newUrls.length === 1 ? newUrls[0] : newUrls.length > 0 ? newUrls : "");
  };

  const handleFormSubmit = (data: TankReadingFormValues) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      // Add timezone offset untuk server processing
      const dataWithTimezone = {
        ...pendingData,
        timezoneOffset: new Date().getTimezoneOffset(), // User timezone offset dalam menit
      };
      
      await onSubmit(dataWithTimezone);
      setConfirmOpen(false);
      form.reset();
      setImagePreviews([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Tank Reading submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
    setPendingData(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <>
      <Sheet open={open && !confirmOpen} onOpenChange={handleClose}>
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="flex items-center gap-1.5 lg:gap-2 text-base lg:text-xl">
              <Gauge className="h-4 w-4 lg:h-5 lg:w-5" />
              Input Tank Reading
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              Input volume liter untuk tank {tankName}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className="space-y-2 lg:space-y-4 px-2 lg:px-4"
            >
              {/* Tank Info */}
              <div className="rounded-lg border bg-blue-50 p-2 lg:p-4">
                <div className="flex items-center justify-between mb-1.5 lg:mb-3">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Gauge className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                    <h3 className="font-semibold text-xs lg:text-sm">
                      Informasi Tank
                    </h3>
                  </div>
                  <ProductBadge
                    productName={productName}
                    ron={productRon}
                    showRON={false}
                    className="text-[9px] lg:text-[10px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-2 lg:gap-x-4 gap-y-1 lg:gap-y-2 text-xs lg:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-[10px] lg:text-xs">
                      Tank
                    </span>
                    <span className="font-semibold text-[10px] lg:text-sm">
                      {tankName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-[10px] lg:text-xs">
                      Isi Saat Ini
                    </span>
                    <span className="font-semibold text-[10px] lg:text-sm">
                      {formatNumber(currentStock)} L
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-[10px] lg:text-xs">
                      Kapasitas
                    </span>
                    <span className="font-semibold text-[10px] lg:text-sm">
                      {formatNumber(tankCapacity)} L
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Pengisian */}
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <h3 className="font-semibold text-xs lg:text-sm">
                  Detail Pengisian
                </h3>

                {/* Volume Reading */}
                <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-start gap-1.5 lg:gap-3">
                  <FormLabel className="text-[10px] lg:text-sm pt-2">
                    Volume Reading <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormField
                    control={form.control}
                    name="literValue"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Jumlah liter"
                            className={cn(
                              "text-right font-mono",
                              fieldState.error &&
                                "border-red-500 focus-visible:ring-red-500"
                            )}
                            value={field.value ? formatNumber(field.value) : ""}
                            onChange={(e) => {
                              const rawValue = e.target?.value || "";
                              const numValue = parseFormattedNumber(rawValue);
                              field.onChange(numValue || 0);
                            }}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Photo Upload Section */}
                <div className="space-y-2 lg:space-y-3">
                  <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                    <h3 className="font-semibold text-xs lg:text-sm">
                      Foto Bukti <span className="text-red-500">*</span>
                    </h3>
                  </div>

                  <div className="space-y-2 lg:space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="tank-reading-upload"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full h-16 lg:h-20 flex-col gap-0.5 lg:gap-1 text-xs lg:text-sm"
                      onClick={() =>
                        document.getElementById("tank-reading-upload")?.click()
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
                    {form.formState.errors.imageUrl && (
                      <p className="text-[10px] lg:text-xs text-red-500">
                        {form.formState.errors.imageUrl.message as string}
                      </p>
                    )}
                  </div>
                </div>

                <FormTextareaField
                  control={form.control}
                  name="notes"
                  label="Catatan"
                  placeholder="Catatan tambahan (optional)"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 lg:gap-3 pt-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="w-auto text-xs lg:text-sm"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="w-auto text-xs lg:text-sm"
                >
                  Simpan Reading
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Konfirmasi Tank Reading</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin data tank reading sudah benar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Tank:</span>
                <span className="font-semibold">{tankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Product:</span>
                <ProductBadge productName={productName} ron={productRon} />
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Stock Realtime ({format(operationalDate, "dd/MM/yyyy", { locale: localeId })}):
                </span>
                <span className="font-mono font-semibold text-gray-700">
                  {formatNumber(currentStock)} L
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="text-gray-600">Tank Reading:</span>
                <span className="font-mono font-bold text-blue-600">
                  {formatNumber(pendingData?.literValue || 0)} L
                </span>
              </div>
            </div>

            {pendingData?.notes && (
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="text-gray-600 text-xs font-semibold">Catatan:</span>
                <p className="text-sm mt-1">{pendingData.notes}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Konfirmasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
