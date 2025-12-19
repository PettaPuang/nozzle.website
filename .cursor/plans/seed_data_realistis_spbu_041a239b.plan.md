---
name: Seed data realistis SPBU
overview: Menambahkan seed Prisma yang membangun 3 SPBU lengkap dengan infrastruktur realistis (tank–station–nozzle) dan data operasional 15 Nov 2025–15 Jan 2026 (sales saja sebagai income), termasuk LO pembelian, unload, transfer kas, dan expense—semua konek dan konsisten secara stok & jurnal.
todos:
  - id: seed-infra-layout
    content: Tetapkan layout infrastruktur per SPBU (tanks, stations, nozzles) + konvensi kode/nama, dan implementasikan insert beserta relasi TankStation yang tepat.
    status: pending
  - id: seed-users-access
    content: Seed user OWNER, OWNER_GROUP (ownerId terisi), MANAGER, FINANCE, UNLOADER, dan beberapa OPERATOR per SPBU + UserGasStation assignment agar akses sesuai checkGasStationAccess.
    status: pending
    dependencies:
      - seed-infra-layout
  - id: seed-products-coa
    content: Seed produk per SPBU (termasuk Turbo di Makassar & Surabaya), buat COA standard + COA per produk via coa.utils, dan set avatar operator via URL placeholder.
    status: pending
    dependencies:
      - seed-users-access
  - id: seed-operational-sales
    content: Generate operator shifts + nozzle readings (OPEN/CLOSE) periode 15 Nov 2025–15 Jan 2026 dengan distribusi produk per kota dan totalizer cumulative.
    status: pending
    dependencies:
      - seed-products-coa
  - id: seed-deposits-and-transactions
    content: Buat Deposit/DepositDetail APPROVED per shift dan trigger pembentukan transaksi REVENUE/COGS menggunakan util deposit agar jurnal balance.
    status: pending
    dependencies:
      - seed-operational-sales
  - id: seed-purchase-lo-unload
    content: "Simulasikan kebutuhan stok: buat PURCHASE_BBM (LO) dan UNLOAD terhubung, lalu buat transaksi UNLOAD untuk inventory/LO/susut."
    status: pending
    dependencies:
      - seed-operational-sales
      - seed-products-coa
  - id: seed-cash-transfer-expense
    content: Tambahkan CASH transaction untuk TRANSFER dan EXPENSE (APPROVED), tanpa income manual, dengan COA yang relevan.
    status: pending
    dependencies:
      - seed-deposits-and-transactions
  - id: seed-tank-reading-variance
    content: Tambahkan tank reading periodik dengan variance kecil dan buat transaksi TANK_READING (profit/loss) agar laporan lebih realistis.
    status: pending
    dependencies:
      - seed-purchase-lo-unload
---

# Seed data realistis (15 Nov 2025–15 Jan 2026)

## Tujuan
- Menghasilkan seed data yang **realistis dan saling terkoneksi** sesuai schema di [`prisma/schema.prisma`](prisma/schema.prisma):
  - **Infrastruktur**: `GasStation` → `Product` → `Tank` ↔ `Station` (via `TankStation`) → `Nozzle`
  - **Operasional**: `OperatorShift` → `NozzleReading` → `Deposit`/`DepositDetail` → `Transaction`+`JournalEntry` (REVENUE/COGS otomatis)
  - **Pembelian/LO & stok**: `Transaction(PURCHASE_BBM)` → `Unload` → transaksi UNLOAD (inventory vs LO)
  - **Keuangan non-income**: `Transaction(CASH)` untuk **EXPENSE** dan **TRANSFER** (tanpa CASH INCOME)

## Keputusan yang sudah dikunci
- **Approval**: seluruh data operasional dibuat dalam kondisi **sudah APPROVED** (sesuai kebutuhan view owner).
- **Income**: tidak ada income manual; **income hanya dari sales** (REVENUE/COGS dari deposit).
- **Avatar operator**: `Profile.avatar` diisi **URL placeholder eksternal** (tanpa blob storage dan tanpa file baru di `public/`).
- **Harga Pertamax Turbo**: `sellingPrice` mengikuti **harga resmi periode tsb** (diambil dari referensi publik), `purchasePrice` memakai **margin tetap** (mis. `selling - 500`) agar konsisten dengan pola produk lain.

## Infrastruktur yang akan dibuat (realistis)

### Konvensi penamaan & kode
- **Tank**: kode format `T-<PROD>-<NN>` (contoh `T-PLT-01`), nama memuat konteks (`Pertalite Motor`, `Pertalite Mobil`).
- **Station (pulau/dispenser)**: kode `PUL-01`, `PUL-02`, dst. Nama: `Pulau 1 (Motor)`, `Pulau 3 (Diesel)`, dst.
- **Nozzle**: kode unik per station, contoh `11`, `12`, `21`, `22` (string), nama: `Nozzle Pertalite Motor 11`.

### Layout per SPBU
- **Makassar (11.111.11)** & **Surabaya (33.333.33)**: 4 station (termasuk station khusus Pertamax+Turbo)
  - `PUL-01 (Motor)`: Pertalite + Pertamax
  - `PUL-02 (Mobil)`: Pertalite (mobil) + Pertamax
  - `PUL-03 (Diesel)`: Biosolar + Dexlite (1 pulau yang sama)
  - `PUL-04 (Premium)`: Pertamax + Pertamax Turbo
  - Tank:
    - Pertalite **2 tank**: `Pertalite Motor` & `Pertalite Mobil` (dua record `Tank` untuk product Pertalite yang sama)
    - Pertamax 1 tank, Turbo 1 tank, Biosolar 1 tank, Dexlite 1 tank
