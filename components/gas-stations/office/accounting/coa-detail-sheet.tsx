"use client";

import { useState, useEffect, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { COACategoryBadge } from "@/components/reusable/badges/coa-category-badge";
import { Loader2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils/format-client";
import { getCOAJournalEntries, updateCOA } from "@/lib/actions/coa.actions";
import { getTransactionById } from "@/lib/actions/transaction.actions";
import type { TransactionWithDetails } from "@/lib/services/transaction.service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { FormInputField } from "@/components/reusable/form";
import {
  updateCOASchema,
  type UpdateCOAInput,
} from "@/lib/validations/coa.validation";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { DatePicker } from "@/components/reusable/date-picker";
import {
  nowUTC,
  startOfMonthUTC,
  startOfDayUTC,
  endOfDayUTC,
} from "@/lib/utils/datetime";

type COADetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coa: {
    id: string;
    name: string;
    category: string;
    balance: number;
    totalDebit: number;
    totalCredit: number;
    description?: string | null;
  };
  onUpdate?: () => void;
};

type JournalEntryWithTransaction = {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  transaction: {
    id: string;
    date: Date;
    description: string;
    referenceNumber: string | null;
    notes: string | null;
    approvalStatus: string;
    createdAt?: Date;
    createdBy: {
      id: string;
      username: string;
      profile: {
        name: string;
      } | null;
    };
    approver: {
      id: string;
      username: string;
      profile: {
        name: string;
      } | null;
    } | null;
    journalEntries: Array<{
      id: string;
      coa: {
        id: string;
        name: string;
        category: string;
      };
      debit: number;
      credit: number;
    }>;
  };
  coa: {
    id: string;
    name: string;
    category: string;
  };
};

export function COADetailSheet({
  open,
  onOpenChange,
  coa,
  onUpdate,
}: COADetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [allJournalEntries, setAllJournalEntries] = useState<
    JournalEntryWithTransaction[]
  >([]);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonthUTC(nowUTC()), // Default: bulan ini
    to: endOfDayUTC(nowUTC()),
  });

  const form = useForm<UpdateCOAInput>({
    resolver: zodResolver(updateCOASchema) as any,
    defaultValues: {
      name: coa.name,
      description: coa.description || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: coa.name,
        description: coa.description || "",
      });
      setIsEditing(false);
    }
  }, [open, coa]);

  useEffect(() => {
    if (open && coa.id) {
      fetchJournalEntries();
    }
  }, [open, coa.id]);

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const result = await getCOAJournalEntries(coa.id);
      if (result.success && result.data) {
        // Sort berdasarkan tanggal transaksi terbaru (descending)
        // Jika tanggal sama, sort berdasarkan createdAt transaksi (descending)
        const sortedEntries = (
          result.data as JournalEntryWithTransaction[]
        ).sort((a, b) => {
          const dateA = new Date(a.transaction.date).getTime();
          const dateB = new Date(b.transaction.date).getTime();

          // Jika tanggal berbeda, sort berdasarkan tanggal (terbaru di atas)
          if (dateA !== dateB) {
            return dateB - dateA;
          }

          // Jika tanggal sama, sort berdasarkan createdAt (terbaru di atas)
          const createdAtA = new Date(a.transaction.createdAt || 0).getTime();
          const createdAtB = new Date(b.transaction.createdAt || 0).getTime();
          return createdAtB - createdAtA;
        });
        setAllJournalEntries(sortedEntries);
      }
    } catch (error) {
      console.error("Error fetching journal entries:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter journal entries berdasarkan dateRange untuk table
  const journalEntries = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return allJournalEntries;

    const startDate = startOfDayUTC(dateRange.from);
    const endDate = endOfDayUTC(dateRange.to);

    return allJournalEntries.filter((entry) => {
      const entryDate = new Date(entry.transaction.date);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }, [allJournalEntries, dateRange]);

  // Hitung saldo awal (sebelum startDate)
  const saldoAwal = useMemo(() => {
    if (!dateRange.from) return 0;

    const startDate = startOfDayUTC(dateRange.from);
    const entriesBeforeStart = allJournalEntries.filter((entry) => {
      const entryDate = new Date(entry.transaction.date);
      return entryDate < startDate;
    });

    // Hitung balance berdasarkan kategori COA
    let balance = 0;
    entriesBeforeStart.forEach((entry) => {
      if (coa.category === "ASSET" || coa.category === "EXPENSE") {
        // ASSET dan EXPENSE: Debit - Credit
        balance += entry.debit - entry.credit;
      } else {
        // LIABILITY, EQUITY, REVENUE: Credit - Debit
        balance += entry.credit - entry.debit;
      }
    });

    return balance;
  }, [allJournalEntries, dateRange, coa.category]);

  // Helper function untuk menghapus metadata internal dari notes
  const cleanTransactionNotes = (notes: string | null | undefined): string => {
    if (!notes) return "";
    // Hapus bagian [PURCHASE_INFO]...[/PURCHASE_INFO] dari notes (termasuk newline sebelum dan sesudahnya)
    let cleaned = notes.replace(
      /\[PURCHASE_INFO\][\s\S]*?\[\/PURCHASE_INFO\]/g,
      ""
    );
    // Hapus double newline yang mungkin terjadi setelah menghapus metadata
    cleaned = cleaned.replace(/\n\n\n+/g, "\n\n");
    // Trim whitespace di awal dan akhir
    return cleaned.trim();
  };

  const handleViewTransaction = async (transactionId: string) => {
    setLoadingDetail(true);
    try {
      const result = await getTransactionById(transactionId);
      if (result.success && result.data) {
        setSelectedTransaction(result.data);
      }
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    form.reset({
      name: coa.name,
      description: coa.description || "",
    });
  };

  const handleSubmit = async (data: UpdateCOAInput) => {
    setIsSubmitting(true);
    try {
      const result = await updateCOA(coa.id, data);
      if (result.success) {
        toast.success(result.message || "COA berhasil diupdate");
        setIsEditing(false);
        onUpdate?.();
        onOpenChange(false);
      } else {
        toast.error(result.message || "Gagal mengupdate COA");
      }
    } catch (error) {
      console.error("Error updating COA:", error);
      toast.error("Gagal mengupdate COA");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="p-2 overflow-y-auto">
          <SheetHeader className="px-2 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base lg:text-xl">
                  Detail COA: {coa.name}
                </SheetTitle>
                <SheetDescription className="text-xs lg:text-sm">
                  Daftar transaksi untuk akun ini
                </SheetDescription>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="text-xs lg:text-sm"
                >
                  <Edit2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="px-2 lg:px-4 pb-2 lg:pb-4">
            {isEditing ? (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-3 lg:space-y-4 mt-1.5 lg:mt-4"
                >
                  <div className="rounded-lg bg-muted p-2 lg:p-4 space-y-2 lg:space-y-3">
                    <div className="flex justify-between text-xs lg:text-sm">
                      <span className="text-muted-foreground">Kategori</span>
                      <COACategoryBadge category={coa.category} />
                    </div>
                    <div className="flex justify-between text-xs lg:text-sm">
                      <span className="text-muted-foreground">Saldo</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(coa.balance)}
                      </span>
                    </div>
                  </div>

                  <FormInputField
                    control={form.control}
                    name="name"
                    label="Nama COA"
                    placeholder="Nama akun"
                    required
                  />

                  <FormInputField
                    control={form.control}
                    name="description"
                    label="Deskripsi"
                    placeholder="Deskripsi akun (opsional)"
                    type="text"
                  />

                  <div className="flex gap-1.5 lg:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        form.reset({
                          name: coa.name,
                          description: coa.description || "",
                        });
                      }}
                      disabled={isSubmitting}
                      className="text-xs lg:text-sm flex-1"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting}
                      className="text-xs lg:text-sm flex-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        "Simpan"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <>
                {/* COA Summary */}
                <div className="mt-1.5 lg:mt-4 mb-4 space-y-2 lg:space-y-3">
                  <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Kategori:</span>
                      <COACategoryBadge category={coa.category} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saldo Awal:</span>
                      <span className="font-semibold font-mono">
                        {formatCurrency(saldoAwal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Debit:</span>
                      <span className="font-semibold font-mono">
                        {formatCurrency(coa.totalDebit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Kredit:</span>
                      <span className="font-semibold font-mono">
                        {formatCurrency(coa.totalCredit)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 lg:pt-2">
                      <span className="text-gray-600 font-semibold">
                        Saldo:
                      </span>
                      <span className="font-bold font-mono text-blue-600">
                        {formatCurrency(coa.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-3 lg:mb-4 flex items-center justify-between">
                  <h4 className="text-xs lg:text-sm font-semibold">
                    Daftar Transaksi
                  </h4>
                  <DatePicker
                    date={dateRange}
                    onSelect={(range) => range && setDateRange(range)}
                    size="sm"
                  />
                </div>

                {/* Journal Entries Table */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : journalEntries.length === 0 ? (
                  <div className="rounded-lg border p-3 lg:p-6 text-center">
                    <p className="text-xs lg:text-sm text-muted-foreground">
                      Belum ada transaksi untuk akun ini
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Kredit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journalEntries.map((entry) => (
                          <TableRow
                            key={entry.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              handleViewTransaction(entry.transaction.id)
                            }
                          >
                            <TableCell>
                              {format(
                                new Date(entry.transaction.date),
                                "dd MMM yyyy",
                                {
                                  locale: localeId,
                                }
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate">
                                {entry.transaction.description}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.debit > 0
                                ? formatCurrency(entry.debit)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.credit > 0
                                ? formatCurrency(entry.credit)
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Transaction Detail Dialog */}
      {selectedTransaction && (
        <Dialog
          open={!!selectedTransaction}
          onOpenChange={(open) => {
            if (!open) setSelectedTransaction(null);
          }}
        >
          <DialogContent className="max-w-[80%] lg:max-w-[50%] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm lg:text-base">
                Detail Transaksi
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                Informasi lengkap transaksi
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction && (
              <div className="space-y-2 lg:space-y-3">
                {/* Transaction Info */}
                <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deskripsi:</span>
                    <span className="font-semibold text-right max-w-[60%]">
                      {selectedTransaction.description}
                    </span>
                  </div>
                  {selectedTransaction.referenceNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">No. Referensi:</span>
                      <span className="font-semibold">
                        {selectedTransaction.referenceNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tanggal:</span>
                    <span className="font-semibold">
                      {new Date(selectedTransaction.date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  {selectedTransaction.createdBy && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dibuat Oleh:</span>
                      <span className="font-semibold">
                        {selectedTransaction.createdBy.profile?.name ||
                          selectedTransaction.createdBy.username}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.approver && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Diapprove Oleh:</span>
                      <span className="font-semibold">
                        {selectedTransaction.approver.profile?.name ||
                          selectedTransaction.approver.username ||
                          "-"}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.notes && (
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-600">Catatan:</span>
                      <span className="font-semibold text-xs whitespace-pre-wrap">
                        {cleanTransactionNotes(selectedTransaction.notes)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Journal Entries */}
                <div className="rounded-lg border bg-white">
                  <div className="p-2 lg:p-3 border-b">
                    <h4 className="text-xs lg:text-sm font-semibold">
                      Jurnal Entries
                    </h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>COA</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Kredit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransaction.journalEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5 lg:gap-2">
                              <span>{entry.coa.name}</span>
                              <COACategoryBadge category={entry.coa.category} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.debit > 0
                              ? formatCurrency(entry.debit)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.credit > 0
                              ? formatCurrency(entry.credit)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-semibold font-mono">
                          {formatCurrency(
                            selectedTransaction.journalEntries.reduce(
                              (sum, e) => sum + e.debit,
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold font-mono">
                          {formatCurrency(
                            selectedTransaction.journalEntries.reduce(
                              (sum, e) => sum + e.credit,
                              0
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter className="gap-1.5 lg:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTransaction(null);
                }}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
