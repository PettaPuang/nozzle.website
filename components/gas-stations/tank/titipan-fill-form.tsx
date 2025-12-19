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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplets, Loader2, HandCoins } from "lucide-react";
import {
  FormTextareaField,
  FormUploadField,
  ProductBadge,
} from "@/components/reusable/form";
import { calculateTankStockByCalculation } from "@/lib/utils/tank-calculations";
import { z } from "zod";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getTitipanCOAs } from "@/lib/actions/coa.actions";

// Validation schema untuk titipan fill
const titipanFillSchema = z.object({
  tankId: z.string().cuid(),
  titipanName: z.string().min(1, "Pilih nama titipan"),
  literAmount: z.coerce.number().min(1, "Volume harus lebih dari 0"),
  invoiceNumber: z.string().optional(),
  imageUrl: z.union([z.string(), z.array(z.string())]).optional(),
  notes: z.string().optional(),
});

type TitipanFillFormInput = z.infer<typeof titipanFillSchema>;

type TitipanFillFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tankId: string;
  tankName: string;
  tankCapacity: number;
  currentStock: number;
  productName: string;
  productRon?: string | null;
  gasStationId: string; // Tambahkan gasStationId untuk fetch COAs
  onSubmit: (data: TitipanFillFormInput) => Promise<void>;
};

