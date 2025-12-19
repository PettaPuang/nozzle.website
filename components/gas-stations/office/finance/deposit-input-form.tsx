"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInputField } from "@/components/reusable/form";
import { ProductBadge, ShiftBadge } from "@/components/reusable/badges";
import {
  formatNumber,
  formatCurrency,
  parseFormattedNumber,
} from "@/lib/utils/format-client";
import { createOperatorDeposit } from "@/lib/actions/deposit.actions";
import { getShiftWithSales } from "@/lib/actions/operator.actions";
import { getTitipanCOAs } from "@/lib/actions/coa.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const paymentDetailSchema = z.object({
  paymentAccount: z.enum(["CASH", "BANK"]),
  paymentMethod: z
    .enum([
      "QRIS",
      "TRANSFER",
      "DEBIT_CARD",
      "CREDIT_CARD",
      "MY_PERTAMINA",
      "ETC",
    ])
    .optional(),
  bankName: z.string().max(50).optional(), // Optional: untuk multiple bank accounts
  amount: z.coerce.number(),
});

const formSchema = z.object({
  paymentDetails: z.array(paymentDetailSchema).min(0),
  notes: z.string().optional(),
  isFreeFuel: z.boolean().default(false), // Checkbox free fuel
  freeFuelAmount: z.coerce.number().optional(), // Nilai selisih untuk free fuel
  freeFuelReason: z.string().max(500).optional(), // Alasan free fuel
  titipanProducts: z
    .array(
      z.object({
        coaId: z.string().min(1, "COA wajib dipilih"),
        amount: z.coerce.number().min(1, "Nilai harus lebih dari 0"),
      })
    )
    .optional()
    .default([]), // Array titipan products
});

type DepositInputSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  onSuccess?: () => void;
};

