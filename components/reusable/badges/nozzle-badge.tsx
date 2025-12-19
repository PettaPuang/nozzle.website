import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProductColor } from "@/lib/utils/product-colors";

type NozzleBadgeProps = {
  code: string;
  productName?: string; // Optional: untuk menampilkan warna sesuai product
  className?: string;
  variant?: "default" | "outline" | "secondary";
};

export function NozzleBadge({
  code,
  productName,
  className,
  variant = "secondary",
}: NozzleBadgeProps) {
  // Jika ada productName, gunakan warna product
  if (productName) {
    const colorScheme = getProductColor(productName);

    return (
      <Badge
        className={cn(
          "border",
          className
        )}
        style={{
          backgroundColor: colorScheme.hex.bg,
          color: colorScheme.hex.text,
          borderColor: colorScheme.hex.text,
        }}
      >
        {code}
      </Badge>
    );
  }

  // Jika tidak ada productName, gunakan variant biasa
  return (
    <Badge
      variant={variant}
      className={cn(className)}
    >
      {code}
    </Badge>
  );
}
