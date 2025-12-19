/**
 * Reusable Badge Components
 * 
 * Komponen badge yang konsisten dan reusable untuk berbagai tipe data.
 * Semua badge menggunakan konfigurasi warna dan label yang seragam.
 */

export { ShiftBadge, getShiftLabel, getShiftColor } from "./shift-badge";
export { StatusBadge, getStatusLabel, getStatusVariant } from "./status-badge";
export {
  PaymentMethodBadge,
  getPaymentMethodLabel,
  getPaymentMethodColor,
} from "./payment-method-badge";
export { ProductBadge, getProductColorScheme } from "./product-badge";
export { NozzleBadge } from "./nozzle-badge";
export { TankBadge } from "./tank-badge";
export { 
  TransactionTypeBadge,
  getTransactionTypeLabel,
  getTransactionTypeColor,
} from "./transaction-type-badge";
export {
  COACategoryBadge,
  getCOACategoryLabel,
  getCOACategoryColor,
} from "./coa-category-badge";
export {
  OperationalTransactionTypeBadge,
  getOperationalTransactionTypeLabel,
  getOperationalTransactionTypeColor,
} from "./operational-transaction-type-badge";
export { RoleBadge, getRoleColorScheme } from "./role-badge";

