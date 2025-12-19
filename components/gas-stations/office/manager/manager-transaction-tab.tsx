"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/format-client";
import { toast } from "sonner";
import {
  updateTransaction,
  getTransactionById,
} from "@/lib/actions/transaction.actions";
import {
  getPendingApprovalTransactions,
  getTransactionHistoryWithFilters,
  getTransactionHistory,
} from "@/lib/actions/finance.actions";
import { getTanks } from "@/lib/actions/tank.actions";
import type { DateRange } from "react-day-picker";
import { DatePicker } from "@/components/reusable/date-picker";
import { TransactionHistoryTable } from "@/components/gas-stations/office/finance/transaction-history-table";
import type { TransactionHistory } from "@/lib/services/finance.service";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";

type TransactionApprovalTabProps = {
  gasStationId: string;
  active?: boolean;
};

type PendingTransaction = {
  id: string;
  description: string;
  date: Date;
  referenceNumber: string | null;
  notes: string | null;
  approvalStatus: string;
  createdBy: {
    id: string;
    username: string;
    profile: {
      name: string;
    } | null;
  };
  journalEntries: Array<{
    id: string;
    coa: {
      id: string;
      name: string;
      category: string;
    };
    debit: number;
    credit: number;
    description: string | null;
  }>;
  createdAt: Date;
};

type HistoryTransaction = PendingTransaction & {
  approver: {
    id: string;
    username: string;
    profile: {
      name: string;
    } | null;
  } | null;
  updatedAt: Date;
};

