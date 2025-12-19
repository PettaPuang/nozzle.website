"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
import { Package, Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormInputField } from "@/components/reusable/form";
import { createProductSchema } from "@/lib/validations/infrastructure.validation";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { z } from "zod";
import { cn } from "@/lib/utils";

type ProductFormInput = z.infer<typeof createProductSchema>;

type ProductFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormInput, id?: string) => Promise<void>;
  gasStationId: string;
  editData?: {
    id: string;
    name: string;
    ron?: string | null;
    purchasePrice: number;
    sellingPrice: number;
  };
};

export function ProductForm({
  open,
  onClose,
  onSubmit,
  gasStationId,
  editData,
}: ProductFormProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<ProductFormInput | null>(null);

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: {
      gasStationId,
      name: "",
      ron: "",
      purchasePrice: 0,
      sellingPrice: 0,
    },
  });

  // Reset form dengan data edit saat editData berubah
  useEffect(() => {
    if (editData) {
      form.reset({
        gasStationId,
        name: editData.name,
        ron: editData.ron || "",
        purchasePrice: editData.purchasePrice,
        sellingPrice: editData.sellingPrice,
      });
    } else {
      form.reset({
        gasStationId,
        name: "",
        ron: "",
        purchasePrice: 0,
        sellingPrice: 0,
      });
    }
  }, [editData, form, gasStationId]);

  const handleSubmit = async (data: ProductFormInput) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      await onSubmit(pendingData, editData?.id);
      setConfirmOpen(false);
      onClose();
      form.reset({
        gasStationId,
        name: "",
        ron: "",
        purchasePrice: 0,
        sellingPrice: 0,
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
    onClose();
  };

  return (
    <>
      <Sheet
        open={open && !confirmOpen}
        onOpenChange={(isOpen) => !isOpen && handleCancel()}
      >
        <SheetContent className="p-2 overflow-y-auto" side="right">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl">
              {editData ? "Edit Product" : "Add New Product"}
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              {editData
                ? "Update product information"
                : "Input data produk BBM"}
            </SheetDescription>
          </SheetHeader>

          <div className="px-2 lg:px-4 py-2 lg:py-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3 lg:space-y-4"
              >
                <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-3 lg:p-4">
                  <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                    <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                    <h3 className="font-semibold text-xs lg:text-sm">
                      Informasi Product
                    </h3>
                  </div>

                  <FormInputField
                    control={form.control}
                    name="name"
                    label="Nama Product"
                    placeholder="Contoh: Pertalite (Ron 90)"
                    required
                  />

                  <FormInputField
                    control={form.control}
                    name="ron"
                    label="RON"
                    type="text"
                    placeholder="Contoh: 90, 92, 98 (opsional untuk non-BBM)"
                  />

                  <Controller
                    control={form.control}
                    name="purchasePrice"
                    render={({ field, fieldState }) => (
                      <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                        <FormLabel className="text-xs lg:text-sm">
                          Harga Tebus <span>*</span>
                        </FormLabel>
                        <div className="space-y-1">
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="0"
                              className={cn(
                                "text-right font-mono text-xs lg:text-sm",
                                fieldState.error &&
                                  "border-red-500 focus-visible:ring-red-500"
                              )}
                              value={
                                field.value ? formatNumber(field.value) : ""
                              }
                              onChange={(e) => {
                                const rawValue = e.target?.value || "";
                                const numValue = parseFormattedNumber(rawValue);
                                field.onChange(numValue);
                              }}
                              onBlur={() => field.onBlur()}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          {fieldState.error && (
                            <FormMessage className="text-xs" />
                          )}
                        </div>
                      </FormItem>
                    )}
                  />

                  <Controller
                    control={form.control}
                    name="sellingPrice"
                    render={({ field, fieldState }) => (
                      <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                        <FormLabel className="text-xs lg:text-sm">
                          Harga Jual <span>*</span>
                        </FormLabel>
                        <div className="space-y-1">
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="0"
                              className={cn(
                                "text-right font-mono text-xs lg:text-sm",
                                fieldState.error &&
                                  "border-red-500 focus-visible:ring-red-500"
                              )}
                              value={
                                field.value ? formatNumber(field.value) : ""
                              }
                              onChange={(e) => {
                                const rawValue = e.target?.value || "";
                                const numValue = parseFormattedNumber(rawValue);
                                field.onChange(numValue);
                              }}
                              onBlur={() => field.onBlur()}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          {fieldState.error && (
                            <FormMessage className="text-xs" />
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 lg:gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="text-xs lg:text-sm h-8 lg:h-10 px-3 lg:px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="text-xs lg:text-sm h-8 lg:h-10 px-3 lg:px-4"
                  >
                    {editData ? "Update" : "Simpan"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {editData
                ? "Konfirmasi Update Product"
                : "Konfirmasi Tambah Product"}
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin {editData ? "mengupdate" : "menambahkan"}{" "}
              product <span className="font-semibold">{pendingData?.name}</span>
              ?
            </DialogDescription>
          </DialogHeader>
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
                  {editData ? "Mengupdate..." : "Menyimpan..."}
                </>
              ) : editData ? (
                "Ya, Update"
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
