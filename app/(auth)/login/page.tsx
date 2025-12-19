import packageJson from "../../../package.json";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginContent } from "./login-content";
import { UnloadService } from "@/lib/services/unload.service";
import { FinanceService } from "@/lib/services/finance.service";
import { TransactionService } from "@/lib/services/transaction.service";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // If auth fails, allow login page
    console.error("[LoginPage] Auth error:", error);
  }

  // Redirect logged in users away from login page
  if (session?.user) {
    const roleCode = session.user.roleCode;
    if (
      roleCode === "DEVELOPER" ||
      roleCode === "ADMINISTRATOR" ||
      roleCode === "OWNER"
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

  return (
    <>
      <div className="flex min-h-svh flex-col lg:flex-row bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {/* Left side - Logo only */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/logo/NozzlLogomark.svg')] bg-center bg-no-repeat bg-contain opacity-40"></div>
        </div>

        {/* Right side - Landing Page or Login Form */}
        <div className="flex-1 flex flex-col items-center p-4 lg:p-8">
          <div className="w-full max-w-md flex-1 flex flex-col justify-center">
            <LoginContent />
          </div>
          <div className="w-full max-w-md mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Version {packageJson.version}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
