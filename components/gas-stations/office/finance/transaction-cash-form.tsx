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
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createCashTransaction } from "@/lib/actions/cash-transaction.actions";
import {
  createCashTransactionSchema,
  type CreateCashTransactionInput,
} from "@/lib/validations/cash-transaction.validation";
import { getCOAs, createCOA } from "@/lib/actions/coa.actions";
import {
  createCOASchema,
  type CreateCOAInput,
} from "@/lib/validations/coa.validation";
import type { COAForClient } from "@/lib/services/coa.service";

const cashTransactionTypeOptions = [
  { value: "INCOME", label: "Pemasukan" },
  { value: "EXPENSE", label: "Pengeluaran" },
  { value: "TRANSFER", label: "Antar Kas" },
];

const paymentAccountOptions = [
  { value: "CASH", label: "Kas" },
  { value: "BANK", label: "Bank" },
];

const coaCategoryOptions = [
  { value: "ASSET", label: "Aset" },
  { value: "LIABILITY", label: "Kewajiban" },
  { value: "EQUITY", label: "Ekuitas" },
  { value: "REVENUE", label: "Pendapatan" },
  { value: "COGS", label: "HPP" },
  { value: "EXPENSE", label: "Beban" },
];

type CashTransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasStationId: string;
  onSuccess?: () => void;
};