- **Pangkep (22.222.22)**: 3 station (tanpa Turbo)
  - `PUL-01 (Motor)`: Pertalite + Pertamax
  - `PUL-02 (Mobil)`: Pertalite (mobil) + Pertamax
  - `PUL-03 (Diesel)`: Biosolar + Dexlite
  - Tank:
    - Pertalite 2 tank (motor/mobil)
    - Pertamax 1 tank, Biosolar 1 tank, Dexlite 1 tank

### Koneksi yang wajib konsisten
- `TankStation` hanya dibuat untuk pasangan tank–station yang benar-benar melayani produk tsb (bukan connect-all).
- `Nozzle.tankId` harus mengarah ke tank yang tepat (mis. Pertalite Motor nozzle → tank Pertalite Motor).
- `Nozzle.productId` harus selaras dengan tank.productId (tidak boleh mismatch).

## Data operasional periode 15 Nov 2025 – 15 Jan 2026

### Per SPBU, per hari
- Membuat shift per station (default 2–3 shift/hari, diset konsisten dengan `openTime/closeTime`).
- Untuk setiap `OperatorShift`:
  - Buat `NozzleReading OPEN` & `CLOSE` untuk semua nozzle di station.
  - `totalizerReading` dibuat **cumulative** dan meningkat sesuai volume.
  - `pumpTest` kecil (mis. 0–10 L per nozzle/shift, tidak selalu ada).
  - `priceSnapshot` mengikuti harga jual harian (khusus Turbo bisa mengikuti jadwal harga resmi; produk lain bisa statis sesuai default).

### Distribusi produk per kota (realistis)
- Menggunakan komposisi volume per SPBU yang berbeda agar terlihat “mana yang laku”:
  - **Pangkep**: Pertalite dominan, Pertamax sedang, diesel kecil, Dexlite sangat kecil
  - **Makassar**: Pertalite dominan, Pertamax lebih besar dari Pangkep, diesel moderat, Turbo kecil
  - **Surabaya**: Pertamax & Turbo relatif lebih tinggi (kota besar), Pertalite tetap dominan
- Distribusi ini akan dipakai untuk mengalokasikan volume per shift ke nozzle-nozzle yang relevan.

### Deposit & transaksi otomatis (sales-only income)
- Per shift dibuat `Deposit` + `DepositDetail` (mix CASH/BANK realistis per kota) dan status **APPROVED**.
- Seed akan memicu pembuatan `Transaction`:
  - REVENUE: debit Kas/Bank, kredit Pendapatan per produk
  - COGS: debit HPP/pump-test, kredit Persediaan per produk

## LO Pembelian, Unload, Tank Reading, Expense, Transfer

### LO Pembelian (PURCHASE_BBM)
- Membuat LO per product berdasarkan kebutuhan stok (reorder point), untuk memastikan stok tidak negatif.
- Semua LO status **APPROVED**.

### Unload
- Saat stok menipis, buat `Unload` terkait `purchaseTransactionId`.
- Seed juga membuat transaksi UNLOAD yang benar (inventory vs LO + susut perjalanan jika ada selisih delivered vs real).

### Tank Reading
- Periodik (mis. mingguan) per tank untuk menghasilkan `TankReading` dan variasi kecil (variance) agar realistis.
- Saat ada variance, buat transaksi `TANK_READING` (profit/loss) sesuai util yang ada.

### Cash Transaction (tanpa income manual)
- **TRANSFER**: contoh setoran kas ke bank mingguan.
- **EXPENSE**: biaya operasional (listrik, kebersihan, maintenance kecil) dengan approval APPROVED.
- Tidak membuat `CASH` tipe INCOME.

## Implementasi (file yang akan disentuh)
- [`prisma/seed.ts`](prisma/seed.ts): implementasi seed end-to-end.
- (Opsional) [`prisma/seed-utils.ts`](prisma/seed-utils.ts): helper RNG deterministik & generator jadwal tanggal agar hasil repeatable.
- Menggunakan util yang sudah ada:
  - [`lib/utils/datetime.ts`](lib/utils/datetime.ts) untuk normalisasi tanggal UTC
  - [`lib/utils/coa.utils.ts`](lib/utils/coa.utils.ts) untuk pembuatan COA standar & COA per produk
  - [`lib/utils/transaction/transaction-deposit.ts`](lib/utils/transaction/transaction-deposit.ts) untuk membentuk transaksi deposit (REVENUE/COGS)
  - [`lib/utils/transaction/transaction-unload.ts`](lib/utils/transaction/transaction-unload.ts) untuk transaksi unload
  - [`lib/utils/transaction/transaction-tank-reading.ts`](lib/utils/transaction/transaction-tank-reading.ts) untuk transaksi variance tank reading

## Validasi hasil seed (cek cepat)
- Per SPBU:
  - Semua station punya nozzle sesuai layout
  - Semua nozzle punya OPEN/CLOSE readings periodik
  - Ada deposit APPROVED untuk setiap shift yang dibuat
  - Ada REVENUE/COGS transaksi yang jumlahnya masuk akal
  - Stok tank tidak negatif dan LO berkurang saat unload
  - Tidak ada transaksi CASH INCOME

