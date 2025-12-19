"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Wallet, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format-client";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";
import type { DateRange } from "react-day-picker";
import { getPaymentMethodBalanceByDateRange } from "@/lib/actions/finance.actions";

type BalanceSaldoTableProps = {
  gasStationId: string;
  dateRange: DateRange;
  onOpenTransactionForm: () => void;
};

export function BalanceSaldoTable({
  gasStationId,
  dateRange,
  onOpenTransactionForm,
}: BalanceSaldoTableProps) {
  const [balance, setBalance] = useState<{
    cash: {
      saldoAwal: number;
      totalIn: number;
      totalOut: number;
      totalBalance: number;
    };
    bank: {
      saldoAwal: number;
      totalIn: number;
      totalOut: number;
      totalBalance: number;
    };
  }>({
    cash: {
      saldoAwal: 0,
      totalIn: 0,
      totalOut: 0,
      totalBalance: 0,
    },
    bank: {
      saldoAwal: 0,
      totalIn: 0,
      totalOut: 0,
      totalBalance: 0,
    },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!dateRange.from || !dateRange.to) return;

      setLoading(true);
      try {
        const result = await getPaymentMethodBalanceByDateRange(
          gasStationId,
          startOfDayUTC(dateRange.from),
          endOfDayUTC(dateRange.to)
        );

        if (result.success && result.data) {
          setBalance(result.data as typeof balance);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [gasStationId, dateRange]);

  // Helper component untuk card saldo
  const BalanceCard = ({
    title,
    amount,
    borderColor,
    bgColor,
    textColor,
    icon: Icon,
  }: {
    title: string;
    amount: number;
    borderColor: string;
    bgColor: string;
    textColor: string;
    icon: React.ElementType;
  }) => (
    <div className={`rounded-lg border-2 ${borderColor} p-2 lg:p-3 ${bgColor}`}>
      <div className="flex items-center justify-end gap-1 lg:gap-1.5 mb-1 lg:mb-2">
        <Icon className={`h-3 w-3 lg:h-4 lg:w-4 ${textColor}`} />
        <span className={`text-[10px] lg:text-xs font-semibold ${textColor}`}>
          {title}
        </span>
      </div>
      <div className="text-[10px] lg:text-lg font-bold font-mono text-right">
        {formatCurrency(amount)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 lg:mb-3">
        <h3 className="text-xs lg:text-sm font-semibold">Saldo Kas & Bank</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenTransactionForm}
          className="gap-1.5 lg:gap-2 text-xs lg:text-sm"
        >
          <FileText className="h-3 w-3 lg:h-4 lg:w-4" />
          Input Transaksi
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 lg:py-8">
          <Loader2 className="h-4 w-4 lg:h-6 lg:w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          {/* Saldo Kas */}
          <BalanceCard
            title="Saldo Kas"
            amount={balance.cash.totalBalance}
            borderColor="border-green-200"
            bgColor="bg-green-50/50"
            textColor="text-green-600"
            icon={Wallet}
          />

          {/* Saldo Bank */}
          <BalanceCard
            title="Saldo Bank"
            amount={balance.bank.totalBalance}
            borderColor="border-blue-200"
            bgColor="bg-blue-50/50"
            textColor="text-blue-600"
            icon={Wallet}
          />
        </div>
      )}
    </div>
  );
}
