import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProductColor } from "@/lib/utils/product-colors";

type TankBadgeProps = {
  tankCode: string;
  productName: string;
  className?: string;
};

export function TankBadge({
  tankCode,
  productName,
  className,
}: TankBadgeProps) {
  const colorScheme = getProductColor(productName);

  return (
    <Badge
      className={cn("border font-medium", className)}
      style={{
        backgroundColor: colorScheme.hex.bg,
        color: colorScheme.hex.text,
        borderColor: colorScheme.hex.text,
      }}
    >
      {tankCode}
    </Badge>
  );
}
