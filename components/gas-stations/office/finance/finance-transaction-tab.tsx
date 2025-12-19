"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CashTransactionForm } from "./transaction-cash-form";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/format-client";
import { toast } from "sonner";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getTodayLocalAsUTC,
} from "@/lib/utils/datetime";
import type { DateRange } from "react-day-picker";
import type { TransactionHistory } from "@/lib/services/finance.service";
import type { TransactionWithDetails } from "@/lib/services/transaction.service";
import { getTransactionById } from "@/lib/actions/transaction.actions";
import { getTransactionHistory, getTransactionHistoryWithFilters } from "@/lib/actions/finance.actions";
import { BalanceSaldoTable } from "./transaction-saldo-card";
import { TransactionHistoryTable } from "./transaction-history-table";
import { DatePicker } from "@/components/reusable/date-picker";

type ManagementDanaTabProps = {
  gasStationId: string;
  active?: boolean;
};

type RawTransaction = {
  id: string;
  description: string;
  date: Date;
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
};

export function ManagementDanaTab({
  gasStationId,
  active = true,
}: ManagementDanaTabProps) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [rawTransactions, setRawTransactions] = useState<RawTransaction[]>([]);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const todayLocalUTC = getTodayLocalAsUTC();
    return {
      from: startOfDayUTC(addDaysUTC(todayLocalUTC, -6)),
      to: endOfDayUTC(todayLocalUTC),
    };
  });
  const fetchedGasStationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      active &&
      gasStationId &&
      fetchedGasStationIdRef.current !== gasStationId
    ) {
      fetchedGasStationIdRef.current = gasStationId;
      fetchData();
    }
  }, [active, gasStationId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch raw transactions untuk approval status mapping
      const rawResult = await getTransactionHistoryWithFilters(gasStationId);
      if (rawResult.success && rawResult.data) {
        setRawTransactions(rawResult.data as RawTransaction[]);
      }

      // Fetch transaction history dalam format TransactionHistory[]
      const transactionsResult = await getTransactionHistory(gasStationId);

      if (transactionsResult.success && transactionsResult.data) {
        // Filter: Exclude deposit dan purchase BBM
        const filteredTransactions = (
          transactionsResult.data as TransactionHistory[]
        ).filter(
          (tx) =>
            tx.source !== "DEPOSIT" &&
            tx.transactionType !== "PURCHASE_BBM"
        );
        
        const sortedTransactions = filteredTransactions.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setTransactions(sortedTransactions);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

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

  // Create approval status map from rawTransactions
  const approvalStatusMap = useMemo(() => {
    const map = new Map<
      string,
      { createdByName?: string; approverName?: string }
    >();

    rawTransactions.forEach((tx) => {
      const createdByName = tx.createdBy.profile?.name || tx.createdBy.username;
      const approverName =
        tx.approver?.profile?.name || tx.approver?.username || undefined;

      map.set(tx.id, {
        createdByName,
        approverName,
      });
    });

    return map;
  }, [rawTransactions]);

  const extractTransactionId = (historyId: string): string | null => {
    // Jika id mengandung "-income-" atau "-expense-", extract transaction id
    if (historyId.includes("-income-") || historyId.includes("-expense-")) {
      return historyId.split("-")[0];
    }
    // Jika id adalah deposit detail id, return null (akan handle khusus)
    return null;
  };

  const handleViewDetail = async (transaction: TransactionHistory) => {
    setLoadingDetail(true);
    try {
      // Extract transaction ID dari history ID
      const transactionId = extractTransactionId(transaction.id);

      if (!transactionId) {
        // Jika ini deposit detail, kita tidak bisa fetch transaction detail
        // Tampilkan info sederhana saja
        toast.error("Detail transaksi tidak tersedia untuk deposit");
        setSelectedTransaction(null);
        return;
      }

      const result = await getTransactionById(transactionId);

      if (result.success && result.data) {
        setSelectedTransaction(result.data);
      } else {
        toast.error(result.message || "Gagal memuat detail transaksi");
      }
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
      toast.error("Gagal memuat detail transaksi");
    } finally {
      setLoadingDetail(false);
    }
  };

  const getTransactionAmount = (
    transaction: TransactionWithDetails | null
  ): number => {
    if (!transaction) return 0;

    const cashBankEntries = transaction.journalEntries.filter(
      (entry) =>
        entry.coa.category === "ASSET" &&
        (entry.coa.name === "Kas" || entry.coa.name.startsWith("Bank"))
    );

    if (cashBankEntries.length === 0) return 0;

    const entry = cashBankEntries[0];
    return entry.debit > 0 ? entry.debit : entry.credit;
  };

  return (
    <>
      <div>
        {loading && !transactions.length ? (
          <div className="text-center py-4 lg:py-8 text-xs lg:text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="space-y-3 lg:space-y-6">
            {/* Balance Summary */}
            <BalanceSaldoTable
              gasStationId={gasStationId}
              dateRange={dateRange}
              onOpenTransactionForm={() => setTransactionFormOpen(true)}
            />

            {/* Transaction History */}
            <div>
              <div className="flex items-center justify-between mb-1.5 lg:mb-3">
                <h3 className="text-xs lg:text-sm font-semibold">
                  Riwayat Transaksi
                </h3>
                <DatePicker
                  date={dateRange}
                  onSelect={(range) => range && setDateRange(range)}
                  size="sm"
                />
              </div>
              <TransactionHistoryTable
                transactions={transactions}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onViewDetail={handleViewDetail}
                loadingDetail={loadingDetail}
                extractTransactionId={extractTransactionId}
                showApprovalStatus={true}
                approvalStatusMap={approvalStatusMap}
                hideActionColumn={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Dialog */}
      {selectedTransaction && (
        <Dialog
          open={!!selectedTransaction}
          onOpenChange={(open) => {
            if (!open) setSelectedTransaction(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dibuat Oleh:</span>
                    <span className="font-semibold">
                      {selectedTransaction.createdBy?.profile?.name ||
                        selectedTransaction.createdBy?.username ||
                        "-"}
                    </span>
                  </div>
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

                {/* Amount Summary */}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 lg:p-3">
                  <div className="flex justify-between text-xs lg:text-sm py-1">
                    <span>Jumlah:</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(
                        getTransactionAmount(selectedTransaction)
                      )}
                    </span>
                  </div>
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

      {/* Transaction Form Sheet - Finance hanya CASH */}
      <CashTransactionForm
        open={transactionFormOpen}
        onOpenChange={(open) => {
          setTransactionFormOpen(open);
          if (!open) fetchData();
        }}
        gasStationId={gasStationId}
        onSuccess={fetchData}
      />
    </>
  );
}
