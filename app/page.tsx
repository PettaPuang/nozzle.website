import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UnloadService } from "@/lib/services/unload.service";
import { FinanceService } from "@/lib/services/finance.service";
import { TransactionService } from "@/lib/services/transaction.service";

export const dynamic = "force-dynamic";

export default async function Home() {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth fails, show website page
    console.error("[Home] Auth error:", error);
  }

  // If user is logged in, redirect to appropriate dashboard
  if (session?.user) {
    const roleCode = session.user.roleCode;
    if (
      roleCode === "DEVELOPER" ||
      roleCode === "ADMINISTRATOR" ||
      roleCode === "OWNER" ||
      roleCode === "OWNER_GROUP"
    ) {
      redirect("/welcome");
    } else if (session.user.assignedGasStationId) {
      // Untuk MANAGER, cek apakah ada pending tasks di Office tab
      if (roleCode === "MANAGER") {
        const gasStationId = session.user.assignedGasStationId;
        const [
          pendingUnloadCount,
          pendingDepositsCount,
          pendingTransactionsCount,
        ] = await Promise.all([
          UnloadService.countPendingByGasStation(gasStationId),
          FinanceService.countPendingDepositsForManager(gasStationId),
          TransactionService.countPendingApproval(gasStationId),
        ]);

        const totalPendingTasks =
          pendingUnloadCount + pendingDepositsCount + pendingTransactionsCount;

        // Jika ada pending tasks, redirect ke tab management
        if (totalPendingTasks > 0) {
          redirect(`/gas-stations/${gasStationId}?tab=management`);
        }
      }

      redirect(`/gas-stations/${session.user.assignedGasStationId}`);
    } else {
      redirect("/welcome");
    }
  }

  // If user is not logged in, show website landing page
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl text-center space-y-8 md:space-y-12">
        {/* Logo Section */}
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/logo/NozzlLogomark.svg"
            alt="Nozzl"
            width={300}
            height={100}
            priority
            className="w-auto h-auto max-w-[200px] md:max-w-[300px]"
          />
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/logo/Nozzl.svg"
              alt="Nozzl"
              width={200}
              height={75}
              priority
              className="w-auto h-auto max-w-[100px] md:max-w-[160px]"
            />
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 italic">
              Your System Evolve
            </p>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
            SPBU Management System
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Evolusi Operasional SPBU Independen - Sistem manajemen berbasis web
            untuk operasional, keuangan, dan pelaporan yang terintegrasi
          </p>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-500">
            by <span className="font-semibold">CNNCT</span>
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/website/demo-experience">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-[#006FB8] hover:bg-[#005A8C] text-white text-base md:text-lg px-8 py-6 h-auto"
            >
              <Play className="mr-2 h-5 w-5" />
              Try Demo Experience
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-base md:text-lg px-8 py-6 h-auto border-gray-300 dark:border-gray-700"
            >
              Login
            </Button>
          </Link>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="text-center p-4">
            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-2">
              Full Control Management
            </h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Visibilitas penuh atas setiap liter dan rupiah
            </p>
          </div>
          <div className="text-center p-4">
            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-2">
              Reliable & Realtime Data
            </h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Semua data dan transaksi tercatat realtime
            </p>
          </div>
          <div className="text-center p-4">
            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white mb-2">
              Easy to Use
            </h3>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Mudah diakses kapan saja & dimana saja
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
