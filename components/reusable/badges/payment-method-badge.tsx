import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PaymentAccount = "CASH" | "BANK";
type PaymentMethod =
  | "QRIS"
  | "TRANSFER"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "MY_PERTAMINA"
  | "COUPON"
  | "ETC";

type PaymentMethodBadgeProps = {
  account?: PaymentAccount | string;
  method?: PaymentMethod | string;
  // Backward compatibility: jika hanya method (string lama)
  methodOld?: string;
  className?: string;
  showLabel?: boolean;
};

const paymentAccountConfig = {
  CASH: {
    label: "Cash",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  BANK: {
    label: "Bank",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
} as const;

const paymentMethodConfig = {
  QRIS: {
    label: "QRIS",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  TRANSFER: {
    label: "Transfer",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
  DEBIT_CARD: {
    label: "Debit Card",
    className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  },
  CREDIT_CARD: {
    label: "Credit Card",
    className: "bg-pink-100 text-pink-800 hover:bg-pink-100",
  },
  MY_PERTAMINA: {
    label: "My Pertamina",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  COUPON: {
    label: "Coupon (Tip)",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  ETC: {
    label: "Lainnya",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
} as const;

// Legacy config untuk backward compatibility
const legacyPaymentMethodConfig = {
  CASH: paymentAccountConfig.CASH,
  QRIS: paymentMethodConfig.QRIS,
  TRANSFER: paymentMethodConfig.TRANSFER,
  DEBIT_CARD: paymentMethodConfig.DEBIT_CARD,
  CREDIT_CARD: paymentMethodConfig.CREDIT_CARD,
  MY_PERTAMINA: paymentMethodConfig.MY_PERTAMINA,
  COUPON: paymentMethodConfig.COUPON,
  ETC: paymentMethodConfig.ETC,
} as const;

export function PaymentMethodBadge({
  account,
  method,
  methodOld, // Backward compatibility
  className,
  showLabel = true,
}: PaymentMethodBadgeProps) {
  // Jika menggunakan methodOld (backward compatibility)
  if (methodOld) {
    const config =
      legacyPaymentMethodConfig[
        methodOld as keyof typeof legacyPaymentMethodConfig
      ] || legacyPaymentMethodConfig.ETC;
    return (
      <Badge className={cn(config.className, className)}>
        {showLabel ? config.label : methodOld}
      </Badge>
    );
  }

  // Jika ada account, tampilkan account + method (jika ada)
  if (account) {
    const accountConfig =
      paymentAccountConfig[account as PaymentAccount] ||
      paymentAccountConfig.CASH;
    if (method && method !== account) {
      const methodConfig =
        paymentMethodConfig[method as PaymentMethod] || paymentMethodConfig.ETC;
      return (
        <div className="flex gap-1">
          <Badge className={cn(accountConfig.className, className)}>
            {accountConfig.label}
          </Badge>
          <Badge className={cn(methodConfig.className, className)}>
            {showLabel ? methodConfig.label : method}
          </Badge>
        </div>
      );
    }
    return (
      <Badge className={cn(accountConfig.className, className)}>
        {showLabel ? accountConfig.label : account}
      </Badge>
    );
  }

  // Jika hanya method (tanpa account)
  if (method) {
    const config =
      paymentMethodConfig[method as PaymentMethod] || paymentMethodConfig.ETC;
    return (
      <Badge className={cn(config.className, className)}>
        {showLabel ? config.label : method}
      </Badge>
    );
  }

  return null;
}

export function getPaymentMethodLabel(method: string): string {
  // Check legacy first
  if (
    legacyPaymentMethodConfig[method as keyof typeof legacyPaymentMethodConfig]
  ) {
    return legacyPaymentMethodConfig[
      method as keyof typeof legacyPaymentMethodConfig
    ].label;
  }
  // Check payment method
  if (paymentMethodConfig[method as PaymentMethod]) {
    return paymentMethodConfig[method as PaymentMethod].label;
  }
  // Check payment account
  if (paymentAccountConfig[method as PaymentAccount]) {
    return paymentAccountConfig[method as PaymentAccount].label;
  }
  return method;
}

export function getPaymentMethodColor(method: string): string {
  // Check legacy first
  if (
    legacyPaymentMethodConfig[method as keyof typeof legacyPaymentMethodConfig]
  ) {
    return legacyPaymentMethodConfig[
      method as keyof typeof legacyPaymentMethodConfig
    ].className;
  }
  // Check payment method
  if (paymentMethodConfig[method as PaymentMethod]) {
    return paymentMethodConfig[method as PaymentMethod].className;
  }
  // Check payment account
  if (paymentAccountConfig[method as PaymentAccount]) {
    return paymentAccountConfig[method as PaymentAccount].className;
  }
  return "";
}
