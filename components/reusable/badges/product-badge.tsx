import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRODUCT_COLORS, type ProductColorScheme } from "@/lib/utils/product-colors";

type ProductBadgeProps = {
  productName: string;
  label?: string; // Optional custom label instead of product name
  ron?: string | null; // RON value to display
  showRON?: boolean; // Whether to show RON value
  className?: string;
};

export function ProductBadge({
  productName,
  label,
  ron,
  showRON = false,
  className,
}: ProductBadgeProps) {
  const normalizedName = productName.toLowerCase().trim();
  const colorScheme = PRODUCT_COLORS[normalizedName] || PRODUCT_COLORS.default;

  const displayText = label || productName;
  const finalText = showRON && ron ? `${displayText} (${ron})` : displayText;

  return (
    <Badge
      className={cn(
        "border font-medium",
        className
      )}
      style={{
        backgroundColor: colorScheme.hex.bg,
        color: colorScheme.hex.text,
        borderColor: colorScheme.hex.text,
      }}
    >
      {finalText}
    </Badge>
  );
}

export function getProductColorScheme(productName: string): ProductColorScheme {
  const normalizedName = productName.toLowerCase().trim();
  return PRODUCT_COLORS[normalizedName] || PRODUCT_COLORS.default;
}