export function TransactionApprovalTab({
  gasStationId,
  active = true,
}: TransactionApprovalTabProps) {
  const [loading, setLoading] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<
    TransactionHistory[]
  >([]);
  const [pendingTransactionsRaw, setPendingTransactionsRaw] = useState<
    PendingTransaction[]
  >([]);
  const [historyTransactions, setHistoryTransactions] = useState<
    HistoryTransaction[]
  >([]);
  const [historyTransactionsFormatted, setHistoryTransactionsFormatted] =
    useState<TransactionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<PendingTransaction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tanks, setTanks] = useState<
    Array<{
      id: string;
      name: string;
      code: string;
      product: { name: string; purchasePrice: number };
    }>
  >([]);
  const [pendingDateRange, setPendingDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -3650)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const router = useRouter();
  const fetchedGasStationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      active &&
      gasStationId &&
      fetchedGasStationIdRef.current !== gasStationId
    ) {
      fetchedGasStationIdRef.current = gasStationId;
      fetchTransactions();
      fetchHistoryTransactions();
      fetchTanks();
    }
  }, [active, gasStationId]);

  const fetchTanks = async () => {
    try {
      const result = await getTanks(gasStationId);
      if (result.success && result.data) {
        setTanks(result.data as any);
      }
    } catch (error) {
      console.error("Error fetching tanks:", error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Fetch raw transactions untuk dialog approval
      const rawResult = await getPendingApprovalTransactions(gasStationId);
      if (rawResult.success && rawResult.data) {
        setPendingTransactionsRaw(rawResult.data as PendingTransaction[]);
      }

      // Fetch transaction history dan filter yang PENDING
      const historyResult = await getTransactionHistory(gasStationId);
      if (historyResult.success && historyResult.data) {
        const allTransactions = historyResult.data as TransactionHistory[];
        const pending = allTransactions.filter((tx) => tx.status === "PENDING");
        setPendingTransactions(pending);
      } else {
        toast.error(historyResult.message || "Gagal memuat data transaksi");
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Gagal memuat data transaksi");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryTransactions = async () => {
    setHistoryLoading(true);
    try {
      // Fetch raw transactions untuk approval status mapping
      // managerOnly: true untuk mendapatkan transaksi yang perlu approval manager
      const rawResult = await getTransactionHistoryWithFilters(
        gasStationId,
        undefined,
        true // true untuk mendapatkan transaksi yang perlu manager approval
      );
      if (rawResult.success && rawResult.data) {
        // Simpan semua raw transactions untuk approval status mapping
        setHistoryTransactions(rawResult.data as HistoryTransaction[]);
      }

      // Fetch transaction history dalam format TransactionHistory[]
      // Filter untuk exclude deposit dan purchase
      const historyResult = await getTransactionHistory(gasStationId);
      if (historyResult.success && historyResult.data) {
        const allTransactions = historyResult.data as TransactionHistory[];
        // Filter hanya APPROVED dan REJECTED, exclude deposit dan purchase
        const history = allTransactions.filter(
          (tx) =>
            (tx.status === "APPROVED" || tx.status === "REJECTED") &&
            tx.source !== "DEPOSIT" &&
            tx.transactionType !== "PURCHASE_BBM"
        );
        setHistoryTransactionsFormatted(history);
      } else {
        toast.error(historyResult.message || "Gagal memuat riwayat transaksi");
      }
    } catch (error) {
      console.error("Error fetching history transactions:", error);
      toast.error("Gagal memuat riwayat transaksi");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Extract transaction ID from TransactionHistory.id format
  // Format: `${transaction.id}-income-${entry.id}` or `${transaction.id}-expense-${entry.id}`
  const extractTransactionId = (historyId: string): string | null => {
    const match = historyId.match(/^([^-]+)-/);
    return match ? match[1] : null;
  };

  const handleViewDetail = async (transaction: TransactionHistory) => {
    const transactionId = extractTransactionId(transaction.id);
    if (!transactionId) {
      toast.error("Gagal mendapatkan detail transaksi");
      return;
    }

    setLoadingDetail(true);
    try {
      // Find raw transaction dari pendingTransactionsRaw
      const rawTransaction = pendingTransactionsRaw.find(
        (tx) => tx.id === transactionId
      );

      if (rawTransaction) {
        setSelectedTransaction(rawTransaction);
      } else {
        toast.error("Transaksi tidak ditemukan");
      }
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
      toast.error("Gagal memuat detail transaksi");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTransaction) return;

    setProcessing(true);
    try {
      const result = await updateTransaction(selectedTransaction.id, {
        approvalStatus: "APPROVED",
        // approverId akan di-set otomatis di server side jika belum ada
      });

      if (result.success) {
        toast.success(result.message || "Transaksi berhasil diapprove");
        setSelectedTransaction(null);
        await fetchTransactions();
        await fetchHistoryTransactions();
        router.refresh();
      } else {
        toast.error(result.message || "Gagal memproses transaksi");
      }
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast.error("Gagal memproses transaksi");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTransaction) return;

    setProcessing(true);
    try {
      const result = await updateTransaction(selectedTransaction.id, {
        approvalStatus: "REJECTED",
      });

      if (result.success) {
        toast.success(result.message);
        setSelectedTransaction(null);
        await fetchTransactions();
        await fetchHistoryTransactions();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error rejecting transaction:", error);
      toast.error("Gagal memproses transaksi");
    } finally {
      setProcessing(false);
    }
  };

  const getTransactionAmount = (transaction: PendingTransaction) => {
    const totalDebit = transaction.journalEntries.reduce(
      (sum, entry) => sum + Number(entry.debit),
      0
    );
    const totalCredit = transaction.journalEntries.reduce(
      (sum, entry) => sum + Number(entry.credit),
      0
    );
    return Math.max(totalDebit, totalCredit);
  };

  // Create approval status map from historyTransactions
  // Map transaction ID ke approval status info (createdByName, approverName)
  const approvalStatusMap = useMemo(() => {
    const map = new Map<
      string,
      { createdByName?: string; approverName?: string }
    >();

    // Build map from historyTransactions (raw data dengan createdBy dan approver lengkap)
    // Key adalah transaction ID yang akan digunakan untuk lookup di table
    historyTransactions.forEach((tx) => {
      const createdByName = tx.createdBy.profile?.name || tx.createdBy.username;
      const approverName =
        tx.approver?.profile?.name || tx.approver?.username || undefined;

      // Set dengan transaction ID sebagai key
      map.set(tx.id, {
        createdByName,
        approverName,
      });
    });

    return map;
  }, [historyTransactions]);

  const handleViewHistoryDetail = async (transaction: TransactionHistory) => {
    const transactionId = extractTransactionId(transaction.id);
    if (!transactionId) {
      toast.error("Gagal mendapatkan detail transaksi");
      return;
    }

    setLoadingDetail(true);
    try {
      // Coba cari di historyTransactions dulu
      let rawTransaction = historyTransactions.find(
        (tx) => tx.id === transactionId
      );

      // Jika tidak ditemukan di historyTransactions, fetch dari server
      if (!rawTransaction) {
        const result = await getTransactionById(transactionId);

        if (result.success && result.data) {
          // Convert TransactionWithDetails ke format PendingTransaction/HistoryTransaction
          const tx = result.data;
          if (!tx.createdBy) {
            toast.error("Data transaksi tidak lengkap");
            return;
          }
          rawTransaction = {
            id: tx.id,
            description: tx.description,
            date: tx.date,
            referenceNumber: tx.referenceNumber,
            notes: tx.notes,
            approvalStatus: tx.approvalStatus,
            createdBy: {
              id: tx.createdBy.id,
              username: tx.createdBy.username,
              profile: tx.createdBy.profile,
            },
            journalEntries: tx.journalEntries.map((entry) => ({
              id: entry.id,
              coa: {
                id: entry.coa.id,
                name: entry.coa.name,
                category: entry.coa.category,
              },
              debit: entry.debit,
              credit: entry.credit,
              description: entry.description,
            })),
            createdAt: tx.createdAt,
            approver: tx.approver
              ? {
                  id: tx.approver.id,
                  username: tx.approver.username,
                  profile: tx.approver.profile,
                }
              : null,
            updatedAt: tx.updatedAt || tx.createdAt,
          } as HistoryTransaction;
        }
      }

      if (rawTransaction) {
        setSelectedTransaction(rawTransaction);
      } else {
        toast.error("Transaksi tidak ditemukan");
      }
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
      toast.error("Gagal memuat detail transaksi");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <>
      <div className="space-y-3 lg:space-y-4">
        {/* Pending Transactions */}
        <div className="space-y-1.5 lg:space-y-3">
          <h3 className="text-xs lg:text-sm font-semibold px-1 lg:px-2">
            Pending Transactions
          </h3>
          {loading && !pendingTransactions.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : pendingTransactions.length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada transaksi pending approval
              </p>
            </div>
          ) : (
            <TransactionHistoryTable
              transactions={pendingTransactions}
              dateRange={pendingDateRange}
              onDateRangeChange={setPendingDateRange}
              onViewDetail={handleViewDetail}
              loadingDetail={loadingDetail}
              extractTransactionId={extractTransactionId}
              hideActionColumn={true}
            />
          )}
        </div>

        {/* History Transactions */}
        <div className="space-y-1.5 lg:space-y-3">
          <div className="flex items-center justify-between px-1 lg:px-2">
            <h3 className="text-xs lg:text-sm font-semibold">
              History Transactions
            </h3>
            <DatePicker
              date={dateRange}
              onSelect={(range) => range && setDateRange(range)}
              size="sm"
            />
          </div>
          {historyLoading && !historyTransactionsFormatted.length ? (
            <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
              Loading...
            </div>
          ) : historyTransactionsFormatted.length === 0 ? (
            <div className="rounded-lg border p-3 lg:p-6 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                Tidak ada riwayat transaksi
              </p>
            </div>
          ) : (
            <TransactionHistoryTable
              transactions={historyTransactionsFormatted}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onViewDetail={handleViewHistoryDetail}
              loadingDetail={loadingDetail}
              extractTransactionId={extractTransactionId}
              showApprovalStatus={true}
              approvalStatusMap={approvalStatusMap}
              hideActionColumn={true}
            />
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      {selectedTransaction && (
        <Dialog
          open={!!selectedTransaction}
          onOpenChange={(open) => {
            if (!open && !processing) {
              setSelectedTransaction(null);
            }
          }}
        >
          <DialogContent className="p-2 lg:p-6" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle className="text-base lg:text-xl">
                Detail Transaksi
              </DialogTitle>
              <DialogDescription className="text-xs lg:text-sm">
                {selectedTransaction.approvalStatus === "PENDING"
                  ? "Review transaksi sebelum approve atau reject"
                  : "Detail transaksi"}
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction &&
              (() => {
                const amount = getTransactionAmount(selectedTransaction);

                return (
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
                          {new Date(
                            selectedTransaction.date
                          ).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dibuat Oleh:</span>
                        <span className="font-semibold">
                          {selectedTransaction.createdBy.profile?.name ||
                            selectedTransaction.createdBy.username}
                        </span>
                      </div>
                      {selectedTransaction.approvalStatus !== "PENDING" &&
                        (() => {
                          const historyTx =
                            selectedTransaction as HistoryTransaction;
                          return (
                            historyTx.approver && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Diapprove Oleh:
                                </span>
                                <span className="font-semibold">
                                  {historyTx.approver.profile?.name ||
                                    historyTx.approver.username ||
                                    "-"}
                                </span>
                              </div>
                            )
                          );
                        })()}
                    </div>

                    {/* Amount Summary */}
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 lg:p-3">
                      <div className="flex justify-between text-xs lg:text-sm py-1">
                        <span>Jumlah:</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

            <DialogFooter className="gap-1.5 lg:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTransaction(null);
                }}
                disabled={processing}
                className="text-xs lg:text-sm"
              >
                Tutup
              </Button>
              {selectedTransaction.approvalStatus === "PENDING" && (
                <>
                  <Button
                    size="sm"
                    onClick={handleReject}
                    disabled={processing}
                    variant="destructive"
                    className="text-xs lg:text-sm"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                        Reject
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={processing}
                    variant="default"
                    className="text-xs lg:text-sm"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                        Approve
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
