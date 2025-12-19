"use client";

import { ShiftVerificationTable } from "./shift-verification-table";
import { ShiftHistoryTable } from "./shift-history-table";

type ShiftOperatorTabProps = {
  gasStationId: string;
  active?: boolean;
  onVerified?: (shiftId: string) => void;
};

export function ShiftOperatorTab({
  gasStationId,
  active = true,
  onVerified,
}: ShiftOperatorTabProps) {
  const handleVerified = (shiftId: string) => {
    onVerified?.(shiftId);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h3 className="text-xs lg:text-sm font-semibold mb-1.5 lg:mb-3">
          Verifikasi Totalisator
        </h3>
        <ShiftVerificationTable
          gasStationId={gasStationId}
          onVerified={handleVerified}
        />
      </div>

      <div>
        <h3 className="text-xs lg:text-sm font-semibold mb-1.5 lg:mb-3">
          History Shift
        </h3>
        <ShiftHistoryTable gasStationId={gasStationId} active={active} />
      </div>
    </div>
  );
}

