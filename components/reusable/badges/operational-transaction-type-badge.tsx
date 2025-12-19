import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Droplets,
  Gauge,
  TrendingUp,
  Package,
  Wallet,
  RefreshCw,
  ShoppingCart,
  DollarSign,
} from "lucide-react";

type OperationalTransactionType =
  | "UNLOAD"
  | "TANK_READING"
  | "REVENUE"
  | "COGS"
  | "DEPOSIT"
  | "ADJUSTMENT"
  | "PURCHASE_BBM"
  | "CASH";

type OperationalTransactionTypeBadgeProps = {
  type: string; // Accept string to handle enum from Prisma
  className?: string;
  showIcon?: boolean;
};

const transactionTypeConfig: Record<
  OperationalTransactionType,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  UNLOAD: {
    label: "Unload",
    variant: "default",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    icon: Droplets,
  },
  TANK_READING: {
    label: "Tank Reading",
    variant: "secondary",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    icon: Gauge,
  },
  REVENUE: {
    label: "Pendapatan",
    variant: "default",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    icon: TrendingUp,
  },
  COGS: {
    label: "HPP",
    variant: "outline",
    className:
      "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-50",
    icon: Package,
  },
  DEPOSIT: {
    label: "Deposit",
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    icon: Wallet,
  },
  ADJUSTMENT: {
    label: "Adjustment",
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    icon: RefreshCw,
  },
  PURCHASE_BBM: {
    label: "Pembelian BBM",
    variant: "outline",
    className:
      "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-50",
    icon: ShoppingCart,
  },
  CASH: {
    label: "Kas",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
    icon: DollarSign,
  },
};

export function OperationalTransactionTypeBadge({
  type,
  className,
  showIcon = false,
}: OperationalTransactionTypeBadgeProps) {
  const config = transactionTypeConfig[type as OperationalTransactionType];

  if (!config) {
    // Fallback untuk type yang tidak dikenal
    return (
      <Badge variant="outline" className={className}>
        {type}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export function getOperationalTransactionTypeLabel(type: string): string {
  return (
    transactionTypeConfig[type as OperationalTransactionType]?.label || type
  );
}

export function getOperationalTransactionTypeColor(type: string): string {
  return (
    transactionTypeConfig[type as OperationalTransactionType]?.className || ""
  );
}
