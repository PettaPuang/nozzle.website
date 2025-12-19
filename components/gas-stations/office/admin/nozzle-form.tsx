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
import { Badge } from "@/components/ui/badge";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { Cable, Loader2 } from "lucide-react";
import { FormInputField, FormSelectField } from "@/components/reusable/form";
import { createNozzleSchema } from "@/lib/validations/infrastructure.validation";
import { z } from "zod";

type NozzleFormInput = z.infer<typeof createNozzleSchema>;

type NozzleFormProps = {
  trigger?: React.ReactNode;
  stations: Array<{
    id: string;
    name: string;
    code: string;
    tankConnections: Array<{
      tank: {
        id: string;
        code: string;
        name: string;
        product: {
          id: string;
          name: string;
          ron?: string | null;
        };
      };
    }>;
  }>;
  products: Array<{ id: string; name: string; ron?: string | null }>;
  onSubmit: (data: NozzleFormInput) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editData?: {
    id: string;
    code: string;
    stationId: string;
    tankId: string;
  };
};

export function NozzleForm({
  trigger,
  stations,
  products,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  editData,
}: NozzleFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<NozzleFormInput | null>(null);
  const [availableTanks, setAvailableTanks] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      product: { id: string; name: string; ron?: string | null };
    }>
  >([]);

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editData;

  const form = useForm<NozzleFormInput>({
    resolver: zodResolver(createNozzleSchema),
    defaultValues: {
      stationId: "",
      tankId: "",
      productId: "",
      code: "",
      name: "",
    },
  });

  // Load edit data when in edit mode
  useEffect(() => {
    if (editData && open) {
      const tank = stations
        .flatMap((s) => s.tankConnections.map((c) => c.tank))
        .find((t) => t.id === editData.tankId);

      form.reset({
        stationId: editData.stationId,
        tankId: editData.tankId,
        productId: tank?.product.id || "",
        code: editData.code,
        name: "",
      });
    } else if (!editData && open) {
      form.reset({
        stationId: "",
        tankId: "",
        productId: "",
        code: "",
        name: "",
      });
    }
  }, [editData, open, form, stations]);

  const selectedStationId = form.watch("stationId");
  const selectedTankId = form.watch("tankId");

  // Update available tanks when station changes
  useEffect(() => {
    if (selectedStationId) {
      const station = stations.find((s) => s.id === selectedStationId);
      if (station) {
        const tanks = station.tankConnections.map((conn) => conn.tank);
        setAvailableTanks(tanks);

        // Reset tank and product when station changes
        form.setValue("tankId", "");
        form.setValue("productId", "");
      }
    } else {
      setAvailableTanks([]);
    }
  }, [selectedStationId, stations, form]);

  // Auto-select product when tank is selected
  useEffect(() => {
    if (selectedTankId) {
      const selectedTank = availableTanks.find((tank) => tank.id === selectedTankId);
      if (selectedTank) {
        form.setValue("productId", selectedTank.product.id);
      }
    } else {
      form.setValue("productId", "");
    }
  }, [selectedTankId, availableTanks, form]);

  const handleSubmit = async (data: NozzleFormInput) => {
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
        stationId: "",
        tankId: "",
        productId: "",
        code: "",
        name: "",
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

  const selectedStation = stations.find((s) => s.id === pendingData?.stationId);
  const selectedTank = availableTanks.find((t) => t.id === selectedTankId); // Use form value for real-time
  const selectedTankForConfirm = availableTanks.find(
    (t) => t.id === pendingData?.tankId
  ); // For confirmation dialog

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl">
              {isEditMode ? "Edit Nozzle" : "Tambah Nozzle Baru"}
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              {isEditMode
                ? "Update informasi nozzle"
                : "Pilih station dan tank, product akan otomatis terdeteksi"}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-2 lg:space-y-4 px-2 lg:px-4"
            >
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                  <Cable className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                  <h3 className="font-semibold text-xs lg:text-sm">
                    Informasi Nozzle
                  </h3>
                </div>

                <FormSelectField
                  control={form.control}
                  name="stationId"
                  label="Station"
                  placeholder="Pilih station"
                  required
                  options={stations.map((station) => ({
                    value: station.id,
                    label: `${station.code} - ${station.name}`,
                  }))}
                />

                {selectedStationId && (
                  <>
                    <FormInputField
                      control={form.control}
                      name="code"
                      label="Kode Nozzle"
                      placeholder="Contoh: N-001"
                      required
                    />

                    <FormInputField
                      control={form.control}
                      name="name"
                      label="Nama Nozzle"
                      placeholder="Contoh: Nozzle 1 - Pertalite"
                      required
                    />

                    <FormSelectField
                      control={form.control}
                      name="tankId"
                      label="Tank"
                      placeholder="Pilih tank"
                      required
                      options={availableTanks.map((tank) => ({
                        value: tank.id,
                        label: `${tank.code} - ${tank.name} (${tank.product.name}${tank.product.ron ? ` ${tank.product.ron}` : ""})`,
                      }))}
                    />

                    {availableTanks.length === 0 && (
                      <div className="text-xs lg:text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                        Station ini belum memiliki tank yang terhubung
                      </div>
                    )}

                    {selectedTankId && selectedTank && (
                      <div className="text-xs lg:text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2">
                        ✓ Product otomatis terpilih:{" "}
                        <strong>{selectedTank.product.name}{selectedTank.product.ron ? ` (${selectedTank.product.ron})` : ""}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-1.5 lg:gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset({
                      stationId: "",
                      tankId: "",
                      productId: "",
                      code: "",
                      name: "",
                    });
                  }}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || !selectedTank}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  Simpan
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
                ? "Konfirmasi Update Nozzle"
                : "Konfirmasi Tambah Nozzle"}
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin{" "}
              {isEditMode ? "mengupdate" : "menambahkan"} nozzle{" "}
              <span className="font-semibold">{pendingData?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
            {selectedStation && (
              <div className="flex justify-between">
                <span className="text-gray-600">Station:</span>
                <span className="font-semibold">{selectedStation.code}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Kode:</span>
              <span className="font-semibold">{pendingData?.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Nama:</span>
              <span className="font-semibold">{pendingData?.name}</span>
            </div>
            {selectedTankForConfirm && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tank:</span>
                  <span className="font-semibold">{selectedTankForConfirm.code} - {selectedTankForConfirm.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Product:</span>
                  <ProductBadge
                    productName={selectedTankForConfirm.product.name}
                  />
                </div>
              </>
            )}
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
