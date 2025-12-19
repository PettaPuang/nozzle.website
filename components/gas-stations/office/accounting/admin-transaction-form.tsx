"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FormInputField,
  FormSelectField,
  FormTextareaField,
  FormDateField,
} from "@/components/reusable/form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatNumber, parseFormattedNumber } from "@/lib/utils/format-client";
import { formatCurrency } from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAdminTransaction } from "@/lib/actions/admin-transaction.actions";
import {
  createAdminTransactionSchema,
  type CreateAdminTransactionInput,
} from "@/lib/validations/admin-transaction.validation";
import { getCOAs } from "@/lib/actions/coa.actions";
import type { COAForClient } from "@/lib/services/coa.service";

const coaCategoryOptions = [
  { value: "ASSET", label: "Aset" },
  { value: "LIABILITY", label: "Kewajiban" },
  { value: "EQUITY", label: "Ekuitas" },
  { value: "REVENUE", label: "Pendapatan" },
  { value: "COGS", label: "HPP" },
  { value: "EXPENSE", label: "Beban" },
];

type AdminTransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasStationId: string;
  onSuccess?: () => void;
};

export function AdminTransactionForm({
  open,
  onOpenChange,
  gasStationId,
  onSuccess,
}: AdminTransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  const [coas, setCoas] = useState<COAForClient[]>([]);
  const [loadingCoas, setLoadingCoas] = useState(false);
  const [createNewCOA, setCreateNewCOA] = useState<Record<number, boolean>>({});

  // Fetch COAs
  useEffect(() => {
    const fetchData = async () => {
      setLoadingCoas(true);
      try {
        const coasResult = await getCOAs(gasStationId);
        if (coasResult.success && coasResult.data) {
          setCoas(coasResult.data as any);
        }
      } catch (error) {
        console.error("Error fetching COAs:", error);
        toast.error("Gagal memuat daftar COA");
      } finally {
        setLoadingCoas(false);
      }
    };
    if (open) {
      fetchData();
    }
  }, [open, gasStationId]);

  const form = useForm<CreateAdminTransactionInput>({
    resolver: zodResolver(createAdminTransactionSchema) as any,
    defaultValues: {
      gasStationId,
      transactionType: "ADJUSTMENT", // Admin hanya handle ADJUSTMENT
      date: new Date(),
      description: "",
      referenceNumber: null,
      notes: null,
      approvalStatus: "APPROVED", // Admin langsung APPROVED
      approverId: null,
      journalEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "journalEntries",
  });

  useEffect(() => {
    const journalEntries = form.watch("journalEntries");
    journalEntries?.forEach((entry: any, index: number) => {
      const entryCoaId = entry.coaId;
      if (entryCoaId === "NEW" && !createNewCOA[index]) {
        setCreateNewCOA((prev) => ({ ...prev, [index]: true }));
        form.setValue(`journalEntries.${index}.coaId`, "");
        // Set default COA category to COGS when creating new COA
        if (!entry.newCOACategory) {
          form.setValue(`journalEntries.${index}.newCOACategory`, "COGS");
        }
      } else if (entryCoaId && entryCoaId !== "NEW" && createNewCOA[index]) {
        setCreateNewCOA((prev) => ({ ...prev, [index]: false }));
      }
    });
  }, [form.watch("journalEntries"), createNewCOA, form]);

  const getAllCOAOptions = () => [
    ...coas.map((coa) => ({
      value: coa.id,
      label: `${coa.name} (${
        coaCategoryOptions.find((opt) => opt.value === coa.category)?.label ||
        coa.category
      })`,
    })),
    { value: "NEW", label: "+ Buat COA Baru" },
  ];

  const handleSubmit = async (data: CreateAdminTransactionInput) => {
    // Preprocess: jika coaId adalah "NEW", set ke empty string
    const processedData = {
      ...data,
      journalEntries: data.journalEntries.map((entry: any) => ({
        ...entry,
        coaId: entry.coaId === "NEW" ? "" : entry.coaId,
      })),
    };
    setPendingData(processedData);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      // Preprocess: ubah empty string menjadi undefined untuk konsistensi
      const adminData = {
        ...pendingData,
        transactionType: "ADJUSTMENT" as const, // Force ADJUSTMENT
        journalEntries: pendingData.journalEntries.map((entry: any) => ({
          ...entry,
          coaId: entry.coaId === "" ? undefined : entry.coaId,
        })),
      };
      const result = await createAdminTransaction(adminData);

      if (result.success) {
        toast.success(result.message);
        setConfirmOpen(false);
        onOpenChange(false);
        form.reset();
        setPendingData(null);
        onSuccess?.();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Gagal membuat transaksi");
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

  // Get COA name from ID
  const getCOAName = (coaId: string, entry: any) => {
    if (entry.newCOAName) {
      return entry.newCOAName;
    }
    const coa = coas.find((c) => c.id === coaId);
    return coa ? coa.name : coaId || "-";
  };

  const journalEntries = form.watch("journalEntries");
  const totalDebit =
    journalEntries?.reduce((sum, e) => sum + (e.debit || 0), 0) || 0;
  const totalCredit =
    journalEntries?.reduce((sum, e) => sum + (e.credit || 0), 0) || 0;
  const balanceDiff = Math.abs(totalDebit - totalCredit);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl">
              Input Transaksi Adjustment
            </SheetTitle>
            <SheetDescription className="text-xs lg:text-sm">
              Administrator dapat membuat transaksi adjustment/manual
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="px-2 lg:px-4 pb-2 lg:pb-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3 lg:space-y-4"
              >
                {/* Journal Entries */}
                <div className="space-y-2 lg:space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b">
                    <h4 className="font-semibold text-xs lg:text-sm">Journal Entries</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        append({ coaId: "", debit: 0, credit: 0, description: "" });
                      }}
                      className="text-xs lg:text-sm h-7 lg:h-8"
                    >
                      <Plus className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                      Tambah Entry
                    </Button>
                  </div>

                  {fields.map((field, index) => {
                    const entryCoaId = form.watch(`journalEntries.${index}.coaId`);
                    const isCreateNew = createNewCOA[index] || entryCoaId === "NEW";

                    return (
                      <div
                        key={field.id}
                        className="space-y-1.5 lg:space-y-2 pb-2 lg:pb-3 border-b last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                            Entry {index + 1}
                          </span>
                          {fields.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                remove(index);
                                setCreateNewCOA((prev) => {
                                  const newState = { ...prev };
                                  delete newState[index];
                                  return newState;
                                });
                              }}
                              className="h-6 w-6 p-0 text-red-500"
                            >
                              <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          )}
                        </div>

                        <FormSelectField
                          control={form.control}
                          name={`journalEntries.${index}.coaId`}
                          label="COA"
                          placeholder={loadingCoas ? "Memuat COA..." : "Pilih COA..."}
                          options={getAllCOAOptions()}
                          required={!isCreateNew}
                          disabled={loadingCoas}
                        />

                        {isCreateNew && (
                          <div className="space-y-1.5 lg:space-y-2 pl-2 lg:pl-3 border-l-2 border-primary/20">
                            <div className="flex items-center gap-1.5 lg:gap-2 pb-1">
                              <Plus className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                              <h5 className="font-semibold text-xs lg:text-sm">
                                Buat COA Baru
                              </h5>
                            </div>

                            <FormInputField
                              control={form.control}
                              name={`journalEntries.${index}.newCOAName` as any}
                              label="Nama COA"
                              placeholder="Contoh: Kas Toko, Bank BCA"
                              required
                            />

                            <FormSelectField
                              control={form.control}
                              name={`journalEntries.${index}.newCOACategory` as any}
                              label="Kategori"
                              required
                              options={coaCategoryOptions}
                            />

                            <FormInputField
                              control={form.control}
                              name={`journalEntries.${index}.newCOADescription` as any}
                              label="Deskripsi"
                              placeholder="Keterangan singkat (opsional)"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 lg:gap-3">
                          <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                            <label className="text-xs lg:text-sm">Debit</label>
                            <Controller
                              name={`journalEntries.${index}.debit`}
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <div className="space-y-1">
                                  <Input
                                    type="text"
                                    placeholder="0"
                                    className={cn(
                                      "text-right font-mono text-xs lg:text-sm",
                                      fieldState.error && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                    value={field.value ? formatNumber(field.value) : ""}
                                    onChange={(e) => {
                                      const rawValue = e.target?.value || "";
                                      const numValue = parseFormattedNumber(rawValue);
                                      field.onChange(numValue);
                                    }}
                                    onBlur={() => field.onBlur()}
                                  />
                                  {fieldState.error && (
                                    <p className="text-[10px] lg:text-xs text-red-500">
                                      {fieldState.error.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                            <label className="text-xs lg:text-sm">Credit</label>
                            <Controller
                              name={`journalEntries.${index}.credit`}
                              control={form.control}
                              render={({ field, fieldState }) => (
                                <div className="space-y-1">
                                  <Input
                                    type="text"
                                    placeholder="0"
                                    className={cn(
                                      "text-right font-mono text-xs lg:text-sm",
                                      fieldState.error && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                    value={field.value ? formatNumber(field.value) : ""}
                                    onChange={(e) => {
                                      const rawValue = e.target?.value || "";
                                      const numValue = parseFormattedNumber(rawValue);
                                      field.onChange(numValue);
                                    }}
                                    onBlur={() => field.onBlur()}
                                  />
                                  {fieldState.error && (
                                    <p className="text-[10px] lg:text-xs text-red-500">
                                      {fieldState.error.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </div>
                        </div>

                        <FormInputField
                          control={form.control}
                          name={`journalEntries.${index}.description`}
                          label="Deskripsi Entry"
                          placeholder="Keterangan entry (opsional)"
                        />
                      </div>
                    );
                  })}

                  {/* Balance Summary */}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-xs lg:text-sm py-1">
                      <span>Total Debit:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(totalDebit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs lg:text-sm py-1">
                      <span>Total Credit:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(totalCredit)}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between text-xs lg:text-sm py-1 border-t ${
                        balanceDiff > 0.01 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      <span>Selisih:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(balanceDiff)}
                      </span>
                    </div>
                    {balanceDiff > 0.01 && (
                      <p className="text-[10px] lg:text-xs text-red-600 mt-1">
                        Jurnal harus balance (debit = credit)
                      </p>
                    )}
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="space-y-2 lg:space-y-3">
                  <FormInputField
                    control={form.control}
                    name="description"
                    label="Deskripsi"
                    placeholder="Deskripsi transaksi"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    <FormDateField
                      control={form.control}
                      name="date"
                      label="Tanggal Transaksi"
                      required
                    />

                    <FormInputField
                      control={form.control}
                      name="referenceNumber"
                      label="Nomor Referensi"
                      placeholder="Contoh: INV-001, REF-123"
                    />
                  </div>

                  <FormTextareaField
                    control={form.control}
                    name="notes"
                    label="Catatan"
                    placeholder="Catatan tambahan (opsional)"
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 lg:gap-3 pt-2 lg:pt-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    size="sm"
                    className="text-xs lg:text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={balanceDiff > 0.01}
                    className="text-xs lg:text-sm"
                  >
                    Simpan
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={handleCancelConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Konfirmasi Transaksi</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membuat transaksi ini?
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="space-y-3 lg:space-y-4 max-h-[500px] overflow-y-auto">
              <div className="rounded-lg bg-gray-50 p-3 text-xs lg:text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-semibold">
                    {pendingData.date
                      ? format(new Date(pendingData.date), "dd/MM/yyyy", { locale: id })
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jenis:</span>
                  <span className="font-semibold">Adjustment/Manual</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deskripsi:</span>
                  <span className="font-semibold">{pendingData.description}</span>
                </div>
                {pendingData.referenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">No. Referensi:</span>
                    <span className="font-semibold">{pendingData.referenceNumber}</span>
                  </div>
                )}
              </div>

              {/* Journal Entries */}
              {pendingData.journalEntries && pendingData.journalEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-xs lg:text-sm pb-1 border-b">
                    Jurnal Entries
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 bg-gray-100 p-2 text-xs lg:text-sm font-semibold border-b">
                      <div>Nama COA</div>
                      <div className="text-right">Debit</div>
                      <div className="text-right">Credit</div>
                    </div>
                    <div className="divide-y">
                      {pendingData.journalEntries.map((entry: any, index: number) => {
                        const coaName = getCOAName(entry.coaId, entry);
                        const debit = entry.debit || 0;
                        const credit = entry.credit || 0;

                        return (
                          <div
                            key={index}
                            className="grid grid-cols-[2fr_1fr_1fr] gap-2 p-2 text-xs lg:text-sm"
                          >
                            <div className="font-medium">{coaName}</div>
                            <div className="text-right font-mono">
                              {debit > 0 ? formatCurrency(debit) : "-"}
                            </div>
                            <div className="text-right font-mono">
                              {credit > 0 ? formatCurrency(credit) : "-"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
