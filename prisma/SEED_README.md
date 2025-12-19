# Seed Data Documentation

Seed data telah dibagi menjadi beberapa file untuk menghindari masalah koneksi database dan memudahkan debugging.

## Struktur File

### 1. `seed-helpers.ts`

File helper yang berisi fungsi-fungsi yang digunakan bersama:

- `retryDatabaseOperation` - Retry logic untuk operasi database
- `createPurchaseTransactionForSeed` - Helper untuk membuat purchase transaction
- `createCashTransactionForSeed` - Helper untuk membuat cash transaction
- Constants: `START_DATE`, `END_DATE`, `prisma`, dll

### 2. `seed-infrastructure.ts`

File untuk membuat infrastruktur dasar:

- Developer user
- 3 SPBU (Makassar, Surabaya, Pangkep) dengan owner masing-masing
- Products, Tanks, Stations, Nozzles
- Users dengan berbagai role (Manager, Finance, Unloader, Operators)
- Standard COAs

### 3. `seed-operational.ts`

File helper untuk membuat data operasional:

- Fungsi `seedOperationalData(gasStationName)` yang bisa digunakan untuk semua SPBU

### 4. `seed-makassar.ts`

File seed untuk data operasional SPBU Makassar

### 5. `seed-surabaya.ts`

File seed untuk data operasional SPBU Surabaya

### 6. `seed-pangkep.ts`

File seed untuk data operasional SPBU Pangkep

## Cara Penggunaan

### 1. Seed Infrastruktur (WAJIB dijalankan pertama)

```bash
npm run db:seed
```

atau

```bash
tsx prisma/seed-infrastructure.ts
```

Ini akan membuat:

- Developer user
- 3 SPBU dengan infrastruktur lengkap
- Users untuk setiap SPBU

### 2. Seed Data Operasional Per SPBU

Setelah infrastruktur dibuat, jalankan seed untuk masing-masing SPBU:

**SPBU Makassar:**

```bash
npm run db:seed:makassar
```

atau

```bash
tsx prisma/seed-makassar.ts
```

**SPBU Surabaya:**

```bash
npm run db:seed:surabaya
```

atau

```bash
tsx prisma/seed-surabaya.ts
```

**SPBU Pangkep:**

```bash
npm run db:seed:pangkep
```

atau

```bash
tsx prisma/seed-pangkep.ts
```

### 3. Seed Semua (Infrastruktur + Semua SPBU)

```bash
npm run db:seed:all
```

## Data yang Dibuat

### Infrastruktur (`seed-infrastructure.ts`)

- ✅ Developer user
- ✅ 3 SPBU (Makassar, Surabaya, Pangkep)
- ✅ Products (Pertalite, Pertamax, Dexlite, Biosolar, Pertamax Turbo)
- ✅ Tanks (sesuai produk)
- ✅ Stations (3-4 station per SPBU)
- ✅ Nozzles (sesuai station)
- ✅ Users: Manager, Finance, Unloader, Operators
- ✅ Standard COAs

### Data Operasional (per SPBU)

- ✅ OperatorShift (2 bulan: Nov 2025 - Jan 2026)
- ✅ NozzleReading (OPEN & CLOSE dengan pump test)
- ✅ Deposit & DepositDetail
- ✅ REVENUE & COGS transactions
- ✅ Purchase transactions (PURCHASE_BBM)
- ✅ Unload transactions
- ✅ TankReading dengan variance
- ✅ Cash transactions (EXPENSE & TRANSFER)

## Keuntungan Struktur Ini

1. **Mengurangi Beban Database**: Setiap file seed lebih kecil dan fokus
2. **Mudah Debugging**: Jika error terjadi, bisa langsung tahu di SPBU mana
3. **Fleksibel**: Bisa seed per SPBU sesuai kebutuhan
4. **Retry Logic**: Semua operasi database menggunakan retry logic untuk mengatasi connection error
5. **Progress Indicator**: Menampilkan progress saat seed berjalan

## Troubleshooting

### Error: "Gas station not found"

Pastikan sudah menjalankan `npm run db:seed` terlebih dahulu untuk membuat infrastruktur.

### Error: "Users not found"

Pastikan infrastruktur sudah dibuat dengan lengkap.

### Connection Error

Seed files sudah dilengkapi dengan retry logic. Jika masih error, cek:

1. Database server running
2. DATABASE_URL benar di .env
3. Network connection stabil
