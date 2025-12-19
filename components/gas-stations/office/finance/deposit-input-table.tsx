"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils/format-client";
import type { DepositWithDetails } from "@/lib/services/finance.service";
import { ShiftBadge, StatusBadge } from "@/components/reusable/badges";
import { checkShiftCanHaveDeposit } from "@/lib/actions/operator.actions";
import { toast } from "sonner";

type DepositInputTableProps = {
  deposits: DepositWithDetails[];
  onInputDeposit: (shiftId: string) => void;
  userRole?: string;
};

export function DepositInputTable({
  deposits,
  onInputDeposit,
  userRole,
}: DepositInputTableProps) {
  const handleInputDepositClick = async (shiftId: string) => {
    // Validasi sequential sebelum membuka form
    const checkResult = await checkShiftCanHaveDeposit(shiftId);
    if (!checkResult.success) {
      toast.error(checkResult.message || "Tidak bisa input deposit shift ini");
      return;
    }

    onInputDeposit(shiftId);
  };
  if (deposits.length === 0) {
    return (
      <div className="rounded-lg border p-3 lg:p-6 text-center">
        <p className="text-xs lg:text-sm text-muted-foreground">
          Tidak ada shift yang perlu input deposit
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                Tanggal
              </TableHead>
              <TableHead className="w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                Station
              </TableHead>
              <TableHead className="w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                Shift
              </TableHead>
              <TableHead className="w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                Operator
              </TableHead>
              <TableHead className="text-right w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                Sales
              </TableHead>
              <TableHead className="w-[60px] lg:w-[80px] min-w-[60px] lg:min-w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deposits.map((deposit) => (
              <TableRow key={deposit.operatorShiftId}>
                <TableCell className="text-xs lg:text-sm w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                  {format(
                    new Date(deposit.operatorShift.date),
                    "dd MMM yyyy",
                    { locale: localeId }
                  )}
                </TableCell>
                <TableCell className="w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                  <span className="text-xs lg:text-sm">
                    {deposit.operatorShift.station.name}
                  </span>
                </TableCell>
                <TableCell className="w-[90px] lg:w-[110px] min-w-[90px] lg:min-w-[110px]">
                  <div className="flex flex-col gap-0.5">
                    <ShiftBadge shift={deposit.operatorShift.shift} />
                    <div className="text-[10px] lg:text-xs text-muted-foreground whitespace-nowrap">
                      {deposit.operatorShift.startTime
                        ? format(
                            new Date(deposit.operatorShift.startTime),
                            "HH:mm"
                          )
                        : "-"}{" "}
                      -{" "}
                      {deposit.operatorShift.endTime
                        ? format(
                            new Date(deposit.operatorShift.endTime),
                            "HH:mm"
                          )
                        : "-"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs lg:text-sm w-[120px] lg:w-[150px] min-w-[120px] lg:min-w-[150px]">
                  {deposit.operatorShift.operator.profile?.name ||
                    deposit.operatorShift.operator.username}
                </TableCell>
                <TableCell className="text-right font-mono w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px]">
                  {formatCurrency(deposit.totalAmount)}
                </TableCell>
                <TableCell className="text-center w-[60px] lg:w-[80px] min-w-[60px] lg:min-w-[80px]">
                  {deposit.hasDeposit && deposit.status === "PENDING" ? (
                    // Jika sudah ada deposit dengan status PENDING, tampilkan status badge
                    <StatusBadge status={deposit.status} />
                  ) : (
                    // Jika belum ada deposit atau status REJECTED, tampilkan button Input
                    <Button
                      size="sm"
                      onClick={() => handleInputDepositClick(deposit.operatorShiftId)}
                      className="h-6 lg:h-7 px-2 text-xs lg:text-sm"
                    >
                      Input
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