export function CashTransactionForm({
  open,
  onOpenChange,
  gasStationId,
  onSuccess,
}: CashTransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] =
    useState<CreateCashTransactionInput | null>(null);
  const [coas, setCoas] = useState<COAForClient[]>([]);
  const [loadingCoas, setLoadingCoas] = useState(false);
  const [createNewCOAForCash, setCreateNewCOAForCash] = useState(false);

  // Fetch COAs
  useEffect(() => {
    const fetchCOAs = async () => {
      setLoadingCoas(true);
      try {
        const result = await getCOAs(gasStationId);
        if (result.success && result.data) {
          setCoas(result.data as COAForClient[]);
        }
      } catch (error) {
        console.error("Error fetching COAs:", error);
        toast.error("Gagal memuat daftar COA");
      } finally {
        setLoadingCoas(false);
      }
    };
    if (open) {
      fetchCOAs();
    }
  }, [open, gasStationId]);

  const form = useForm<CreateCashTransactionInput>({
    resolver: zodResolver(createCashTransactionSchema) as any,
    defaultValues: {
      gasStationId,
      date: new Date(),
      description: "",
      referenceNumber: null,
      notes: null,
      cashTransactionType: "INCOME",
      paymentAccount: "CASH",
      toPaymentAccount: undefined,
      coaId: undefined,
      amount: undefined as any, // Will be validated as positive number
    },
  });

  // Reset form when sheet opens/closes
  useEffect(() => {
    if (open) {
      form.reset({
        gasStationId,
        date: new Date(),
        description: "",
        referenceNumber: null,
        notes: null,
        cashTransactionType: "INCOME",
        paymentAccount: "CASH",
        toPaymentAccount: undefined,
        coaId: undefined,
        amount: undefined as any,
        newCOAName: undefined,
        newCOACategory: undefined,
        newCOADescription: undefined,
      });
      setCreateNewCOAForCash(false);
      setPendingData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gasStationId]);

  const cashTransactionType = form.watch("cashTransactionType");
  const paymentAccount = form.watch("paymentAccount");
  const amount = form.watch("amount");
  const coaId = form.watch("coaId");
  const toPaymentAccount = form.watch("toPaymentAccount");

  const selectedCoaId = form.watch("coaId");
  useEffect(() => {
    if (selectedCoaId === "NEW") {
      setCreateNewCOAForCash(true);
      form.setValue("coaId", "");
    } else if (selectedCoaId && selectedCoaId !== "") {
      setCreateNewCOAForCash(false);
    }
  }, [selectedCoaId, form]);

  // Set default COA category when creating new COA
  useEffect(() => {
    if (createNewCOAForCash && !form.getValues("newCOACategory")) {
      if (cashTransactionType === "INCOME") {
        form.setValue("newCOACategory", "ASSET");
      } else if (cashTransactionType === "EXPENSE") {
        form.setValue("newCOACategory", "EXPENSE");
      }
    }
  }, [createNewCOAForCash, cashTransactionType, form]);

  // Filter COA berdasarkan nama spesifik
  const allowedCOANames = {
    INCOME: ["Piutang Karyawan", "Piutang Pihak Ketiga", "Hutang Pihak Ketiga"],
    EXPENSE: [
      "Piutang Karyawan",
      "Piutang Pihak Ketiga",
      "Hutang Pihak Ketiga",
    ],
  };

  const coaOptions = [
    ...coas
      .filter((coa) => {
        const allowedNames =
          allowedCOANames[cashTransactionType as "INCOME" | "EXPENSE"] || [];
        // Untuk EXPENSE, tambahkan semua COA dengan kategori EXPENSE
        if (cashTransactionType === "EXPENSE") {
          return allowedNames.includes(coa.name) || coa.category === "EXPENSE";
        }
        // Untuk INCOME, hanya COA yang ada di allowedNames
        return allowedNames.includes(coa.name);
      })
      .map((coa) => ({
        value: coa.id,
        label: `${coa.name} (${
          coaCategoryOptions.find((opt) => opt.value === coa.category)?.label ||
          coa.category
        })`,
      })),
    { value: "NEW", label: "+ Buat COA Baru" },
  ];

  const handleSubmit = async (data: CreateCashTransactionInput) => {
    // Preprocess: jika coaId adalah empty string dan ada newCOAName, set coaId ke undefined
    const processedData = {
      ...data,
      coaId: data.coaId === "" ? undefined : data.coaId,
    };
    
    // Validate amount is positive
    if (!processedData.amount || processedData.amount <= 0) {
      form.setError("amount", {
        type: "manual",
        message: "Amount harus lebih dari 0",
      });
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    
    setPendingData(processedData);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      const result = await createCashTransaction(pendingData);
      if (result.success) {
        toast.success(result.message);
        setConfirmOpen(false);
        onOpenChange(false);
        form.reset({
          gasStationId,
          date: new Date(),
          description: "",
          referenceNumber: null,
          notes: null,
          cashTransactionType: "INCOME",
          paymentAccount: "CASH",
          toPaymentAccount: undefined,
          coaId: undefined,
          amount: undefined as any,
        });
        setPendingData(null);
        setCreateNewCOAForCash(false);
        onSuccess?.();
      } else {
        toast.error(result.message || "Gagal membuat transaksi");
        if (result.errors) {
          // Set form errors if validation errors returned
          Object.entries(result.errors).forEach(([key, messages]) => {
            const message = Array.isArray(messages) ? messages[0] : messages;
            form.setError(key as any, {
              type: "server",
              message: message as string,
            });
          });
        }
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <SheetTitle className="text-base lg:text-xl">
              Input Transaksi Kas
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="px-2 lg:px-4 pb-2 lg:pb-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit, (errors) => {
                  console.error("Form validation errors:", errors);
                  // Show first error message
                  const firstError = Object.values(errors)[0];
                  if (firstError?.message) {
                    toast.error(firstError.message as string);
                  } else {
                    toast.error("Mohon lengkapi semua field yang wajib diisi");
                  }
                })}
                className="space-y-3 lg:space-y-4"
              >
                {/* Cash Transaction Fields */}
                <FormSelectField
                  control={form.control as any}
                  name="cashTransactionType"
                  label="Jenis"
                  placeholder="Pilih jenis"
                  options={cashTransactionTypeOptions}
                  required
                />

                <FormSelectField
                  control={form.control as any}
                  name="paymentAccount"
                  label={
                    cashTransactionType === "TRANSFER"
                      ? "Dari Kas"
                      : "Sumber Kas"
                  }
                  placeholder="Pilih sumber"
                  options={paymentAccountOptions}
                  required
                />

                {cashTransactionType === "TRANSFER" && (
                  <FormSelectField
                    control={form.control as any}
                    name="toPaymentAccount"
                    label="Ke Kas"
                    placeholder="Pilih tujuan"
                    options={paymentAccountOptions}
                    required
                  />
                )}

                {cashTransactionType !== "TRANSFER" && (
                  <FormSelectField
                    control={form.control as any}
                    name="coaId"
                    label={
                      cashTransactionType === "INCOME"
                        ? "COA Pemasukan"
                        : "COA Pengeluaran"
                    }
                    placeholder={loadingCoas ? "Memuat COA..." : "Pilih COA..."}
                    options={coaOptions}
                    required={!createNewCOAForCash}
                    disabled={loadingCoas}
                  />
                )}

                {createNewCOAForCash && (
                  <div className="space-y-2 lg:space-y-3 rounded-lg border bg-muted/50 p-2 lg:p-3">
                    <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                      <Plus className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                      <h4 className="font-semibold text-xs lg:text-sm">
                        Buat COA Baru
                      </h4>
                    </div>

                    <FormInputField
                      control={form.control as any}
                      name="newCOAName"
                      label="Nama COA"
                      placeholder="Contoh: Pendapatan Lain-lain, Beban Operasional"
                      required
                    />

                    <FormSelectField
                      control={form.control as any}
                      name="newCOACategory"
                      label="Kategori"
                      required
                      options={coaCategoryOptions.filter((opt) => {
                        if (cashTransactionType === "INCOME") {
                          // INCOME: Piutang Karyawan (ASSET), Piutang Pihak Ketiga (ASSET), Hutang Pihak Ketiga (LIABILITY)
                          return (
                            opt.value === "ASSET" || opt.value === "LIABILITY"
                          );
                        } else {
                          // EXPENSE: Piutang Karyawan (ASSET), Piutang Pihak Ketiga (ASSET), Hutang Pihak Ketiga (LIABILITY), Expense (EXPENSE)
                          return (
                            opt.value === "ASSET" ||
                            opt.value === "LIABILITY" ||
                            opt.value === "EXPENSE"
                          );
                        }
                      })}
                    />

                    <FormInputField
                      control={form.control as any}
                      name="newCOADescription"
                      label="Deskripsi"
                      placeholder="Keterangan singkat (opsional)"
                    />
                  </div>
                )}

                <div className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                  <label className="text-xs lg:text-sm">
                    Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="amount"
                    control={form.control}
                    rules={{
                      required: "Jumlah harus diisi",
                      validate: (value) => {
                        if (!value || value <= 0) {
                          return "Amount harus lebih dari 0";
                        }
                        return true;
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <div className="space-y-1">
                        <Input
                          type="text"
                          placeholder="0"
                          className={cn(
                            "text-right font-mono text-xs lg:text-sm",
                            fieldState.error &&
                              "border-red-500 focus-visible:ring-red-500"
                          )}
                          value={field.value ? formatNumber(field.value) : ""}
                          onChange={(e) => {
                            const rawValue = e.target?.value || "";
                            const numValue = parseFormattedNumber(rawValue);
                            field.onChange(numValue || undefined);
                          }}
                          onBlur={() => field.onBlur()}
                        />
                        {fieldState.error && (
                          <p className="text-xs lg:text-sm text-red-500">
                            {fieldState.error.message}
                          </p>
                        )}
                      </div>
                    )}
                  />
                </div>

                {/* Transaction Details */}
                <div className="space-y-2 lg:space-y-3">
                  <FormInputField
                    control={form.control as any}
                    name="description"
                    label="Deskripsi"
                    placeholder="Deskripsi transaksi"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    <FormDateField
                      control={form.control as any}
                      name="date"
                      label="Tanggal Transaksi"
                      required
                    />

                    <FormInputField
                      control={form.control as any}
                      name="referenceNumber"
                      label="Nomor Referensi"
                      placeholder="Contoh: INV-001, REF-123"
                    />
                  </div>

                  <FormTextareaField
                    control={form.control as any}
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
                    className="text-xs lg:text-sm"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan"
                    )}
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
            <DialogTitle>Konfirmasi Transaksi Kas</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membuat transaksi kas ini?
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs lg:text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Jenis:</span>
                <span className="font-semibold">
                  {cashTransactionTypeOptions.find(
                    (opt) => opt.value === pendingData.cashTransactionType
                  )?.label || "Transaksi Kas"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deskripsi:</span>
                <span className="font-semibold">{pendingData.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jumlah:</span>
                <span className="font-semibold font-mono">
                  Rp {(pendingData.amount || 0).toLocaleString("id-ID")}
                </span>
              </div>
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
