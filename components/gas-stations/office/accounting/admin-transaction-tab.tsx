"use client";

import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  OperationalTransactionTypeBadge,
} from "@/components/reusable/badges";
import {
  Plus,
  Package,
  Trash2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatCurrency, formatNumber } from "@/lib/utils/format-client";
import { getTransactionHistoryWithFilters } from "@/lib/actions/finance.actions";
import {
  getTransactionById,
  deleteTransaction,
} from "@/lib/actions/transaction.actions";
import { rollbackPurchaseApproval } from "@/lib/actions/rollback";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Server action export
import { getOwnerIdByGasStationId } from "@/lib/actions/gas-station.actions";
import type { TransactionWithDetails } from "@/lib/services/transaction.service";
import { DatePicker } from "@/components/reusable/date-picker";
import type { DateRange } from "react-day-picker";
import { AdminTransactionForm } from "@/components/gas-stations/office/accounting/admin-transaction-form";
import { toast } from "sonner";
import { hasPermission, type RoleCode } from "@/lib/utils/permissions";
import { Input } from "@/components/ui/input";
import {
  nowUTC,
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
} from "@/lib/utils/datetime";

type AdminTransactionTabProps = {
  gasStationId: string;
  active?: boolean;
  userRole?: string;
};

export function AdminTransactionTab({
  gasStationId,
  active = true,
  userRole,
}: AdminTransactionTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<
    TransactionWithDetails[]
  >([]);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>(
    []
  );
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [loadingRollback, setLoadingRollback] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDayUTC(addDaysUTC(nowUTC(), -6)), // Default: last 7 days
    to: endOfDayUTC(nowUTC()),
  });
  const [searchQuery, setSearchQuery] = useState("");
  const fetchedGasStationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      active &&
      gasStationId &&
      fetchedGasStationIdRef.current !== gasStationId
    ) {
      fetchedGasStationIdRef.current = gasStationId;
      fetchTransactions();
    }
  }, [active, gasStationId]);

  useEffect(() => {
    // Filter transaksi berdasarkan dateRange dan searchQuery
    let filtered: TransactionWithDetails[] = [];
    if (dateRange?.from && dateRange?.to) {
      filtered = allTransactions.filter((tx) => {
        if (!tx) return false;
        const txDate = new Date(tx.date);
        return txDate >= dateRange.from! && txDate <= dateRange.to!;
      });
    } else {
      filtered = allTransactions.filter((tx) => !!tx);
    }

    // Filter berdasarkan search query (cari di description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((tx) => {
        if (!tx) return false;
        return (
          tx.description?.toLowerCase().includes(query) ||
          tx.referenceNumber?.toLowerCase().includes(query)
        );
      });
    }

    // Sort berdasarkan tanggal (terbaru dulu)
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateB - dateA; // Descending (terbaru dulu)
      }
      // Jika tanggal sama, sort berdasarkan createdAt (terbaru dulu)
      const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdAtB - createdAtA;
    });

    setTransactions(filtered);
  }, [dateRange, allTransactions, searchQuery]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const result = await getTransactionHistoryWithFilters(gasStationId);
      if (result.success && result.data) {
        // Filter hanya transaksi yang APPROVED
        const approvedTransactions = (
          result.data as TransactionWithDetails[]
        ).filter((tx) => tx && tx.approvalStatus === "APPROVED");
        setAllTransactions(approvedTransactions);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (transactionId: string) => {
    setLoadingDetail(true);
    setDetailDialogOpen(true);
    try {
      const result = await getTransactionById(transactionId);
      if (result.success && result.data) {
        setSelectedTransaction(result.data as TransactionWithDetails);
      }
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStockAndPurchase = async () => {
    try {
      const result = await getOwnerIdByGasStationId(gasStationId);
      if (result.success && result.data) {
        const ownerId = (result.data as { ownerId: string }).ownerId;
        router.push(`/ownergroup?ownerId=${ownerId}`);
      } else {
        toast.error(result.message || "Gagal mendapatkan owner ID");
      }
    } catch (error) {
      console.error("Error getting owner ID:", error);
      toast.error("Gagal membuka halaman Stock & Purchase");
    }
  };

  const handleDeleteClick = () => {
    if (!selectedTransaction) return;

    // Validasi client-side: hanya ADMINISTRATOR dan DEVELOPER
    if (
      !userRole ||
      !hasPermission(userRole as RoleCode, ["ADMINISTRATOR", "DEVELOPER"])
    ) {
      toast.error("Anda tidak memiliki izin untuk menghapus transaksi");
      return;
    }

    // Validasi client-side: hanya ADJUSTMENT dan CASH
    const allowedTypes = ["ADJUSTMENT", "CASH"];
    if (!allowedTypes.includes(selectedTransaction.transactionType)) {
      toast.error(
        `Transaksi tipe ${selectedTransaction.transactionType} tidak dapat dihapus. Hanya transaksi manual (ADJUSTMENT dan CASH) yang dapat dihapus.`
      );
      return;
    }

    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTransaction) return;

    setLoadingDelete(true);
    try {
      const result = await deleteTransaction(selectedTransaction.id);
      if (result.success) {
        toast.success(result.message || "Transaksi berhasil dihapus");
        setDeleteConfirmOpen(false);
        setDetailDialogOpen(false);
        setSelectedTransaction(null);
        fetchTransactions();
      } else {
        toast.error(result.message || "Gagal menghapus transaksi");
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Gagal menghapus transaksi");
    } finally {
      setLoadingDelete(false);
    }
  };

  // Check if user can delete transaction
  const canDelete =
    userRole &&
    hasPermission(userRole as RoleCode, ["ADMINISTRATOR", "DEVELOPER"]);

  // Cek apakah transaksi bisa dihapus (manual)
  const isDeletableType =
    selectedTransaction &&
    ["ADJUSTMENT", "CASH"].includes(selectedTransaction.transactionType);

  // Untuk ADJUSTMENT, hanya yang dibuat manual (oleh ADMINISTRATOR atau DEVELOPER) yang bisa dihapus
  const isManualAdjustment =
    selectedTransaction?.transactionType === "ADJUSTMENT"
      ? (selectedTransaction.createdBy as { role?: string })?.role ===
          "ADMINISTRATOR" ||
        (selectedTransaction.createdBy as { role?: string })?.role ===
          "DEVELOPER"
      : true; // CASH selalu manual

  const showDeleteButton = canDelete && isDeletableType && isManualAdjustment;

  return (
    <>
      <div className=" pt-2 lg:pt-4 pb-2 lg:pb-3 flex items-center gap-2 lg:gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2 lg:left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 lg:h-4 lg:w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 lg:pl-9 text-xs lg:text-sm h-8 lg:h-9"
          />
        </div>

        {/* Date Picker */}
        <DatePicker
          date={dateRange}
          onSelect={(range) => range && setDateRange(range)}
          size="sm"
        />

        {/* Stock & Purchase Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleStockAndPurchase}
          className="text-xs lg:text-sm shrink-0"
        >
          <Package className="h-3 w-3 lg:h-4 lg:w-4 lg:mr-2" />
          <span className="hidden lg:inline">Stock & Purchase</span>
        </Button>

        {/* Add Transaction Button */}
        <Button
          size="sm"
          onClick={() => setTransactionFormOpen(true)}
          className="text-xs lg:text-sm shrink-0"
        >
          <Plus className="h-3 w-3 lg:h-4 lg:w-4 lg:mr-2" />
          <span className="hidden lg:inline">Add Transaction</span>
        </Button>
      </div>
      <div>
        {loading && !transactions.length ? (
          <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
            Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-lg border p-3 lg:p-6 text-center">
            <p className="text-xs lg:text-sm text-muted-foreground">
              Tidak ada riwayat transaksi
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs lg:text-sm">Tanggal</TableHead>
                  <TableHead className="text-xs lg:text-sm">Tipe</TableHead>
                  <TableHead className="text-xs lg:text-sm">
                    No. Referensi
                  </TableHead>
                  <TableHead className="text-xs lg:text-sm min-w-[200px]">
                    Deskripsi
                  </TableHead>
                  <TableHead className="text-right text-xs lg:text-sm">
                    Total
                  </TableHead>
                  <TableHead className="text-xs lg:text-sm">
                    Dibuat / Approve Oleh
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  if (!transaction) return null;

                  const totalDebit = (transaction.journalEntries || []).reduce(
                    (sum, entry) => sum + entry.debit,
                    0
                  );
                  const totalCredit = (transaction.journalEntries || []).reduce(
                    (sum, entry) => sum + entry.credit,
                    0
                  );
                  const totalAmount = totalDebit > 0 ? totalDebit : totalCredit;

                  return (
                    <TableRow
                      key={transaction.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetail(transaction.id)}
                    >
                      <TableCell className="text-xs lg:text-sm">
                        <div className="flex flex-col">
                          <span>
                            {format(new Date(transaction.date), "dd MMM yyyy", {
                              locale: localeId,
                            })}
                          </span>
                          {(transaction.createdAt || transaction.updatedAt) && (
                            <span className="text-[10px] lg:text-xs text-muted-foreground">
                              {format(
                                new Date(
                                  transaction.createdAt ||
                                    transaction.updatedAt!
                                ),
                                "HH:mm",
                                {
                                  locale: localeId,
                                }
                              )}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <OperationalTransactionTypeBadge
                          type={transaction.transactionType}
                        />
                      </TableCell>
                      <TableCell className="text-xs lg:text-sm">
                        {transaction.referenceNumber || "-"}
                      </TableCell>
                      <TableCell className="text-xs lg:text-sm whitespace-normal wrap-break-words min-w-[200px] max-w-[400px] lg:max-w-none">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs lg:text-sm">
                        {formatCurrency(totalAmount)}
                      </TableCell>
                      <TableCell className="text-xs lg:text-sm">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-gray-600">Dibuat:</span>{" "}
                            <span className="font-medium">
                              {transaction.createdBy?.username ||
                                transaction.createdBy?.profile?.name ||
                                "-"}
                            </span>
                          </div>
                          {transaction.approver && (
                            <div>
                              <span className="text-gray-600">Approve:</span>{" "}
                              <span className="font-medium">
                                {transaction.approver.username ||
                                  transaction.approver.profile?.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedTransaction && (
        <Dialog
          open={detailDialogOpen}
          onOpenChange={(open) => {
            if (!loadingDetail) {
              setDetailDialogOpen(open);
              if (!open) {
                setSelectedTransaction(null);
              }
            }
          }}
        >
          <DialogContent
            className="p-2 lg:p-6 max-w-[90vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto"
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle className="text-base lg:text-xl">
                Detail Transaksi
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                {selectedTransaction &&
                  format(new Date(selectedTransaction.date), "dd MMMM yyyy", {
                    locale: localeId,
                  })}
              </DialogDescription>
            </DialogHeader>

            {loadingDetail ? (
              <div className="text-center py-8 text-xs lg:text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {/* Transaction Info */}
                <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipe:</span>
                    <OperationalTransactionTypeBadge
                      type={selectedTransaction.transactionType}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-600">Deskripsi:</span>
                    <div className="font-medium wrap-break-words whitespace-pre-wrap">
                      {selectedTransaction.description}
                    </div>
                  </div>
                  {selectedTransaction.referenceNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">No. Referensi:</span>
                      <span className="font-medium">
                        {selectedTransaction.referenceNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <StatusBadge status={selectedTransaction.approvalStatus} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dibuat Oleh:</span>
                    <span className="font-medium">
                      {selectedTransaction.createdBy?.profile?.name ||
                        selectedTransaction.createdBy?.username ||
                        "-"}
                    </span>
                  </div>
                  {selectedTransaction.approver && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Diapprove Oleh:</span>
                      <span className="font-medium">
                        {selectedTransaction.approver.profile?.name ||
                          selectedTransaction.approver.username}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.notes && (
                    <div className="pt-1.5 lg:pt-2 border-t">
                      <div className="text-gray-600 mb-1 lg:mb-1.5">
                        Catatan:
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedTransaction.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Journal Entries */}
                {selectedTransaction.journalEntries &&
                  selectedTransaction.journalEntries.length > 0 && (
                    <div className="rounded-lg border bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs lg:text-sm">
                              Nama COA
                            </TableHead>
                            <TableHead className="text-xs lg:text-sm">
                              Deskripsi
                            </TableHead>
                            <TableHead className="text-right text-xs lg:text-sm">
                              Debit
                            </TableHead>
                            <TableHead className="text-right text-xs lg:text-sm">
                              Kredit
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedTransaction.journalEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs lg:text-sm">
                                {entry.coa.name}
                              </TableCell>
                              <TableCell className="text-xs lg:text-sm wrap-break-words whitespace-pre-wrap max-w-[300px]">
                                {entry.description || "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs lg:text-sm">
                                {entry.debit > 0
                                  ? formatCurrency(entry.debit)
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs lg:text-sm">
                                {entry.credit > 0
                                  ? formatCurrency(entry.credit)
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell
                              colSpan={2}
                              className="font-bold text-xs lg:text-sm"
                            >
                              Total
                            </TableCell>
                            <TableCell className="text-right font-bold font-mono text-xs lg:text-sm">
                              {formatCurrency(
                                selectedTransaction.journalEntries.reduce(
                                  (sum, e) => sum + e.debit,
                                  0
                                )
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold font-mono text-xs lg:text-sm">
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
                  )}
              </div>
            )}

            <DialogFooter className="gap-1.5 lg:gap-2">
              {showDeleteButton && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteClick}
                  disabled={loadingDetail || loadingDelete}
                  className="text-xs lg:text-sm"
                >
                  <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
                  Hapus
                </Button>
              )}
              {selectedTransaction.transactionType === "PURCHASE_BBM" &&
                selectedTransaction.approvalStatus === "APPROVED" &&
                hasPermission(userRole as RoleCode, ["DEVELOPER"]) && (
                  <Button
                    size="sm"
                    onClick={() => setRollbackConfirmOpen(true)}
                    disabled={loadingDetail || loadingDelete || loadingRollback}
                    className="text-xs lg:text-sm bg-black text-red-500 hover:bg-gray-900 hover:text-red-400"
                  >
                    <RotateCcw className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                    Rollback Purchase
                  </Button>
                )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDetailDialogOpen(false);
                  setSelectedTransaction(null);
                }}
                disabled={loadingDetail || loadingDelete || loadingRollback}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!loadingDelete) {
            setDeleteConfirmOpen(open);
          }
        }}
      >
        <DialogContent className="p-2 lg:p-6 max-w-[90vw] lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-xl">
              Konfirmasi Hapus Transaksi
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini
              tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-2 lg:space-y-3">
              <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-medium">
                    {format(
                      new Date(selectedTransaction.date),
                      "dd MMMM yyyy",
                      {
                        locale: localeId,
                      }
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipe:</span>
                  <OperationalTransactionTypeBadge
                    type={selectedTransaction.transactionType}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deskripsi:</span>
                  <span className="font-medium text-right">
                    {selectedTransaction.description}
                  </span>
                </div>
                {selectedTransaction.referenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">No. Referensi:</span>
                    <span className="font-medium">
                      {selectedTransaction.referenceNumber}
                    </span>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-2 lg:p-3 text-xs lg:text-sm text-red-800">
                <div className="font-semibold mb-1">Peringatan:</div>
                <div>
                  Menghapus transaksi ini akan menghapus semua journal entries
                  terkait dan tidak dapat dibatalkan.
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={loadingDelete}
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={loadingDelete}
              className="text-xs lg:text-sm"
            >
              <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5 lg:mr-2" />
              {loadingDelete ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Form */}
      <AdminTransactionForm
        open={transactionFormOpen}
        onOpenChange={setTransactionFormOpen}
        gasStationId={gasStationId}
        onSuccess={() => {
          fetchTransactions();
        }}
      />

      {/* Rollback Purchase Confirmation Dialog */}
      <Dialog
        open={rollbackConfirmOpen}
        onOpenChange={(open) => {
          if (!loadingRollback) {
            setRollbackConfirmOpen(open);
          }
        }}
      >
        <DialogContent className="p-2 lg:p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm lg:text-base">
              Konfirmasi Rollback Purchase
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Apakah Anda yakin ingin rollback purchase transaction ini? Semua
              transaksi terkait akan di-reverse.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-2 lg:space-y-3">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2 lg:p-3 text-xs lg:text-sm text-yellow-800">
                <div className="flex items-start gap-1.5 lg:gap-2">
                  <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-semibold">Peringatan:</div>
                    <div>
                      Rollback akan:
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Reverse transaction PURCHASE_BBM</li>
                        <li>Update status purchase menjadi REJECTED</li>
                      </ul>
                    </div>
                    <div className="font-semibold mt-1 text-red-600">
                      Tidak bisa rollback jika sudah ada unload yang terkait!
                    </div>
                    <div className="font-semibold mt-1">
                      Tindakan ini tidak dapat dibatalkan!
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 lg:p-3 text-xs lg:text-sm space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tanggal:</span>
                  <span className="font-semibold">
                    {format(
                      new Date(selectedTransaction.date),
                      "dd MMMM yyyy",
                      {
                        locale: localeId,
                      }
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span className="font-semibold">
                    {selectedTransaction.product?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Purchase Volume:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(selectedTransaction.purchaseVolume || 0)} L
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered Volume:</span>
                  <span className="font-semibold font-mono">
                    {formatNumber(selectedTransaction.deliveredVolume || 0)} L
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRollbackConfirmOpen(false)}
              disabled={loadingRollback}
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!selectedTransaction) return;
                setLoadingRollback(true);
                try {
                  const result = await rollbackPurchaseApproval(
                    selectedTransaction.id
                  );
                  if (result.success) {
                    toast.success(result.message);
                    setSelectedTransaction(null);
                    setDetailDialogOpen(false);
                    setRollbackConfirmOpen(false);
                    await fetchTransactions();
                    router.refresh();
                  } else {
                    toast.error(result.message);
                  }
                } catch (error) {
                  console.error("Error rolling back purchase:", error);
                  toast.error("Gagal melakukan rollback purchase");
                } finally {
                  setLoadingRollback(false);
                }
              }}
              disabled={loadingRollback}
              className="text-xs lg:text-sm bg-black text-red-500 hover:bg-gray-900 hover:text-red-400"
            >
              {loadingRollback ? (
                <>
                  <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                  Ya, Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
