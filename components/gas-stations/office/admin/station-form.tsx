"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { FormInputField } from "@/components/reusable/form";
import { FormMultiSelectField } from "@/components/reusable/form/form-multi-select-field";
import { createStationSchema } from "@/lib/validations/infrastructure.validation";
import { z } from "zod";
import { ProductBadge } from "@/components/reusable/badges/product-badge";

type StationFormInput = z.infer<typeof createStationSchema>;

type StationFormProps = {
  trigger?: React.ReactNode;
  gasStationId: string;
  tanks: Array<{
    id: string;
    name: string;
    code: string;
    product: { name: string };
  }>;
  onSubmit: (data: StationFormInput) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: {
    id: string;
    code: string;
    name: string;
    gasStationId: string;
    tankIds: string[];
  };
};

export function StationForm({
  trigger,
  gasStationId,
  tanks,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  editData,
}: StationFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<StationFormInput | null>(null);

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editData;

  const form = useForm<StationFormInput>({
    resolver: zodResolver(createStationSchema),
    defaultValues: editData || {
      gasStationId,
      code: "",
      name: "",
      tankIds: [],
    },
  });

  const handleSubmit = async (data: StationFormInput) => {
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      await onSubmit(pendingData);
      setConfirmOpen(false);
      setOpen(false);
      form.reset({
        gasStationId,
        code: "",
        name: "",
        tankIds: [],
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

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl">
              {isEditMode ? "Edit Station" : "Tambah Station Baru"}
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              {isEditMode
                ? "Update informasi station"
                : "Input data station (dispenser) yang terhubung dengan tank"}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-2 lg:space-y-4 px-2 lg:px-4"
            >
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <Building2 className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                  <h3 className="font-semibold text-xs lg:text-sm">
                    Informasi Station
                  </h3>
                </div>

                <FormInputField
                  control={form.control}
                  name="code"
                  label="Kode Station"
                  placeholder="Contoh: S-001"
                  required
                />

                <FormInputField
                  control={form.control}
                  name="name"
                  label="Nama Station"
                  placeholder="Contoh: Pompa 1 - Multi Product"
                  required
                />

                <FormMultiSelectField
                  control={form.control}
                  name="tankIds"
                  label="Tanks"
                  placeholder="Pilih tank(s)"
                  required
                  options={tanks.map((tank) => ({
                    value: tank.id,
                    label: `${tank.code} - ${tank.name} (${tank.product.name})`,
                    productName: tank.product.name,
                  }))}
                />
              </div>

              <div className="flex justify-end gap-1.5 lg:gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset({
                      gasStationId,
                      code: "",
                      name: "",
                      tankIds: [],
                    });
                  }}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  {isEditMode ? "Update" : "Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent
          className="p-2 lg:p-6"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-base lg:text-xl">
              {isEditMode
                ? "Konfirmasi Update Station"
                : "Konfirmasi Tambah Station"}
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin{" "}
              {isEditMode ? "mengupdate" : "menambahkan"} station{" "}
              <span className="font-semibold">{pendingData?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Kode:</span>
              <span className="font-semibold">{pendingData?.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Nama:</span>
              <span className="font-semibold">{pendingData?.name}</span>
            </div>
            <div className="pt-1.5 lg:pt-2 border-t">
              <span className="text-gray-600 text-[10px] lg:text-xs mb-1.5 lg:mb-2 block">
                Tanks Terhubung:
              </span>
              <div className="flex flex-wrap gap-0.5 lg:gap-1">
                {pendingData?.tankIds.map((tankId) => {
                  const tank = tanks.find((t) => t.id === tankId);
                  if (!tank) return null;
                  return (
                    <ProductBadge
                      key={tankId}
                      productName={tank.product.name}
                      label={tank.code}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              disabled={isSubmitting}
              size="sm"
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              size="sm"
              className="text-xs lg:text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  {isEditMode ? "Mengupdate..." : "Menyimpan..."}
                </>
              ) : (
                `Ya, ${isEditMode ? "Update" : "Simpan"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
