import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ShiftType = "MORNING" | "AFTERNOON" | "NIGHT";

type ShiftBadgeProps = {
  shift: ShiftType | string;
  className?: string;
  showLabel?: boolean;
};

const shiftConfig = {
  MORNING: {
    label: "Shift 1",
    bg: "#FCD34D",
    text: "#FFFFFF",
  },
  AFTERNOON: {
    label: "Shift 2",
    bg: "#FB923C",
    text: "#FFFFFF",
  },
  NIGHT: {
    label: "Shift 3",
    bg: "#3B82F6",
    text: "#FFFFFF",
  },
} as const;

export function ShiftBadge({
  shift,
  className,
  showLabel = true,
}: ShiftBadgeProps) {
  const config =
    shiftConfig[shift as ShiftType] || shiftConfig.MORNING;

  return (
    <Badge 
      className={cn("border", className)}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {showLabel ? config.label : shift}
    </Badge>
  );
}

export function getShiftLabel(shift: string): string {
  return shiftConfig[shift as ShiftType]?.label || shift;
}

export function getShiftColor(shift: string): { bg: string; text: string } {
  const config = shiftConfig[shift as ShiftType] || shiftConfig.MORNING;
  return { bg: config.bg, text: config.text };
}

