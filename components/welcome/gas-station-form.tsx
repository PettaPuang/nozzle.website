"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Loader2, Trash2 } from "lucide-react";
import { FormInputField, FormSelectField } from "@/components/reusable/form";
import { Switch } from "@/components/ui/switch";
import { createGasStationSchema } from "@/lib/validations/infrastructure.validation";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { Input } from "@/components/ui/input";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Controller } from "react-hook-form";

type GasStationFormInput = z.infer<typeof createGasStationSchema>;

type GasStationFormProps = {
  trigger?: React.ReactNode;
  owners: Array<{ id: string; name: string }>;
  onSubmit: (data: GasStationFormInput) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isDeveloper?: boolean;
  userRole?: string; // Role user saat ini
  ownerId?: string | null; // ownerId untuk ADMINISTRATOR (dari currentUser.ownerId)
  editData?: {
    id: string;
    name: string;
    address: string;
    latitude: string | null;
    longitude: string | null;
    ownerId: string;
    openTime: string | null;
    closeTime: string | null;
    status: "ACTIVE" | "INACTIVE";
    managerCanPurchase?: boolean;
    financeCanPurchase?: boolean;
    hasTitipan?: boolean;
    titipanNames?: string[];
  };
};

export function GasStationForm({
  trigger,
  owners,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  isDeveloper = false,
  userRole = "",
  ownerId: propOwnerId = null,
  editData,
}: GasStationFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<GasStationFormInput | null>(
    null
  );
  const [existingTitipanNames, setExistingTitipanNames] = useState<string[]>([]);

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editData;
  const isAdministrator = userRole === "ADMINISTRATOR";

  // Jika ADMINISTRATOR, gunakan ownerId dari props (currentUser.ownerId)
  // Jika DEVELOPER, bisa pilih owner
  const shouldShowOwnerSelect = isDeveloper && !isAdministrator;

  // Transform editData to match form schema
  const transformEditData = (
    data: typeof editData
  ): GasStationFormInput | undefined => {
    if (!data) return undefined;
    
    return {
      name: data.name,
      address: data.address,
      latitude: data.latitude ? parseFloat(data.latitude) : "",
      longitude: data.longitude ? parseFloat(data.longitude) : "",
      ownerId: data.ownerId,
      openTime: data.openTime || "",
      closeTime: data.closeTime || "",
      status: data.status,
      managerCanPurchase: data.managerCanPurchase ?? false,
      financeCanPurchase: data.financeCanPurchase ?? false,
      hasTitipan: data.hasTitipan ?? false,
      titipanNames: data.titipanNames || [],
    };
  };

  // Default ownerId: jika ADMINISTRATOR dan bukan edit mode, gunakan propOwnerId
  const getDefaultOwnerId = (): string => {
    if (isEditMode && editData) {
      return editData.ownerId;
    }
    if (isAdministrator && propOwnerId) {
      return propOwnerId;
    }
    return "";
  };

  const form = useForm<GasStationFormInput>({
    resolver: zodResolver(createGasStationSchema) as any,
    defaultValues: transformEditData(editData) || {
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      ownerId: getDefaultOwnerId(),
      openTime: "",
      closeTime: "",
      status: "ACTIVE" as const,
      managerCanPurchase: false,
      financeCanPurchase: false,
      hasTitipan: false,
      titipanNames: [],
    },
  });

  // Watch hasTitipan value changes (must be after form definition)
  const hasTitipanValue = form.watch("hasTitipan");

  // Reset form when dialog opens or editData changes
  useEffect(() => {
    if (open) {
      if (editData) {
        const transformed = transformEditData(editData);
        form.reset(transformed);
      } else {
        const defaultOwnerId = getDefaultOwnerId();
        form.reset({
          name: "",
          address: "",
          latitude: "",
          longitude: "",
          ownerId: defaultOwnerId,
          openTime: "",
          closeTime: "",
          status: "ACTIVE" as const,
          managerCanPurchase: false,
          financeCanPurchase: false,
          hasTitipan: false,
          titipanNames: [],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editData]); // Trigger when dialog opens OR editData changes

  // Fetch existing Titipan COAs when dialog opens in edit mode
  useEffect(() => {
    const fetchExistingTitipanCOAs = async () => {
      if (open && isEditMode && editData?.id) {
        try {
          const { getTitipanCOAs } = await import("@/lib/actions/coa.actions");
          const result = await getTitipanCOAs(editData.id);
          if (result.success && result.data) {
            const coaList = result.data as Array<{ id: string; name: string }>;
            // Extract nama titipan dari COA name (format: "Titipan {Nama}")
            const names = coaList.map((coa) => coa.name.replace(/^Titipan\s+/, ""));
            setExistingTitipanNames(names);
          }
        } catch (error) {
          console.error('Failed to fetch existing Titipan COAs:', error);
        }
      }
    };
    
    fetchExistingTitipanCOAs();
  }, [open, isEditMode, editData?.id]);

  // Sync ownerId jika ADMINISTRATOR dan propOwnerId berubah
  useEffect(() => {
    if (isAdministrator && propOwnerId && open && !isEditMode) {
      const currentOwnerId = form.getValues("ownerId");
      if (currentOwnerId !== propOwnerId) {
        form.setValue("ownerId", propOwnerId, { shouldValidate: true });
      }
    }
  }, [isAdministrator, propOwnerId, open, isEditMode, form]);

  const handleSubmit = async (data: GasStationFormInput) => {
    const finalData = {
      ...data,
      // Jika ADMINISTRATOR, pastikan ownerId sesuai dengan ownernya
      ownerId: isAdministrator && propOwnerId ? propOwnerId : data.ownerId,
      // Status hanya bisa diubah oleh DEVELOPER
      // Jika bukan developer dan create mode, selalu set status ACTIVE
      // Jika edit mode dan bukan developer, jangan kirim status (biarkan tetap seperti sebelumnya)
      status:
        !isDeveloper && !isEditMode
          ? "ACTIVE"
          : isDeveloper
          ? data.status
          : "ACTIVE",
    } as const;

    setPendingData(finalData as any);
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
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        ownerId: "",
        openTime: "",
        closeTime: "",
        status: "ACTIVE" as const,
        managerCanPurchase: false,
        financeCanPurchase: false,
        hasTitipan: false,
        titipanNames: [],
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
    if (!isEditMode) {
      form.reset({
        name: "",
        address: "",
        latitude: "",
        longitude: "",
        ownerId: "",
        openTime: "",
        closeTime: "",
        status: "ACTIVE" as const,
        managerCanPurchase: false,
        financeCanPurchase: false,
        hasTitipan: false,
        titipanNames: [],
      });
    }
    setOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}

      {/* Backdrop - Full Screen */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-100 transition-opacity"
          onClick={handleCancel}
        />
      )}

      {/* Sliding Form Panel - Optimized for tablet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 bg-white border-t shadow-2xl z-110 transition-transform duration-300 ease-in-out",
          open ? "translate-y-0" : "translate-y-full",
          "w-[50%] lg:w-[40%]" // Tablet 50%, Desktop 40%
        )}
        style={{ height: "100%" }}
      >
        {/* Header */}
        <div className="bg-white px-3 lg:px-6 py-2 lg:py-4 border-b">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">
              {isEditMode ? "Edit Gas Station" : "Add New Gas Station"}
            </h2>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">
              {isEditMode
                ? "Update informasi SPBU"
                : "Input data SPBU baru ke dalam sistem"}
            </p>
          </div>
          {/* Pertamina Stripes */}
          <div className="mt-2 lg:mt-3">
            <PertaminaStripes />
          </div>
        </div>

        {/* Form Content */}
        <ScrollArea className="h-[calc(100%-80px)] lg:h-[calc(100%-88px)]">
          <div className="p-3 lg:p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3 lg:space-y-4"
              >
                <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-3 lg:p-4">
                  <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                    <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                    <h3 className="font-semibold text-xs lg:text-sm">
                      Informasi Gas Station
                    </h3>
                  </div>

                  <FormInputField
                    control={form.control as any}
                    name="name"
                    label="Nama Gas Station"
                    placeholder="Contoh: SPBU Pertamina 123"
                    required
                  />

                  <FormInputField
                    control={form.control as any}
                    name="address"
                    label="Alamat"
                    placeholder="Jl. Contoh No. 123"
                    required
                  />

                  <FormInputField
                    control={form.control as any}
                    name="latitude"
                    label="Latitude"
                    type="number"
                    placeholder="-6.200000"
                  />

                  <FormInputField
                    control={form.control as any}
                    name="longitude"
                    label="Longitude"
                    type="number"
                    placeholder="106.816666"
                  />

                  {shouldShowOwnerSelect ? (
                    <FormSelectField
                      control={form.control as any}
                      name="ownerId"
                      label="Owner"
                      placeholder={
                        owners.length === 0
                          ? "No owners available"
                          : "Pilih owner"
                      }
                      required
                      options={owners.map((owner) => ({
                        value: owner.id,
                        label: owner.name,
                      }))}
                    />
                  ) : isAdministrator ? (
                    <Controller
                      control={form.control}
                      name="ownerId"
                      rules={{ required: true }}
                      defaultValue={propOwnerId || ""}
                      render={({ field, fieldState }) => {
                        // Pastikan value selalu string untuk menghindari controlled/uncontrolled error
                        const fieldValue = String(
                          field.value || propOwnerId || ""
                        );
                        const ownerName =
                          owners.find((o) => o.id === fieldValue)?.name ||
                          "Owner Anda";

                        return (
                          <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                            <FormLabel className="text-xs lg:text-sm">
                              Owner <span>*</span>
                            </FormLabel>
                            <div className="space-y-1">
                              <FormControl>
                                <Input
                                  value={ownerName}
                                  disabled
                                  className="bg-gray-50 text-gray-600 cursor-not-allowed text-xs lg:text-sm"
                                  readOnly
                                />
                              </FormControl>
                              <FormMessage className="text-xs lg:text-sm" />
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  ) : null}

                  <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-start gap-1.5 lg:gap-3">
                    <FormLabel className="text-xs lg:text-sm pt-2">
                      Jam Operational
                    </FormLabel>
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2 lg:gap-3">
                        <FormField
                          control={form.control}
                          name="openTime"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="time"
                                  placeholder="06:00"
                                  className={cn(
                                    "text-xs lg:text-sm",
                                    fieldState.error &&
                                      "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              {fieldState.error && (
                                <FormMessage className="text-xs lg:text-sm" />
                              )}
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="closeTime"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="time"
                                  placeholder="22:00"
                                  className={cn(
                                    "text-xs lg:text-sm",
                                    fieldState.error &&
                                      "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              {fieldState.error && (
                                <FormMessage className="text-xs lg:text-sm" />
                              )}
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status hanya ditampilkan untuk DEVELOPER, hidden untuk ADMINISTRATOR */}
                  {isDeveloper && !isAdministrator && (
                    <FormSelectField
                      control={form.control as any}
                      name="status"
                      label="Status"
                      required
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "INACTIVE", label: "Inactive" },
                      ]}
                    />
                  )}
                </div>

                {/* Accounting Access Settings - DEVELOPER & ADMINISTRATOR */}
                {(isDeveloper || isAdministrator) && (
                  <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-3 lg:p-4">
                    <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                      <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                      <h3 className="font-semibold text-xs lg:text-sm">
                        Accounting Access Settings
                      </h3>
                    </div>

                    <FormField
                      control={form.control}
                      name="managerCanPurchase"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel className="text-xs lg:text-sm">
                              Manager dapat akses Accounting
                            </FormLabel>
                            <p className="text-[10px] lg:text-xs text-muted-foreground">
                              Manager dapat mengakses card Accounting di
                              management tab
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="financeCanPurchase"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel className="text-xs lg:text-sm">
                              Finance dapat akses Accounting
                            </FormLabel>
                            <p className="text-[10px] lg:text-xs text-muted-foreground">
                              Finance dapat mengakses card Accounting di
                              management tab
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Titipan Settings - DEVELOPER & ADMINISTRATOR */}
                {(isDeveloper || isAdministrator) && (
                  <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-3 lg:p-4">
                    <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                      <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                      <h3 className="font-semibold text-xs lg:text-sm">
                        Pengaturan Titipan
                      </h3>
                    </div>

                    <FormField
                      control={form.control}
                      name="hasTitipan"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel className="text-xs lg:text-sm">
                              Aktifkan Fitur Titipan
                            </FormLabel>
                            <p className="text-[10px] lg:text-xs text-muted-foreground">
                              Aktifkan untuk menggunakan fitur titipan product
                              di deposit
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Input Nama Titipan - muncul jika hasTitipan = true */}
                    {form.watch("hasTitipan") && (
                      <div className="space-y-2 lg:space-y-3 pl-6 border-l-2 border-primary/20">
                        <FormLabel className="text-xs lg:text-sm">
                          Nama Titipan <span className="text-red-500">*</span>
                        </FormLabel>
                        <p className="text-[10px] lg:text-xs text-muted-foreground">
                          Masukkan nama-nama titipan yang akan digunakan
                          (contoh: Polres, Pemkot)
                        </p>

                        {/* Show existing Titipan COAs if any */}
                        {existingTitipanNames.length > 0 && (
                          <div className="rounded-lg border bg-blue-50 p-2 lg:p-3">
                            <p className="text-[10px] lg:text-xs font-semibold text-blue-900 mb-1">
                              COA Titipan yang sudah ada:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {existingTitipanNames.map((name, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                            <p className="text-[9px] lg:text-[10px] text-blue-700 mt-1">
                              Anda bisa menambah atau mengurangi nama titipan di bawah
                            </p>
                          </div>
                        )}

                        <Controller
                          control={form.control}
                          name="titipanNames"
                          rules={{
                            validate: (value) => {
                              if (form.watch("hasTitipan")) {
                                const nonEmptyNames = (value || []).filter(
                                  (name: string) => name.trim() !== ""
                                );
                                if (nonEmptyNames.length === 0) {
                                  return "Minimal harus ada 1 nama titipan yang diisi";
                                }
                              }
                              return true;
                            },
                          }}
                          render={({ field, fieldState }) => (
                            <div className="space-y-2">
                              {(field.value || []).map(
                                (name: string, index: number) => (
                                  <div
                                    key={index}
                                    className="flex gap-2 items-center"
                                  >
                                    <Input
                                      value={name}
                                      onChange={(e) => {
                                        const newNames = [
                                          ...(field.value || []),
                                        ];
                                        newNames[index] = e.target.value;
                                        field.onChange(newNames);
                                      }}
                                      placeholder={`Nama Titipan ${index + 1}`}
                                      className={cn(
                                        "text-xs lg:text-sm",
                                        fieldState.error &&
                                          "border-red-500 focus-visible:ring-red-500"
                                      )}
                                    />
                                    {(field.value || []).length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          const newNames = (
                                            field.value || []
                                          ).filter(
                                            (_: any, i: number) => i !== index
                                          );
                                          field.onChange(newNames);
                                        }}
                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                )
                              )}

                              {/* Auto-add first input jika kosong */}
                              {(!field.value || field.value.length === 0) && (
                                <Input
                                  value=""
                                  onChange={(e) => {
                                    field.onChange([e.target.value]);
                                  }}
                                  placeholder="Nama Titipan (contoh: Polres)"
                                  className={cn(
                                    "text-xs lg:text-sm",
                                    fieldState.error &&
                                      "border-red-500 focus-visible:ring-red-500"
                                  )}
                                />
                              )}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentNames = field.value || [];
                                  field.onChange([...currentNames, ""]);
                                }}
                                className="text-xs lg:text-sm"
                              >
                                + Tambah Nama Titipan
                              </Button>

                              {fieldState.error && (
                                <FormMessage className="text-xs lg:text-sm">
                                  {fieldState.error.message}
                                </FormMessage>
                              )}
                            </div>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

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
                    {isEditMode ? "Update" : "Simpan"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode
                ? "Konfirmasi Update Gas Station"
                : "Konfirmasi Tambah Gas Station"}
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin{" "}
              {isEditMode ? "mengupdate" : "menambahkan"} gas station{" "}
              <span className="font-semibold">{pendingData?.name}</span>?
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
