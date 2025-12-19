import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OwnerGroupDashboard } from "@/components/ownergroup/owner-group-dashboard";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ownerId?: string }>;
};

export default async function OwnerGroupPage({ searchParams }: Props) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const roleCode = session.user.roleCode;
  const userId = session.user.id;
  const userGasStationId = session.user.assignedGasStationId;

  // DEVELOPER, ADMINISTRATOR, OWNER, OWNER_GROUP, MANAGER, dan FINANCE bisa akses dashboard ini
  // DEVELOPER selalu pass semuanya
  // ADMINISTRATOR selalu pass semua di kepemilikan ownernya
  // OWNER bisa akses dashboard miliknya sendiri
  // MANAGER dan FINANCE hanya jika toggle on di gas station mereka
  if (
    roleCode !== "DEVELOPER" &&
    roleCode !== "ADMINISTRATOR" &&
    roleCode !== "OWNER" &&
    roleCode !== "OWNER_GROUP" &&
    roleCode !== "MANAGER" &&
    roleCode !== "FINANCE"
  ) {
    redirect("/welcome");
  }

  // Check toggle untuk MANAGER dan FINANCE dan auto-detect ownerId
  let finalOwnerId: string | undefined = undefined;
  if (roleCode === "MANAGER" || roleCode === "FINANCE") {
    if (!userGasStationId) {
      redirect("/welcome");
    }

    const { prisma } = await import("@/lib/prisma");
    const gasStation = await prisma.gasStation.findUnique({
      where: { id: userGasStationId },
      select: {
        ownerId: true,
        managerCanPurchase: true,
        financeCanPurchase: true,
      },
    });

    if (!gasStation) {
      redirect("/welcome");
    }

    // Check toggle
    if (
      (roleCode === "MANAGER" && !gasStation.managerCanPurchase) ||
      (roleCode === "FINANCE" && !gasStation.financeCanPurchase)
    ) {
      redirect("/welcome");
    }

    // Auto-detect ownerId dari gas station mereka
    finalOwnerId = gasStation.ownerId;
  }

  const params = await searchParams;
  // Untuk MANAGER/FINANCE, gunakan ownerId dari gas station mereka jika tidak ada di URL
  const ownerIdToUse = params.ownerId || finalOwnerId;
  
  return (
    <OwnerGroupDashboard 
      ownerId={ownerIdToUse} 
      userRole={roleCode}
      gasStationId={roleCode === "MANAGER" || roleCode === "FINANCE" ? userGasStationId : undefined}
    />
  );
}
