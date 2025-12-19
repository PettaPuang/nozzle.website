"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";
import { id as localeId } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils/format-client";
import type { TransactionHistory } from "@/lib/services/finance.service";
import {
  StatusBadge,
  TransactionTypeBadge,
  PaymentMethodBadge,
} from "@/components/reusable/badges";
import type { DateRange } from "react-day-picker";

type TransactionHistoryTableProps = {
  transactions: TransactionHistory[];
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
  onViewDetail: (transaction: TransactionHistory) => void;
  loadingDetail?: boolean;
  extractTransactionId: (historyId: string) => string | null;
  showApprovalStatus?: boolean; // Tampilkan kolom Dibuat Oleh dan Diapprove Oleh
  approvalStatusMap?: Map<
    string,
    { createdByName?: string; approverName?: string }
  >; // Mapping transaction ID ke approval status
  hideActionColumn?: boolean; // Jika true, hide kolom action dan buat row clickable
};

export function TransactionHistoryTable({
  transactions,
  dateRange,
  onDateRangeChange,
  onViewDetail,
  loadingDetail = false,
  extractTransactionId,
  showApprovalStatus = false,
  approvalStatusMap,
  hideActionColumn = false,
}: TransactionHistoryTableProps) {
  const filteredTransactions = useMemo(() => {
    // Filter: exclude deposit dan purchase BBM
    let filtered = transactions.filter(
      (transaction) =>
        transaction.source !== "DEPOSIT" &&
        transaction.transactionType !== "PURCHASE_BBM"
    );

    // Filter berdasarkan date range jika ada
    if (dateRange.from && dateRange.to) {
      const startDate = startOfDayUTC(dateRange.from);
      const endDate = endOfDayUTC(dateRange.to);

      filtered = filtered.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    return filtered;
  }, [transactions, dateRange]);

  return (
    <div>
      {filteredTransactions.length > 0 ? (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-muted text-xs lg:text-sm w-[120px] lg:w-[140px] min-w-[120px] lg:min-w-[140px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                  Tanggal
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[80px] lg:w-[100px] min-w-[80px] lg:min-w-[100px]">
                  Jenis
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[80px] lg:w-[100px] min-w-[80px] lg:min-w-[100px]">
                  Sumber
                </TableHead>
                <TableHead className="text-xs lg:text-sm">Deskripsi</TableHead>
                <TableHead className="text-right text-xs lg:text-sm w-[120px] lg:w-[140px] min-w-[120px] lg:min-w-[140px]">
                  Jumlah
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                  Status
                </TableHead>
                {showApprovalStatus && (
                  <TableHead className="text-xs lg:text-sm w-[140px] lg:w-[180px] min-w-[140px] lg:min-w-[180px]">
                    Dibuat / Diapprove
                    </TableHead>
                )}
                {!hideActionColumn && (
                  <TableHead className="w-[60px] lg:w-[80px] min-w-[60px] lg:min-w-[80px]">
                    Aksi
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow 
                  key={transaction.id}
                  className={hideActionColumn ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={hideActionColumn ? () => onViewDetail(transaction) : undefined}
                >
                  <TableCell className="sticky left-0 z-10 bg-background text-xs lg:text-sm border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                      <span>
                        {format(new Date(transaction.date), "dd MMM yyyy", {
                          locale: localeId,
                        })}
                      </span>
                      <span className="text-[10px] lg:text-xs text-muted-foreground">
                        {format(new Date(transaction.date), "HH:mm", {
                          locale: localeId,
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    <TransactionTypeBadge type={transaction.type} />
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    <PaymentMethodBadge
                      account={(transaction.paymentMethod || "CASH") as "CASH" | "BANK"}
                      className="text-[10px] lg:text-xs"
                    />
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    {transaction.description}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs lg:text-sm font-semibold font-mono ${
                      transaction.type === "IN"
                        ? "text-green-600"
                        : transaction.type === "OUT"
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    {transaction.type === "IN"
                      ? "+"
                      : transaction.type === "OUT"
                      ? "-"
                      : "±"}
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-xs lg:text-sm">
                    <StatusBadge status={transaction.status} />
                  </TableCell>
                  {showApprovalStatus &&
                    (() => {
                      const transactionId = extractTransactionId(
                        transaction.id
                      );
                      const approvalStatus = transactionId
                        ? approvalStatusMap?.get(transactionId)
                        : undefined;
                      return (
                          <TableCell className="text-xs lg:text-sm">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 text-[10px] lg:text-xs">Dibuat:</span>
                              <span className="font-medium text-[10px] lg:text-xs">
                            {approvalStatus?.createdByName || "-"}
                              </span>
                            </div>
                            {approvalStatus?.approverName && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600 text-[10px] lg:text-xs">Approve:</span>
                                <span className="font-medium text-[10px] lg:text-xs">
                                  {approvalStatus.approverName}
                                </span>
                              </div>
                            )}
                          </div>
                          </TableCell>
                      );
                    })()}
                  {!hideActionColumn && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 lg:h-8 lg:w-8 p-0"
                        onClick={() => onViewDetail(transaction)}
                        disabled={
                          loadingDetail || !extractTransactionId(transaction.id)
                        }
                      >
                        <Eye className="h-3 w-3 lg:h-4 lg:w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border p-3 lg:p-6 text-center">
          <p className="text-xs lg:text-sm text-muted-foreground">
            Belum ada riwayat transaksi
          </p>
        </div>
      )}
    </div>
  );
}