export function DepositInputSheet({
  open,
  onOpenChange,
  shiftId,
  onSuccess,
}: DepositInputSheetProps) {
  const [loading, setLoading] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<z.infer<
    typeof formSchema
  > | null>(null);
  const [titipanCOAs, setTitipanCOAs] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      paymentDetails: [
        { paymentAccount: "CASH", paymentMethod: undefined, amount: 0 },
        { paymentAccount: "BANK", paymentMethod: "MY_PERTAMINA", amount: 0 },
      ],
      notes: "",
      isFreeFuel: false,
      freeFuelAmount: undefined,
      freeFuelReason: "",
      titipanProducts: [],
    },
  });

  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
  } = useFieldArray({
    control: form.control,
    name: "paymentDetails",
  });

  // Helper functions untuk titipan products
  const getTitipanByCoaId = (coaId: string) => {
    const titipanProducts = form.watch("titipanProducts") || [];
    return titipanProducts.find((t) => t.coaId === coaId);
  };

  const toggleTitipan = (coaId: string, checked: boolean) => {
    const titipanProducts = form.watch("titipanProducts") || [];
    if (checked) {
      // Tambahkan jika belum ada
      if (!titipanProducts.find((t) => t.coaId === coaId)) {
        form.setValue("titipanProducts", [
          ...titipanProducts,
          { coaId, amount: 0 },
        ]);
      }
    } else {
      // Hapus jika ada
      form.setValue(
        "titipanProducts",
        titipanProducts.filter((t) => t.coaId !== coaId)
      );
    }
  };

  const updateTitipanAmount = (coaId: string, amount: number) => {
    const titipanProducts = form.watch("titipanProducts") || [];
    const updated = titipanProducts.map((t) =>
      t.coaId === coaId ? { ...t, amount } : t
    );
    form.setValue("titipanProducts", updated);
  };

  useEffect(() => {
    if (open && shiftId) {
      setTitipanCOAs([]);
      fetchShiftData();
      // Reset form with default values when opening
      form.reset({
        paymentDetails: [
          { paymentAccount: "CASH", paymentMethod: undefined, amount: 0 },
          { paymentAccount: "BANK", paymentMethod: "MY_PERTAMINA", amount: 0 },
        ],
        notes: "",
        isFreeFuel: false,
        freeFuelAmount: undefined,
        freeFuelReason: "",
        titipanProducts: [],
      });
    }
  }, [open, shiftId]);

  const fetchShiftData = async () => {
    try {
      const result = await getShiftWithSales(shiftId);

      if (result.success && result.data) {
        setShiftData(result.data);

        // Fetch titipan COAs jika ada gasStationId
        if ((result.data as any)?.gasStationId) {
          try {
            const titipanResult = await getTitipanCOAs(
              (result.data as any).gasStationId
            );
            if (
              titipanResult.success &&
              titipanResult.data &&
              titipanResult.data.length > 0
            ) {
              setTitipanCOAs(titipanResult.data);
            } else {
              setTitipanCOAs([]);
            }
          } catch (error) {
            console.error("Error fetching titipan COAs:", error);
            setTitipanCOAs([]);
          }
        } else {
          setTitipanCOAs([]);
        }
      }
    } catch (error) {
      console.error("Error fetching shift data:", error);
      setTitipanCOAs([]);
    }
  };

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!shiftData) return;

    // Filter only payment methods with amount != 0
    const activePayments = data.paymentDetails.filter((p) => p.amount !== 0);
    const totalPayment = activePayments.reduce((sum, p) => sum + p.amount, 0);

    // Validasi titipan products - hitung semua yang ada amount > 0
    const titipanTotal = (data.titipanProducts || []).reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );

    // Jika free fuel dicentang
    if (data.isFreeFuel) {
      // Validasi free fuel amount dan reason wajib diisi
      if (!data.freeFuelAmount || data.freeFuelAmount <= 0) {
        toast.error("Nilai selisih untuk Free Fuel harus diisi");
        return;
      }
      if (!data.freeFuelReason || data.freeFuelReason.trim() === "") {
        toast.error("Alasan Free Fuel harus diisi");
        return;
      }
      // Validasi: total payment + free fuel + titipan harus sama dengan total sales
      const expectedTotal =
        totalPayment + (data.freeFuelAmount || 0) + titipanTotal;
      if (Math.abs(expectedTotal - shiftData.totalSales) > 0.01) {
        toast.error(
          `Total setoran (${formatCurrency(
            totalPayment
          )}) + Free Fuel (${formatCurrency(
            data.freeFuelAmount || 0
          )}) + Titipan (${formatCurrency(
            titipanTotal
          )}) harus sama dengan Total Sales (${formatCurrency(
            shiftData.totalSales
          )})`
        );
        return;
      }
    } else {
      // Jika bukan free fuel, validasi seperti biasa
      // Jika tidak ada penjualan (totalSales = 0), tidak perlu validasi payment method
      if (shiftData.totalSales > 0) {
        if (activePayments.length === 0 && titipanTotal === 0) {
          toast.error(
            "Minimal harus ada 1 metode pembayaran atau Titipan Product"
          );
          return;
        }
      }

      // Validasi: total payment + titipan harus sama dengan total sales
      const expectedTotal = totalPayment + titipanTotal;
      if (Math.abs(expectedTotal - shiftData.totalSales) > 0.01) {
        toast.error(
          `Total setoran (${formatCurrency(totalPayment)})${
            titipanTotal > 0
              ? ` + Titipan (${formatCurrency(titipanTotal)})`
              : ""
          } harus sama dengan Total Sales (${formatCurrency(
            shiftData.totalSales
          )}). Gunakan checkbox Free Fuel jika ada selisih.`
        );
        return;
      }
    }

    // Validasi titipan products - pastikan semua yang ada amount > 0 memiliki coaId yang valid
    if (data.titipanProducts && data.titipanProducts.length > 0) {
      const hasInvalidTitipan = data.titipanProducts.some(
        (t) => !t.coaId || !t.amount || t.amount <= 0
      );
      if (hasInvalidTitipan) {
        toast.error(
          "Semua Titipan Product yang dicentang harus memiliki jumlah yang valid"
        );
        return;
      }
    }

    // Show confirmation dialog
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData || !shiftData) return;

    const activePayments = pendingData.paymentDetails.filter(
      (p) => p.amount !== 0
    );

    setLoading(true);
    try {
      // Free fuel dan titipan products dikirim sebagai field terpisah, bukan sebagai payment detail
      const result = await createOperatorDeposit({
        operatorShiftId: shiftId,
        paymentDetails: activePayments,
        notes: pendingData.notes || "",
        isFreeFuel: pendingData.isFreeFuel || false,
        freeFuelAmount: pendingData.isFreeFuel
          ? pendingData.freeFuelAmount
          : undefined,
        freeFuelReason: pendingData.isFreeFuel
          ? pendingData.freeFuelReason
          : undefined,
        titipanProducts: (pendingData.titipanProducts || []).filter(
          (t) => t.amount > 0
        ),
      });

      if (result.success) {
        toast.success(result.message);
        setConfirmOpen(false);
        setPendingData(null);
        onOpenChange(false);
        form.reset();
        router.refresh();
        onSuccess?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const getTotalPayment = () => {
    const paymentDetails = form.watch("paymentDetails") || [];
    return paymentDetails.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  const getTotalSetoran = () => {
    const totalPayment = getTotalPayment();
    const isFreeFuel = form.watch("isFreeFuel");
    const freeFuelAmount = form.watch("freeFuelAmount") || 0;
    const titipanProducts = form.watch("titipanProducts") || [];

    // Total setoran = total payment + free fuel + titipan
    let total = totalPayment;
    if (isFreeFuel) {
      total += freeFuelAmount;
    }
    const titipanTotal = titipanProducts.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );
    total += titipanTotal;
    return total;
  };

  const paymentAccountOptions = [
    { value: "CASH", label: "Cash" },
    { value: "BANK", label: "Bank" },
  ];

  const paymentMethodOptions = {
    BANK: [
      { value: "QRIS", label: "QRIS" },
      { value: "TRANSFER", label: "Transfer" },
      { value: "DEBIT_CARD", label: "Debit Card" },
      { value: "CREDIT_CARD", label: "Credit Card" },
      { value: "MY_PERTAMINA", label: "My Pertamina" },
    ],
    CASH: [{ value: "ETC", label: "Lainnya" }],
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-2 overflow-y-auto">
        <SheetHeader className="px-2 pt-2">
          <SheetTitle className="text-xs lg:text-xl">Input Setoran</SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            Masukkan rincian metode pembayaran untuk shift ini
          </SheetDescription>
        </SheetHeader>

        {/* Sales Summary */}
        {shiftData && (
          <div className="px-2 lg:px-4">
            {/* Sales Details */}
            <div className="rounded-lg border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] lg:w-[150px]">Nama Operator</TableHead>
                    <TableHead className="w-[80px]">Shift</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftData.nozzleDetails?.map((nozzle: any) => {
                    const operatorName = (shiftData as any)?.operator?.profile?.name || 
                                       (shiftData as any)?.operator?.username || 
                                       "N/A";
                    
                    return (
                      <TableRow key={nozzle.nozzleId}>
                        <TableCell className="font-semibold text-xs lg:text-sm">
                          {operatorName}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          {shiftData.shift && (
                            <ShiftBadge shift={shiftData.shift} />
                          )}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          <ProductBadge productName={nozzle.productName} />
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs lg:text-sm">
                          <span className="font-mono">
                            {formatNumber(Math.round(nozzle.salesVolume))}
                          </span>{" "}
                          L
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs lg:text-sm">
                          {formatCurrency(nozzle.pricePerLiter)}
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono text-xs lg:text-sm">
                          {formatCurrency(nozzle.totalAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-right font-bold text-xs lg:text-sm"
                    >
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs lg:text-sm font-mono">
                      {formatCurrency(shiftData.totalSales)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        )}

        <ScrollArea className="px-2 lg:px-4 pb-2 lg:pb-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4 lg:space-y-6"
            >
              {/* Payment Method Inputs */}
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="flex items-center justify-between pb-1.5 lg:pb-2 border-b">
                  <h3 className="font-semibold text-xs lg:text-sm">
                    Rincian Pembayaran
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs lg:text-sm"
                    onClick={() =>
                      appendPayment({
                        paymentAccount: "CASH",
                        paymentMethod: undefined,
                        amount: 0,
                      })
                    }
                  >
                    + Tambah
                  </Button>
                </div>

                <div className="space-y-2">
                  {paymentFields.map((field, index) => {
                    const paymentAccount = form.watch(
                      `paymentDetails.${index}.paymentAccount`
                    );
                    const paymentMethod = form.watch(
                      `paymentDetails.${index}.paymentMethod`
                    );

                    return (
                      <div key={field.id} className="space-y-1.5 lg:space-y-2">
                        <div className="grid grid-cols-[90px_140px_1fr_auto] lg:grid-cols-[110px_160px_1fr_auto] gap-2.5 lg:gap-3 items-center">
                          {/* Payment Account Select */}
                          <Select
                            value={paymentAccount}
                            onValueChange={(value) => {
                              form.setValue(
                                `paymentDetails.${index}.paymentAccount` as any,
                                value as any
                              );
                              // Set default paymentMethod berdasarkan account
                              if (value === "BANK") {
                                form.setValue(
                                  `paymentDetails.${index}.paymentMethod` as any,
                                  "MY_PERTAMINA"
                                );
                              } else {
                                form.setValue(
                                  `paymentDetails.${index}.paymentMethod` as any,
                                  undefined
                                );
                              }
                            }}
                          >
                            <SelectTrigger className="text-xs lg:text-sm min-w-0 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentAccountOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Payment Method Select (optional, untuk breakdown) */}
                          <Select
                            value={paymentMethod || "NONE"}
                            onValueChange={(value) =>
                              form.setValue(
                                `paymentDetails.${index}.paymentMethod` as any,
                                value === "NONE" ? undefined : value
                              )
                            }
                            disabled={paymentAccount === "CASH"}
                          >
                            <SelectTrigger className="text-xs lg:text-sm min-w-0 w-full">
                              <SelectValue placeholder="Detail (opsional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">
                                Tidak ada detail
                              </SelectItem>
                              {paymentMethodOptions[
                                paymentAccount as "CASH" | "BANK"
                              ]?.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Amount Input */}
                          <Controller
                            name={`paymentDetails.${index}.amount` as any}
                            control={form.control}
                            render={({ field }) => (
                              <div className="relative min-w-0 w-full">
                                <Input
                                  type="text"
                                  placeholder="0"
                                  className="text-right font-mono text-xs lg:text-sm w-full"
                                  value={
                                    field.value ? formatNumber(field.value) : ""
                                  }
                                  onChange={(e) => {
                                    const rawValue = e.target?.value || "";
                                    const numValue =
                                      parseFormattedNumber(rawValue);
                                    field.onChange(numValue);
                                  }}
                                  onBlur={() => field.onBlur()}
                                />
                              </div>
                            )}
                          />

                          {/* Delete Button */}
                          {paymentFields.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removePayment(index)}
                              className="h-6 w-6 lg:h-7 lg:w-7 text-red-600 hover:text-red-700 hover:bg-red-50 p-0"
                            >
                              <Trash2 className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kekurangan Pembayaran */}
              <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
                <div className="pb-1.5 lg:pb-2 border-b">
                  <h3 className="text-xs lg:text-sm font-semibold">
                    Kekurangan Pembayaran
                  </h3>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">
                    Pilih jenis kekurangan pembayaran yang ada
                  </p>
                </div>

                <div className="space-y-3 lg:space-y-4">
                  {/* Free Fuel Checkbox */}
                  <div className="space-y-2 lg:space-y-3">
                    <Controller
                      control={form.control}
                      name="isFreeFuel"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                  form.setValue("freeFuelAmount", undefined);
                                  form.setValue("freeFuelReason", "");
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-xs lg:text-sm font-semibold cursor-pointer">
                            Free Fuel
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {/* Input Free Fuel - hanya muncul jika checkbox dicentang */}
                    {form.watch("isFreeFuel") && (
                      <div className="space-y-2 lg:space-y-3 pl-6 border-l-2 border-primary/20">
                        <Controller
                          control={form.control}
                          name="freeFuelAmount"
                          rules={{ required: "Nilai selisih harus diisi" }}
                          render={({ field, fieldState }) => (
                            <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                              <FormLabel className="text-xs lg:text-sm">
                                Nilai Selisih <span>*</span>
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
                                      field.value
                                        ? formatNumber(field.value)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const rawValue = e.target?.value || "";
                                      const numValue =
                                        parseFormattedNumber(rawValue);
                                      field.onChange(numValue);
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                                {fieldState.error && (
                                  <FormMessage className="text-xs lg:text-sm">
                                    {fieldState.error.message}
                                  </FormMessage>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormInputField
                          control={form.control}
                          name="freeFuelReason"
                          label="Alasan Selisih *"
                          placeholder="Contoh: Promosi, komplain pelanggan, dll"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Titipan Products */}
                  {titipanCOAs.length > 0 &&
                    titipanCOAs.map((coa) => {
                      const titipan = getTitipanByCoaId(coa.id);
                      const isChecked = !!titipan;
                      return (
                        <div key={coa.id} className="space-y-2 lg:space-y-3">
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  toggleTitipan(coa.id, checked as boolean);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-xs lg:text-sm font-semibold cursor-pointer">
                              {coa.name}
                            </FormLabel>
                          </FormItem>

                          {/* Input Titipan - hanya muncul jika checkbox dicentang */}
                          {isChecked && (
                            <div className="space-y-2 lg:space-y-3 pl-6 border-l-2 border-primary/20">
                              <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
                                <FormLabel className="text-xs lg:text-sm">
                                  Jumlah <span>*</span>
                                </FormLabel>
                                <div className="space-y-1">
                                  <FormControl>
                                    <Input
                                      type="text"
                                      placeholder="0"
                                      className="text-right font-mono text-xs lg:text-sm"
                                      value={
                                        titipan?.amount
                                          ? formatNumber(titipan.amount)
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const rawValue = e.target?.value || "";
                                        const numValue =
                                          parseFormattedNumber(rawValue);
                                        updateTitipanAmount(coa.id, numValue);
                                      }}
                                    />
                                  </FormControl>
                                  {!titipan?.amount && (
                                    <FormMessage className="text-xs lg:text-sm">
                                      Jumlah harus diisi
                                    </FormMessage>
                                  )}
                                </div>
                              </FormItem>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <FormInputField
                  control={form.control}
                  name="notes"
                  label="Catatan (Opsional)"
                  placeholder="Tambahkan catatan jika ada..."
                />
              </div>

              {/* Payment Summary */}
              {shiftData && (
                <div className="rounded-lg border-2 bg-white p-2 lg:p-4 space-y-2 lg:space-y-3">
                  <h4 className="font-semibold text-xs lg:text-sm mb-1 lg:mb-2">
                    Ringkasan
                  </h4>
                  <div className="flex justify-between text-xs lg:text-sm">
                    <span className="text-muted-foreground">Total Sales</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(shiftData.totalSales)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs lg:text-sm">
                    <span className="text-muted-foreground">Total Setoran</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(getTotalPayment())}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xs lg:text-sm">
                    <span className="text-muted-foreground">Selisih</span>
                    <span
                      className={`font-semibold font-mono ${
                        Math.abs(getTotalPayment() - shiftData.totalSales) <
                        0.01
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(getTotalPayment() - shiftData.totalSales)}
                    </span>
                  </div>
                  <Separator />
                  {form.watch("isFreeFuel") && form.watch("freeFuelAmount") && (
                    <div className="flex justify-between text-xs lg:text-sm">
                      <span className="text-muted-foreground">Free Fuel</span>
                      <span className="font-semibold font-mono text-orange-600">
                        {formatCurrency(form.watch("freeFuelAmount") || 0)}
                      </span>
                    </div>
                  )}
                  {(form.watch("titipanProducts") || [])
                    .filter((t) => t.amount > 0)
                    .map((titipan, index) => {
                      const coa = titipanCOAs.find(
                        (c) => c.id === titipan.coaId
                      );
                      return (
                        <div
                          key={index}
                          className="flex justify-between text-xs lg:text-sm"
                        >
                          <span className="text-muted-foreground">
                            {coa?.name || "Titipan"}
                          </span>
                          <span className="font-semibold font-mono text-blue-600">
                            {formatCurrency(titipan.amount)}
                          </span>
                        </div>
                      );
                    })}
                  <Separator />
                  <div className="flex justify-between font-bold text-xs lg:text-sm">
                    <span>Selisih</span>
                    <span
                      className={`font-mono ${
                        Math.abs(getTotalSetoran() - shiftData.totalSales) <
                        0.01
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(getTotalSetoran() - shiftData.totalSales)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 lg:gap-2 pt-2 lg:pt-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  size="sm"
                  className="text-xs lg:text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Setoran"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!loading) {
            setConfirmOpen(open);
            if (!open) setPendingData(null);
          }
        }}
      >
        <DialogContent className="p-2 lg:p-6" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base lg:text-xl">
              Konfirmasi Input Setoran
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin menyimpan setoran ini?
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
              {shiftData && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sales:</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(shiftData.totalSales)}
                  </span>
                </div>
              )}
              {pendingData.isFreeFuel && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Total Setoran (Payment):
                    </span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(
                        pendingData.paymentDetails
                          .filter((p) => p.amount !== 0)
                          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                      )}
                    </span>
                  </div>
                  {pendingData.freeFuelAmount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Free Fuel:</span>
                      <span className="font-semibold font-mono text-orange-600">
                        {formatCurrency(pendingData.freeFuelAmount)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {(pendingData.titipanProducts || [])
                .filter((t) => t.amount > 0)
                .map((titipan, index) => {
                  const coa = titipanCOAs.find((c) => c.id === titipan.coaId);
                  return (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">
                        {coa?.name || "Titipan"}:
                      </span>
                      <span className="font-semibold font-mono text-blue-600">
                        {formatCurrency(titipan.amount)}
                      </span>
                    </div>
                  );
                })}
              <div className="flex justify-between">
                <span className="text-gray-600">Total Setoran:</span>
                <span className="font-semibold font-mono">
                  {formatCurrency(
                    pendingData.paymentDetails
                      .filter((p) => p.amount !== 0)
                      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
                      (pendingData.isFreeFuel
                        ? pendingData.freeFuelAmount || 0
                        : 0) +
                      (pendingData.titipanProducts || []).reduce(
                        (sum, t) => sum + (t.amount || 0),
                        0
                      )
                  )}
                </span>
              </div>
              {pendingData.paymentDetails.filter((p) => p.amount !== 0).length >
                0 && (
                <div className="pt-1.5 lg:pt-2 border-t">
                  <div className="text-gray-600 mb-1 lg:mb-1.5">
                    Rincian Pembayaran:
                  </div>
                  <div className="space-y-1 lg:space-y-1.5">
                    {pendingData.paymentDetails
                      .filter((p) => p.amount !== 0)
                      .map((payment, index) => (
                        <div key={index} className="flex justify-between">
                          <span className="text-gray-600">
                            {payment.paymentAccount === "CASH"
                              ? "Cash"
                              : "Bank"}
                            {payment.paymentMethod &&
                              ` - ${payment.paymentMethod}`}
                            {payment.bankName && ` (${payment.bankName})`}
                          </span>
                          <span className="font-semibold font-mono">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setPendingData(null);
              }}
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Ya, Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
