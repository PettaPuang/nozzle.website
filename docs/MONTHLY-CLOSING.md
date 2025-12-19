# Monthly Closing - Automatic Transfer Realtime Profit/Loss to Retained Earnings

## Overview

Sistem ini secara otomatis melakukan penutupan buku setiap akhir bulan dengan memindahkan saldo **Realtime Profit/Loss** ke **Laba Ditahan**. Setelah penutupan, Realtime Profit/Loss akan kembali menjadi 0 di awal bulan berikutnya.

## How It Works

### Realtime Profit/Loss Calculation

**Realtime Profit/Loss** dihitung dengan formula:
```
Realtime P/L Balance = (Total REVENUE - Total EXPENSE - Total COGS) - Transfer to Retained Earnings
```

Dimana:
- `Total REVENUE - Total EXPENSE - Total COGS` = Net Income untuk semua periode
- `Transfer to Retained Earnings` = Total yang sudah ditransfer melalui closing transactions

Jadi setelah closing transaction:
- Net Income tetap sama (karena REVENUE, EXPENSE, COGS tidak berubah)
- Transfer to Retained Earnings bertambah
- **Realtime P/L Balance = 0** (karena semua net income sudah ditransfer)

### Accounting Logic

1. **Jika Profit (Balance > 0)**:
   ```
   Debit:  Realtime Profit/Loss  (mengurangi equity - mengosongkan)
   Credit: Laba Ditahan           (menambah equity - akumulasi)
   ```

2. **Jika Loss (Balance < 0)**:
   ```
   Debit:  Laba Ditahan           (mengurangi equity - menyerap rugi)
   Credit: Realtime Profit/Loss   (mengurangi negative equity - mengosongkan)
   ```

### Process Flow

```
Akhir Bulan → Hitung Saldo Realtime Profit/Loss → Create Closing Transaction → Reset Realtime Profit/Loss to 0
```

## Setup Cron Job

### Option 1: Vercel Cron (Recommended)

Tambahkan di `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-closing",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

Schedule: `0 0 1 * *` = Run at 00:00 on day 1 of every month (UTC)

### Option 2: External Cron Service

Gunakan service seperti:
- **cron-job.org**
- **EasyCron**
- **GitHub Actions**

Setup:
1. Create cron job yang hit endpoint: `https://yourdomain.com/api/cron/monthly-closing`
2. Method: `GET` atau `POST`
3. Headers: `Authorization: Bearer YOUR_CRON_SECRET`
4. Schedule: `0 0 1 * *` (setiap tanggal 1, jam 00:00)

### Environment Variable

Tambahkan di `.env`:

```env
CRON_SECRET=your-secret-key-here
```

Untuk production, set di Vercel dashboard:
```
Settings > Environment Variables
CRON_SECRET = your-secret-key-here
```

## Manual Closing

### Via Action (Code)

```typescript
import { manualMonthlyClosing } from "@/lib/actions/closing.actions";

// Close untuk gas station tertentu
const result = await manualMonthlyClosing(
  gasStationId,
  new Date() // Closing date
);

if (result.success) {
  console.log(result.message);
  // "Penutupan buku November 2024 berhasil. Laba: Rp 5,000,000"
}
```

### Via API

```bash
curl -X POST https://yourdomain.com/api/cron/monthly-closing \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Check Closing Status

```typescript
import { getMonthlyClosingStatus } from "@/lib/actions/closing.actions";

const result = await getMonthlyClosingStatus(
  gasStationId,
  2024, // year
  10    // month (0-11, October = 10)
);

if (result.success && result.data.hasClosed) {
  console.log("Closing already done for this month");
}
```

## Database Schema

Tidak perlu perubahan schema. Sistem menggunakan:

1. **COA Existing**:
   - `Realtime Profit/Loss` (EQUITY) - sudah ada
   - `Laba Ditahan` (EQUITY) - akan dibuat otomatis jika belum ada

2. **Transaction Type**:
   - `transactionType: "ADJUSTMENT"`
   - `description: "Penutupan Buku [Bulan Tahun]"`
   - `approvalStatus: "APPROVED"` (auto-approved)

## Example Transaction

```json
{
  "transactionType": "ADJUSTMENT",
  "description": "Penutupan Buku November 2024",
  "date": "2024-12-01T00:00:00.000Z",
  "approvalStatus": "APPROVED",
  "journalEntries": [
    {
      "coa": "Realtime Profit/Loss",
      "debit": 5000000,
      "credit": 0
    },
    {
      "coa": "Laba Ditahan",
      "debit": 0,
      "credit": 5000000
    }
  ]
}
```

## Safety Features

1. **Idempotent**: Tidak akan membuat closing duplikat untuk bulan yang sama
2. **Validation**: Check saldo sebelum create transaction
3. **Auto-approved**: Tidak perlu approval manual
4. **Audit Trail**: Semua closing tercatat di transaction history
5. **Error Handling**: Jika gagal untuk satu gas station, tidak affect yang lain

## Testing

### Test Manual Closing

```typescript
// Test closing untuk gas station
const result = await manualMonthlyClosing(
  "your-gas-station-id",
  new Date("2024-12-01")
);
console.log(result);
```

### Test Cron Endpoint (Local)

```bash
# Set environment variable
export CRON_SECRET=test-secret-123

# Call endpoint
curl http://localhost:3000/api/cron/monthly-closing \
  -H "Authorization: Bearer test-secret-123"
```

## Monitoring

Check transaction history untuk melihat closing transactions:

```typescript
const closingTransactions = await prisma.transaction.findMany({
  where: {
    gasStationId,
    transactionType: "ADJUSTMENT",
    description: {
      startsWith: "Penutupan Buku",
    },
  },
  include: {
    journalEntries: {
      include: {
        coa: true,
      },
    },
  },
  orderBy: {
    date: "desc",
  },
});
```

## Troubleshooting

### Closing tidak jalan otomatis
- Check cron job configuration
- Check CRON_SECRET environment variable
- Check Vercel logs untuk error

### Saldo Realtime Profit/Loss masih ada setelah closing
- Check apakah closing transaction sudah APPROVED
- Check journal entries apakah sudah benar (debit/credit)
- Regenerate balance dengan recalculate COA balance

### Error "COA Realtime Profit/Loss tidak ditemukan"
- Pastikan COA sudah dibuat saat initialization
- Check spelling dan category (harus EQUITY)

## Files Created

1. `/lib/utils/transaction/transaction-closing.ts` - Core logic
2. `/lib/actions/closing.actions.ts` - Server actions
3. `/app/api/cron/monthly-closing/route.ts` - Cron API endpoint
4. `/docs/MONTHLY-CLOSING.md` - Documentation (this file)