export function TitipanFillForm({
  open,
  onOpenChange,
  tankId,
  tankName,
  tankCapacity,
  currentStock,
  productName,
  productRon,
  gasStationId,
  onSubmit,
}: TitipanFillFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<TitipanFillFormInput | null>(
    null
  );
  const [titipanCOAs, setTitipanCOAs] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const form = useForm<TitipanFillFormInput>({
    resolver: zodResolver(titipanFillSchema) as any,
    defaultValues: {
      tankId: tankId,
      titipanName: "",
      literAmount: 0,
      invoiceNumber: "",
      imageUrl: "",
      notes: "",
    },
  });

  // Fetch titipan COAs when form opens
  useEffect(() => {
    const fetchTitipanCOAs = async () => {
      if (open && gasStationId) {
        try {
          const result = await getTitipanCOAs(gasStationId);
          if (result.success && result.data && Array.isArray(result.data)) {
            setTitipanCOAs(result.data as Array<{ id: string; name: string }>);
          } else {
            setTitipanCOAs([]);
          }
        } catch (error) {
          console.error("Error fetching titipan COAs:", error);
          setTitipanCOAs([]);
        }
      }
    };

    fetchTitipanCOAs();
  }, [open, gasStationId]);

  // Update form tankId ketika prop berubah atau form dibuka
  useEffect(() => {
    if (open && tankId) {
      form.reset({
        tankId: tankId,
        titipanName: "",
        literAmount: 0,
        invoiceNumber: "",
        imageUrl: "",
        notes: "",
      });
      setPendingData(null);
      setConfirmOpen(false);
    }
  }, [open, tankId, form]);

  const literAmount = form.watch("literAmount");
  const titipanName = form.watch("titipanName");

  const literAmountNum = Number(literAmount) || 0;

  // Use centralized calculation utility
  const availableSpace = tankCapacity - currentStock;
  const newTotal = calculateTankStockByCalculation({
    stockOpen: currentStock,
    unloads: literAmountNum,
    sales: 0,
  });
  const isOverCapacity = newTotal > tankCapacity;

  const handleSubmit = async (data: TitipanFillFormInput) => {
    // Validasi tankId sebelum submit
    if (data.tankId !== tankId) {
      toast.error(
        "Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi."
      );
      return;
    }

    // Force update tankId dari prop untuk memastikan konsistensi
    const validatedData = {
      ...data,
      tankId: tankId,
    };

    if (isOverCapacity) {
      alert(
        `Kapasitas tank tidak cukup! Sisa ruang: ${formatNumber(
          availableSpace
        )} L`
      );
      return;
    }
    setPendingData(validatedData);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    // Validasi sekali lagi sebelum submit
    if (pendingData.tankId !== tankId) {
      toast.error(
        "Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi."
      );
      setConfirmOpen(false);
      setPendingData(null);
      return;
    }

    // Force update tankId dari prop untuk memastikan konsistensi
    const finalData = {
      ...pendingData,
      tankId: tankId,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(finalData);
      setConfirmOpen(false);
      onOpenChange(false);
      form.reset({
        tankId: tankId,
        titipanName: "",
        literAmount: 0,
        invoiceNumber: "",
        imageUrl: "",
        notes: "",
      });
      setPendingData(null);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelConfirm = () => {
    if (!isSubmitting) {
      setConfirmOpen(false);
      setPendingData(null);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Form Isi Titipan
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              Input data pengisian BBM dari titipan ke tank {tankName}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-2 lg:space-y-4 px-2 lg:px-4"
            >
              {/* Tank Info */}
              <div className="rounded-lg border bg-blue-50 p-2 lg:p-4">
                <div className="flex items-center justify-between mb-1.5 lg:mb-3">
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Droplets className="h-3 w-3 lg:h-4 lg:w-4 text-blue-600" />
                    <h3 className="font-semibold text-xs lg:text-sm">
                      Informasi Tank
                    </h3>
                  </div>
                  <ProductBadge
                    productName={productName}
                    ron={productRon}
                    className="text-[9px] lg:text-[10px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-2 lg:gap-x-4 gap-y-1 lg:gap-y-2 text-xs lg:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs lg:text-sm">
                      Tank
                    </span>
                    <span className="font-semibold text-xs lg:text-sm">
                      {tankName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs lg:text-sm">
                      Isi Saat Ini
                    </span>
                    <span className="font-semibold font-mono text-xs lg:text-sm">
                      {formatNumber(currentStock)} L
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs lg:text-sm">
                      Kapasitas
                    </span>
                    <span className="font-semibold font-mono text-xs lg:text-sm">
                      {formatNumber(tankCapacity)} L
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs lg:text-sm">
                      Sisa Ruang
                    </span>
                    <span className="font-semibold font-mono text-green-600 text-xs lg:text-sm">
                      {formatNumber(availableSpace)} L
                    </span>
                  </div>
                </div>
              </div>

              {/* Titipan Fill Details */}
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <HandCoins className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                  <h3 className="font-semibold text-xs lg:text-sm">
                    Detail Isi Titipan
                  </h3>
                </div>

                {/* Pilih Titipan */}
                <FormField
                  control={form.control}
                  name="titipanName"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                      <FormLabel className="text-xs lg:text-sm">
                        Nama Titipan <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="space-y-1">
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="text-xs lg:text-sm">
                              <SelectValue placeholder="Pilih nama titipan..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {titipanCOAs.map((coa) => {
                              // Extract nama dari "Titipan XXX"
                              const displayName = coa.name.replace(
                                /^Titipan\s+/,
                                ""
                              );
                              return (
                                <SelectItem
                                  key={coa.id}
                                  value={displayName}
                                  className="text-xs lg:text-sm"
                                >
                                  {displayName}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs lg:text-sm" />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Volume yang Diisi */}
                <FormField
                  control={form.control}
                  name="literAmount"
                  render={({ field, fieldState }) => (
                    <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                      <FormLabel className="text-xs lg:text-sm">
                        Volume (Liter) <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="space-y-1">
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Contoh: 1000"
                            className={cn(
                              "text-xs lg:text-sm text-right font-mono",
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
                        <FormMessage className="text-xs lg:text-sm" />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Preview Calculation */}
                {literAmountNum > 0 && (
                  <div
                    className={`rounded-lg p-2 lg:p-3 text-xs lg:text-sm ${
                      isOverCapacity
                        ? "bg-red-50 border border-red-200"
                        : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <div className="space-y-1 lg:space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs lg:text-sm">
                          Isi Sebelum:
                        </span>
                        <span className="font-semibold font-mono text-xs lg:text-sm">
                          {formatNumber(currentStock)} L
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs lg:text-sm">
                          Ditambah (Titipan):
                        </span>
                        <span className="font-semibold font-mono text-blue-600 text-xs lg:text-sm">
                          +{formatNumber(literAmountNum)} L
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 lg:pt-2 border-t">
                        <span className="text-gray-600 text-xs lg:text-sm">
                          Total Setelah:
                        </span>
                        <span
                          className={`font-semibold font-mono text-xs lg:text-sm ${
                            isOverCapacity ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {formatNumber(newTotal)} L
                        </span>
                      </div>
                      {isOverCapacity && (
                        <div className="text-red-600 font-semibold font-mono pt-1 lg:pt-2 border-t text-xs lg:text-sm">
                          ⚠️ Melebihi kapasitas! Kurangi{" "}
                          {formatNumber(newTotal - tankCapacity)} L
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                      <FormLabel className="text-xs lg:text-sm">
                        Nomor Surat Jalan
                      </FormLabel>
                      <div className="space-y-1">
                        <FormControl>
                          <Input
                            placeholder="Contoh: SJ-001"
                            className="text-xs lg:text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs lg:text-sm" />
                      </div>
                    </FormItem>
                  )}
                />

                <FormUploadField
                  control={form.control}
                  name="imageUrl"
                  label="Foto Bukti"
                  accept="image/*"
                  maxSize={5}
                />

                <FormTextareaField
                  control={form.control}
                  name="notes"
                  label="Catatan"
                  placeholder="Catatan tambahan (opsional)"
                  rows={3}
                />
              </div>

              <div className="flex gap-1.5 lg:gap-2 pt-2 lg:pt-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  size="sm"
                  className="w-auto text-xs lg:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isOverCapacity}
                  size="sm"
                  className="w-auto text-xs lg:text-sm"
                >
                  Submit
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
            <DialogTitle className="text-xs lg:text-sm">
              Konfirmasi Isi Titipan
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin menambahkan{" "}
              <span className="font-semibold">
                {formatNumber(pendingData?.literAmount || 0)} L
              </span>{" "}
              dari titipan{" "}
              <span className="font-semibold">{pendingData?.titipanName}</span>{" "}
              ke tank <span className="font-semibold">{tankName}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-3 text-xs lg:text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Nama Titipan:</span>
              <span className="font-semibold">{pendingData?.titipanName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Isi Sebelum:</span>
              <span className="font-semibold">
                {formatNumber(currentStock)} L
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ditambah:</span>
              <span className="font-semibold text-blue-600">
                + {formatNumber(pendingData?.literAmount || 0)} L
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Isi Setelah:</span>
              <span className="font-bold text-green-600">
                {formatNumber(currentStock + (pendingData?.literAmount || 0))} L
              </span>
            </div>
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
                "Ya, Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
