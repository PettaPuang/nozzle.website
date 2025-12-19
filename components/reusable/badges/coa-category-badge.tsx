import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type COACategoryType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "COGS";

type COACategoryBadgeProps = {
  category: string;
  className?: string;
};

const categoryConfig = {
  ASSET: {
    label: "Aset",
    className:
      "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100",
  },
  LIABILITY: {
    label: "Kewajiban",
    className: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
  },
  EQUITY: {
    label: "Ekuitas",
    className:
      "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
  },
  REVENUE: {
    label: "Pendapatan",
    className:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
  },
  EXPENSE: {
    label: "Beban",
    className:
      "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100",
  },
  COGS: {
    label: "HPP",
    className:
      "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100",
  },
} as const;

export function COACategoryBadge({
  category,
  className,
}: COACategoryBadgeProps) {
  const config =
    categoryConfig[category as COACategoryType] || categoryConfig.ASSET;

  return (
    <Badge variant="coa" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}

export function getCOACategoryLabel(category: string): string {
  return categoryConfig[category as COACategoryType]?.label || category;
}

export function getCOACategoryColor(category: string): string {
  return categoryConfig[category as COACategoryType]?.className || "";
}
