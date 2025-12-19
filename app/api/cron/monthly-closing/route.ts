import { NextRequest, NextResponse } from "next/server";
import { autoCloseAllGasStations } from "@/lib/utils/transaction/transaction-closing";

/**
 * API Route untuk monthly closing via cron job
 * 
 * Setup cron job di Vercel:
 * 1. vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/monthly-closing",
 *     "schedule": "0 0 1 * *"
 *   }]
 * }
 * 
 * Schedule: "0 0 1 * *" = Run at 00:00 on day 1 of every month
 * 
 * Atau bisa gunakan external cron service seperti:
 * - cron-job.org
 * - EasyCron
 * - GitHub Actions
 * 
 * Authorization: Menggunakan CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting monthly closing cron job...");

    const results = await autoCloseAllGasStations();

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `Monthly closing completed. Success: ${successCount}, Failed: ${failCount}`
    );

    return NextResponse.json({
      success: true,
      message: `Penutupan buku selesai. Berhasil: ${successCount}, Gagal: ${failCount}`,
      results,
    });
  } catch (error: any) {
    console.error("Monthly closing cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}

