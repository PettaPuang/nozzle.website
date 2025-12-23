Yang diperlukan (minimal):
UI components untuk OWNER:
Welcome page (list gas stations)
Gas Station detail page
Report tabs (Operational & Financial)
Tank/Station view (read-only)
Mock data structure:
Gas Station info
Products
Tanks & Stations
Report data (sales, stock, financial)
Auth minimal:
Login page (untuk demo experience)
Mock session (OWNER role)
Daftar eliminasi besar
A. Database & Prisma (bisa dihapus atau disederhanakan)
Models yang bisa dihapus:
❌ SubscriptionPlan❌ PromoCode ❌ SubscriptionConfig❌ Notification (jika tidak diperlukan)❌ OperatorShift (tidak diperlukan untuk OWNER view)❌ NozzleReading (tidak diperlukan untuk OWNER view)❌ TankReading (tidak diperlukan untuk OWNER view)❌ Deposit & DepositDetail (tidak diperlukan untuk OWNER view)❌ Unload (tidak diperlukan untuk OWNER view)❌ Transaction & JournalEntry (bisa disederhanakan)❌ COA (Chart of Accounts - tidak diperlukan untuk OWNER view)❌ UserGasStation (assignment - tidak diperlukan)❌ TankStation (junction - bisa disederhanakan)
Models yang tetap diperlukan (minimal):
✅ User (untuk auth demo)✅ Profile (untuk user info)✅ GasStation (basic info)✅ Product (produk BBM)✅ Tank (untuk stock report)✅ Station (untuk station view)✅ Nozzle (untuk sales report)
Fields yang bisa dihapus dari GasStation:
❌ subscriptionType, subscriptionStartDate, subscriptionEndDate, isTrial❌ paymentGateway, paymentSubscriptionId, paymentMethodToken, isAutoRenew❌ managerCanPurchase, financeCanPurchase (tidak diperlukan untuk OWNER)❌ hasTitipan, titipanNames (tidak diperlukan untuk OWNER)
B. Services (bisa dihapus)
Services untuk DELETE:
❌ lib/services/finance.service.ts❌ lib/services/cash-transaction.service.ts❌ lib/services/admin-transaction.service.ts❌ lib/services/operator.service.ts❌ lib/services/unload.service.ts❌ lib/services/tank-reading.service.ts❌ lib/services/tank-history.service.ts❌ lib/services/titipan.service.ts❌ lib/services/transaction.service.ts❌ lib/services/coa.service.ts❌ lib/services/purchase.service.ts❌ lib/services/deposit.service.ts❌ lib/services/notification.service.ts❌ lib/services/user.service.ts (jika tidak diperlukan)
Services untuk KEEP (disederhanakan dengan mock data):
✅ lib/services/gas-station.service.ts (simplified - hanya read)✅ lib/services/product.service.ts (simplified - hanya read)✅ lib/services/operational.service.ts (untuk tank/station data)✅ lib/services/owner-report.service.ts (bisa pakai mock data)✅ lib/services/operational-report.service.ts (mock data)✅ lib/services/financial-report.service.ts (mock data)✅ lib/services/income-report.service.ts (mock data)✅ lib/services/report-sales.service.ts (mock data)✅ lib/services/report-stock.service.ts (mock data)✅ lib/services/report-saleschart.service.ts (mock data)
C. Actions (bisa dihapus)
Actions untuk DELETE:
❌ lib/actions/deposit.actions.ts❌ lib/actions/finance.actions.ts❌ lib/actions/cash-transaction.actions.ts❌ lib/actions/admin-transaction.actions.ts❌ lib/actions/operator-shift.actions.ts❌ lib/actions/nozzle-reading.actions.ts❌ lib/actions/tank-reading.actions.ts❌ lib/actions/unload.actions.ts❌ lib/actions/titipan.actions.ts❌ lib/actions/transaction.actions.ts❌ lib/actions/coa.actions.ts❌ lib/actions/purchase.actions.ts❌ lib/actions/expense.actions.ts❌ lib/actions/closing.actions.ts❌ lib/actions/migration.actions.ts❌ lib/actions/rollback/_ (semua)❌ lib/actions/notification.actions.ts❌ lib/actions/user.actions.ts (jika tidak diperlukan)
Actions untuk KEEP (minimal):
✅ lib/actions/auth.actions.ts (untuk login demo)✅ lib/actions/gas-station.actions.ts (simplified - hanya read)✅ lib/actions/product.actions.ts (simplified - hanya read)
D. API Routes (bisa dihapus)
API Routes untuk DELETE:
❌ app/api/admin/_ (semua)❌ app/api/cron/_ (semua)❌ app/api/webhooks/_ (semua)❌ app/api/upload/_ (jika tidak diperlukan)❌ app/api/ownergroup/_ (jika tidak diperlukan)
API Routes untuk KEEP (disederhanakan dengan mock data):
✅ app/api/reports/owner (mock data)✅ app/api/reports/income (mock data)✅ app/api/reports/financial (mock data)✅ app/api/reports/stock (mock data)✅ app/api/reports/sales-chart (mock data)✅ app/api/reports/products (mock data)✅ app/api/reports/comprehensive (mock data)✅ app/api/reports/operational (mock data)
E. Components (bisa dihapus)
Components untuk DELETE:
❌ components/gas-stations/office/_ (semua management components)❌ components/gas-stations/station/_-form.tsx (semua forms)❌ components/gas-stations/tank/_-form.tsx (semua forms)❌ components/ownergroup/_ (jika tidak diperlukan)❌ components/developer/_ (sudah dihapus)❌ components/reusable/extension-request-form.tsx (sudah dihapus)❌ components/reusable/subscription-management-sheet.tsx (sudah dihapus)
Components untuk KEEP:
✅ components/welcome/spbu-list.tsx✅ components/welcome/spbu-card.tsx✅ components/welcome/owner-report-summary.tsx✅ components/gas-stations/report/_ (semua report components)✅ components/gas-stations/tank/tank-card.tsx✅ components/gas-stations/tank/tank-detail-sheet.tsx✅ components/gas-stations/tank/tanks-tab-content.tsx (simplified)✅ components/gas-stations/station/station-card.tsx✅ components/gas-stations/station/station-detail-sheet.tsx✅ components/gas-stations/station/stations-tab-content.tsx (simplified)✅ components/ui/_ (semua UI components)✅ components/reusable/_ (badges, date-picker, dll)
F. Utils & Validations (bisa dihapus)
Utils untuk DELETE:
❌ lib/utils/transaction/_ (semua transaction utils)❌ lib/utils/coa.utils.ts❌ lib/utils/export/_ (sudah dihapus)
Utils untuk KEEP:
✅ lib/utils/datetime.ts✅ lib/utils/format-client.ts✅ lib/utils/permissions.ts (simplified)✅ lib/utils/calculate-\* (jika diperlukan untuk report)
Pendekatan mock data
Opsi 1: Static JSON files (recommended)
/public/mock-data/ ├── gas-stations.json ├── products.json ├── tanks.json ├── stations.json ├── nozzles.json ├── reports/ │ ├── sales-report.json │ ├── stock-report.json │ ├── financial-report.json │ └── income-report.json
Opsi 2: Hardcoded di components
Data langsung di component
Simple tapi kurang maintainable
Opsi 3: Mock API dengan static data
API routes return mock data
Lebih realistis untuk demo
Rekomendasi implementasi
Phase 1: Cleanup schema
Hapus models subscription dari schema
Hapus subscription fields dari GasStation
Hapus relations subscription dari User
Simplify models (hapus yang tidak diperlukan)
Phase 2: Hapus backend yang tidak diperlukan
Hapus services yang tidak digunakan
Hapus actions yang tidak digunakan
Hapus API routes yang tidak digunakan
Simplify report services (pakai mock data)
Phase 3: Simplify components
Hapus management tab components
Hapus operational forms
Simplify tank/station components (view only)
Phase 4: Implement mock data
Buat mock data structure
Update report services untuk pakai mock data
Update API routes untuk return mock data
