import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from "lucide-react";

type TransactionType = "IN" | "OUT" | "TRANSFER";

type TransactionTypeBadgeProps = {
  type: TransactionType;
  className?: string;
  showIcon?: boolean;
};

const transactionConfig = {
  IN: {
    label: "Masuk",
    variant: "default" as const,
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    icon: ArrowUpCircle,
  },
  OUT: {
    label: "Keluar",
    variant: "destructive" as const,
    className: "bg-red-100 text-red-800 hover:bg-red-100",
    icon: ArrowDownCircle,
  },
  TRANSFER: {
    label: "Antar Kas",
    variant: "secondary" as const,
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    icon: ArrowLeftRight,
  },
} as const;

export function TransactionTypeBadge({
  type,
  className,
  showIcon = false,
}: TransactionTypeBadgeProps) {
  const config = transactionConfig[type];
  const Icon = config.icon;

  return (
    <Badge className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export function getTransactionTypeLabel(type: string): string {
  return transactionConfig[type as TransactionType]?.label || type;
}

export function getTransactionTypeColor(type: string): string {
  return transactionConfig[type as TransactionType]?.className || "";
}
