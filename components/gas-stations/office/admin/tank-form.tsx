"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Droplets, Loader2 } from "lucide-react";
import { FormInputField, FormSelectField } from "@/components/reusable/form";
import { createTankSchema } from "@/lib/validations/infrastructure.validation";
import { z } from "zod";
import { createZodResolver } from "@/lib/utils/form-types";
import { formatNumber } from "@/lib/utils/format-client";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { hasTankActivity } from "@/lib/actions/tank.actions";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Form input type - capacity dan initialStock tetap number di form state
type TankFormInput = z.infer<typeof createTankSchema>;

type TankFormProps = {
  trigger?: React.ReactNode;
  gasStationId?: string;
  gasStationName?: string; // Nama gas station untuk ditampilkan di dialog
  gasStations?: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; ron?: string | null }>;
  onSubmit: (data: TankFormInput) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: {
    id: string;
    code: string;
    name: string;
    capacity: number;
    initialStock?: number;
    gasStationId: string;
    productId: string;
  };
};

export function TankForm({
  trigger,
  gasStationId,
  gasStationName,
  gasStations = [],
  products,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  editData,
}: TankFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<TankFormInput | null>(null);
  const [hasActivity, setHasActivity] = useState(false);
  const [checkingActivity, setCheckingActivity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editData;

  const form = useForm<TankFormInput>({
    resolver: createZodResolver(createTankSchema),
    defaultValues: {
      gasStationId: gasStationId || "",
      productId: "",
      code: "",
      name: "",
      capacity: 0,
      initialStock: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      if (editData) {
        // Set number values (bukan formatted string)
        form.reset({
          gasStationId: editData.gasStationId,
          productId: editData.productId,
          code: editData.code,
          name: editData.name,
          capacity: editData.capacity,
          initialStock: editData.initialStock ?? 0,
        });
        // Check if tank has activity
        checkTankActivity(editData.id);
      } else {
        form.reset({
          gasStationId: gasStationId || "",
          productId: "",
          code: "",
          name: "",
          capacity: 0,
          initialStock: undefined,
        });
        setHasActivity(false);
      }
    }
  }, [open, editData, gasStationId, form]);

  const checkTankActivity = async (tankId: string) => {
    setCheckingActivity(true);
    try {
      const activity = await hasTankActivity(tankId);
      setHasActivity(activity);
    } catch (error) {
      console.error("Error checking tank activity:", error);
      setHasActivity(false);
    } finally {
      setCheckingActivity(false);
    }
  };

  const handleSubmit = async (data: TankFormInput) => {
    if (isSubmitting) return; // Prevent double submit

    if (isEditMode) {
      // Edit mode langsung submit tanpa konfirmasi
      setIsSubmitting(true);
      try {
        await onSubmit(data);
        setOpen(false);
        form.reset();
      } catch (error) {
        console.error("Error submitting form:", error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Create mode tampilkan dialog konfirmasi
      setPendingData(data);
      setConfirmOpen(true);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!pendingData || isSubmitting) return; // Prevent double submit

    setIsSubmitting(true);
    try {
      await onSubmit(pendingData);
      setConfirmOpen(false);
      setPendingData(null);
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="p-2 overflow-y-auto">
        <SheetHeader className="px-2 pt-2">
          <SheetTitle className="text-base lg:text-xl">
            {isEditMode ? "Edit Tank" : "Tambah Tank Baru"}
          </SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            {isEditMode
              ? "Update informasi tank"
              : "Input data tank untuk menyimpan produk BBM/Non-BBM"}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-2 lg:space-y-4 px-2 lg:px-4"
          >
            <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
              <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                <Droplets className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                <h3 className="font-semibold text-xs lg:text-sm">
                  Informasi Tank
                </h3>
              </div>

              {!gasStationId && gasStations.length > 0 && (
                <FormSelectField
                  control={form.control}
                  name="gasStationId"
                  label="Gas Station"
                  placeholder="Pilih SPBU"
                  required
                  options={gasStations.map((gs) => ({
                    value: gs.id,
                    label: gs.name,
                  }))}
                />
              )}

              <FormInputField
                control={form.control}
                name="code"
                label="Kode Tank"
                placeholder="Contoh: T-001"
                required
              />

              <FormInputField
                control={form.control}
                name="name"
                label="Nama Tank"
                placeholder="Contoh: Tank Pertalite 1"
                required
              />

              <FormSelectField
                control={form.control}
                name="productId"
                label="Product"
                placeholder="Pilih product"
                required
                options={products.map((product) => ({
                  value: product.id,
                  label: product.ron
                    ? `${product.name} (${product.ron})`
                    : product.name,
                }))}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field, fieldState }) => (
                  <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                    <FormLabel className="text-xs lg:text-sm">
                      Kapasitas (Liter) <span>*</span>
                    </FormLabel>
                    <div className="space-y-1">
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="isi kapasitas tank"
                          value={field.value ? formatNumber(field.value) : ""}
                          onChange={(e) => {
                            // Hapus semua karakter non-digit
                            const rawValue = e.target.value.replace(
                              /[^\d]/g,
                              ""
                            );
                            if (rawValue === "") {
                              field.onChange(0);
                            } else {
                              // Parse sebagai integer dan simpan sebagai number
                              const numValue = parseInt(rawValue, 10);
                              if (!isNaN(numValue)) {
                                field.onChange(numValue);
                              }
                            }
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="text-xs lg:text-sm font-mono text-right"
                        />
                      </FormControl>
                      {fieldState.error && <FormMessage className="text-xs" />}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="initialStock"
                render={({ field, fieldState }) => (
                  <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                    <FormLabel className="text-xs lg:text-sm">
                      Stock Awal (Liter) <span>*</span>
                    </FormLabel>
                    <div className="space-y-1">
                      <FormControl>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full">
                                <Input
                                  type="text"
                                  placeholder="isi stock awal tank"
                                  value={
                                    field.value !== undefined
                                      ? formatNumber(field.value)
                                      : ""
                                  }
                                  onChange={(e) => {
                                    if (hasActivity) return;
                                    // Hapus semua karakter non-digit
                                    const rawValue = e.target.value.replace(
                                      /[^\d]/g,
                                      ""
                                    );
                                    if (rawValue === "") {
                                      field.onChange(undefined);
                                    } else {
                                      // Parse sebagai integer dan simpan sebagai number
                                      const numValue = parseInt(rawValue, 10);
                                      if (!isNaN(numValue)) {
                                        field.onChange(numValue);
                                      }
                                    }
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                  disabled={hasActivity || checkingActivity}
                                  className={cn(
                                    "text-xs lg:text-sm font-mono text-right",
                                    hasActivity &&
                                      "bg-gray-100 cursor-not-allowed"
                                  )}
                                />
                              </div>
                            </TooltipTrigger>
                            {hasActivity && (
                              <TooltipContent>
                                <p className="text-xs">
                                  Stock awal tidak bisa diubah karena tank sudah
                                  memiliki aktivitas unload atau sales
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </FormControl>

                      {fieldState.error && <FormMessage className="text-xs" />}
                      {hasActivity && (
                        <p className="text-xs text-muted-foreground">
                          Tank sudah memiliki aktivitas operasional
                        </p>
                      )}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-1.5 lg:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                }}
                size="sm"
                className="text-xs lg:text-sm"
              >
                Clear
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || isSubmitting}
                size="sm"
                className="text-xs lg:text-sm"
              >
                {form.formState.isSubmitting || isSubmitting
                  ? "Menyimpan..."
                  : "Simpan"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-2 lg:p-6">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-xl">
              Konfirmasi Pembuatan Tank
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin membuat tank dengan informasi berikut?
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Gas Station:</span>
                <span className="font-semibold">
                  {gasStationName ||
                    (gasStationId
                      ? gasStations.find((gs) => gs.id === gasStationId)?.name
                      : gasStations.find(
                          (gs) => gs.id === pendingData.gasStationId
                        )?.name) ||
                    "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Kode:</span>
                <span className="font-semibold">{pendingData.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Nama:</span>
                <span className="font-semibold">{pendingData.name}</span>
              </div>
              {products.find((p) => p.id === pendingData.productId) && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Product:</span>
                  <ProductBadge
                    productName={
                      products.find((p) => p.id === pendingData.productId)
                        ?.name || ""
                    }
                  />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Kapasitas:</span>
                <span className="font-semibold font-mono">
                  {formatNumber(pendingData.capacity)} Liter
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stock Awal:</span>
                <span className="font-semibold font-mono">
                  {pendingData.initialStock !== undefined
                    ? formatNumber(pendingData.initialStock)
                    : "0"}{" "}
                  Liter
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setPendingData(null);
              }}
              size="sm"
              className="text-xs lg:text-sm"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSubmit}
              size="sm"
              disabled={!pendingData || isSubmitting}
              className="text-xs lg:text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Konfirmasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
