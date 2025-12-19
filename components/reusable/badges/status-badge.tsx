import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "PENDING"
  | "REJECTED"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED"
  | "ACTIVE"
  | "INACTIVE"
  | "STARTED";

type StatusBadgeProps = {
  status: StatusType | string;
  className?: string;
  showLabel?: boolean;
};

const statusConfig = {
  PENDING: {
    label: "Pending",
    bg: "#F59E0B",
    text: "#FFFFFF",
  },
  APPROVED: {
    label: "Approved",
    bg: "#10B981",
    text: "#FFFFFF",
  },
  COMPLETED: {
    label: "Completed",
    bg: "#06B6D4",
    text: "#FFFFFF",
  },
  REJECTED: {
    label: "Rejected",
    bg: "#EF4444",
    text: "#FFFFFF",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "#6B7280",
    text: "#FFFFFF",
  },
  ACTIVE: {
    label: "Active",
    bg: "#10B981",
    text: "#FFFFFF",
  },
  INACTIVE: {
    label: "Inactive",
    bg: "#D1D5DB",
    text: "#374151",
  },
  STARTED: {
    label: "Started",
    bg: "#3B82F6",
    text: "#FFFFFF",
  },
} as const;

export function StatusBadge({
  status,
  className,
  showLabel = true,
}: StatusBadgeProps) {
  const config =
    statusConfig[status as StatusType] || statusConfig.PENDING;

  return (
    <Badge 
      className={cn("border", className)}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {showLabel ? config.label : status}
    </Badge>
  );
}

export function getStatusLabel(status: string): string {
  return statusConfig[status as StatusType]?.label || status;
}

export function getStatusVariant(status: string) {
  const config = statusConfig[status as StatusType] || statusConfig.PENDING;
  return { bg: config.bg, text: config.text };
}

