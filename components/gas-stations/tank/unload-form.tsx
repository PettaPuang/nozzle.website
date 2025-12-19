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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplets, Loader2 } from "lucide-react";
import {
  FormInputField,
  FormTextareaField,
  FormUploadField,
  ProductBadge,
} from "@/components/reusable/form";
import { calculateTankStockByCalculation } from "@/lib/utils/tank-calculations";
import { createUnloadSchema } from "@/lib/validations/operational.validation";
import { z } from "zod";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLORemainingByTank } from "@/lib/actions/unload.actions";
import { createZodResolver } from "@/lib/utils/form-types";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";

type UnloadFormInput = z.infer<typeof createUnloadSchema>;

type UnloadFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tankId: string;
  tankName: string;
  tankCapacity: number;
  currentStock: number;
  productName: string;
  productRon?: string | null;
  gasStationId: string;
  userRole: RoleCode;
  onSubmit: (data: UnloadFormInput) => Promise<void>;
};

export function UnloadForm({
  open,
  onOpenChange,
  tankId,
  tankName,
  tankCapacity,
  currentStock,
  productName,
  productRon,
  gasStationId,
  userRole,
  onSubmit,
}: UnloadFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<UnloadFormInput | null>(null);
  const [loData, setLoData] = useState<{
    remainingVolume: number;
  } | null>(null);
  const [isLoadingLO, setIsLoadingLO] = useState(false);

  const form = useForm<UnloadFormInput>({
    resolver: createZodResolver(createUnloadSchema),
    defaultValues: {
      tankId: tankId,
      deliveredVolume: undefined,
      literAmount: 0,
      invoiceNumber: "",
      imageUrl: "",
      notes: "",
    },
  });

  // Update form tankId ketika prop berubah atau form dibuka
  useEffect(() => {
    if (open && tankId) {
      form.reset({
        tankId: tankId,
        deliveredVolume: undefined,
        literAmount: 0,
        invoiceNumber: "",
        imageUrl: "",
        notes: "",
      });
      setPendingData(null);
      setConfirmOpen(false);
    }
  }, [open, tankId, form]);

  const deliveredVolume = form.watch("deliveredVolume");
  const literAmount = form.watch("literAmount");

  const literAmountNum = Number(literAmount) || 0;

  // Calculate shrinkage menggunakan deliveredVolume
  const deliveredVolumeNum = Number(deliveredVolume) || 0;
  const shrinkage =
    deliveredVolumeNum > 0 ? deliveredVolumeNum - literAmountNum : 0;

  // Calculate shrinkage percentage
  const shrinkagePercentage =
    deliveredVolumeNum > 0 ? (shrinkage / deliveredVolumeNum) * 100 : 0;

  // Use centralized calculation utility
  const availableSpace = tankCapacity - currentStock;
  const newTotal = calculateTankStockByCalculation({
    stockOpen: currentStock,
    unloads: literAmountNum,
    sales: 0,
  });
  const isOverCapacity = newTotal > tankCapacity;

  // Fetch LO data when form opens
  useEffect(() => {
    const fetchLOData = async () => {
      if (!open || !tankId || !gasStationId) {
        setLoData(null);
        return;
      }

      setIsLoadingLO(true);
      try {
        const result = await getLORemainingByTank(gasStationId, tankId);
        if (result.success && result.data) {
          const data = result.data as {
            remainingLO: number;
            totalPurchaseVolume: number;
            totalDeliveredVolume: number;
            purchaseTransactions: Array<{
              id: string;
              purchaseVolume: number;
              deliveredVolume: number;
              remainingVolume: number;
            }>;
          };

          setLoData({
            remainingVolume: data.remainingLO || 0,
          });
        } else {
          setLoData({
            remainingVolume: 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch LO data:", error);
        setLoData({
          remainingVolume: 0,
        });
      } finally {
        setIsLoadingLO(false);
      }
    };

    fetchLOData();
  }, [open, tankId, gasStationId]);

  const handleSubmit = async (data: UnloadFormInput) => {
    // Validasi tankId sebelum submit
    if (data.tankId !== tankId) {
      toast.error("Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi.");
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
      toast.error("Error: Tank ID tidak sesuai. Silakan tutup dan buka form lagi.");
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
        deliveredVolume: undefined,
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
            <SheetTitle className="text-base lg:text-xl">
              Form Unload BBM
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              Input data pengisian BBM dari tangki truk ke tank {tankName}
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
                  {hasPermission(userRole, ["OWNER", "OWNER_GROUP", "ADMINISTRATOR", "DEVELOPER"]) && (
                    <div className="flex items-center justify-between col-span-2">
                      <span className="text-gray-600 text-xs lg:text-sm">
                        LO Remaining Volume
                      </span>
                      <span className="font-semibold font-mono text-xs lg:text-sm">
                        {isLoadingLO ? (
                          <span className="text-gray-400">Memuat...</span>
                        ) : (
                          formatNumber(loData?.remainingVolume || 0) + " L"
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Unload Details */}
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <Droplets className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                  <h3 className="font-semibold text-xs lg:text-sm">
                    Detail Pengisian
                  </h3>
                </div>

                {/* Delivered Volume */}
                <FormField
                  control={form.control}
                  name="deliveredVolume"
                  render={({ field, fieldState }) => (
                    <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                      <FormLabel className="text-xs lg:text-sm">
                        Volume Delivered (Liter)
                      </FormLabel>
                      <div className="space-y-1">
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Contoh: 4000 (volume yang di-deliver kali ini)"
                            className={cn(
                              "text-xs lg:text-sm text-right font-mono",
                              fieldState.error &&
                                "border-red-500 focus-visible:ring-red-500"
                            )}
                            value={field.value ? formatNumber(field.value) : ""}
                            onChange={(e) => {
                              const rawValue = e.target?.value || "";
                              const numValue = parseFormattedNumber(rawValue);
                              field.onChange(numValue || null);
                            }}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage className="text-xs lg:text-sm" />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="literAmount"
                  render={({ field, fieldState }) => (
                    <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                      <FormLabel className="text-xs lg:text-sm">
                        Volume Real & Unload <span>*</span>
                      </FormLabel>
                      <div className="space-y-1">
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Contoh: 7950 (volume real saat sampai dan yang di-unload ke tank)"
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
                      {deliveredVolumeNum > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600 text-xs lg:text-sm">
                              Volume Delivered:
                            </span>
                            <span className="font-semibold font-mono text-xs lg:text-sm">
                              {formatNumber(deliveredVolumeNum)} L
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 text-xs lg:text-sm">
                              Volume Real:
                            </span>
                            <span className="font-semibold font-mono text-blue-600 text-xs lg:text-sm">
                              {formatNumber(literAmountNum)} L
                            </span>
                          </div>
                          {shrinkage > 0 && (
                            <>
                              <div className="flex justify-between pt-1 lg:pt-2 border-t">
                                <span className="text-gray-600 text-xs lg:text-sm">
                                  Susut Perjalanan:
                                </span>
                                <span className="font-semibold font-mono text-orange-600 text-xs lg:text-sm">
                                  -{formatNumber(shrinkage)} L
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 text-xs lg:text-sm">
                                  Persentase Susut Perjalanan:
                                </span>
                                <span className="font-semibold font-mono text-orange-600 text-xs lg:text-sm">
                                  {shrinkagePercentage.toFixed(2)}%
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      )}
                      {isOverCapacity && (
                        <div className="text-red-600 font-semibold font-mono pt-1 lg:pt-2 border-t text-xs lg:text-sm">
                          ⚠️ Melebihi kapasitas! Kurangi{" "}
                          {formatNumber(newTotal - tankCapacity)} L
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <FormInputField
                  control={form.control}
                  name="invoiceNumber"
                  label="Nomor Invoice"
                  placeholder="Contoh: INV-2024-001"
                />

                <FormUploadField
                  control={form.control}
                  name="imageUrl"
                  label="Foto Bukti"
                  accept="image/*"
                  maxSize={5}
                  required
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
              Konfirmasi Unload BBM
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin menambahkan{" "}
              <span className="font-semibold">
                {formatNumber(pendingData?.literAmount || 0)} L
              </span>{" "}
              ke tank <span className="font-semibold">{tankName}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-3 text-xs lg:text-sm space-y-1">
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
