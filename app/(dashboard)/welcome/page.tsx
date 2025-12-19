import { GasStationService } from "@/lib/services/gas-station.service";
import { ProductService } from "@/lib/services/product.service";
import { UserService } from "@/lib/services/user.service";
import { RoleService } from "@/lib/services/role.service";
import { NotificationService } from "@/lib/services/notification.service";
import { WelcomeClient } from "./client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const session = await auth();

  // Double check authentication (redundant but safe - defense in depth)
  if (!session) {
    redirect("/login");
  }

  const roleCode = session.user.roleCode;

  // Role-based access control: Only DEVELOPER, ADMINISTRATOR, OWNER, and OWNER_GROUP can access welcome page
  if (roleCode !== "DEVELOPER" && roleCode !== "ADMINISTRATOR" && roleCode !== "OWNER" && roleCode !== "OWNER_GROUP") {
    // Redirect staff to their assigned gas station
    if (session.user.assignedGasStationId) {
      redirect(`/gas-stations/${session.user.assignedGasStationId}`);
    }
    redirect("/login");
  }

  const isAdmin = roleCode === "DEVELOPER" || roleCode === "ADMINISTRATOR";
  const isDeveloper = roleCode === "DEVELOPER";
  const userName = session.user.username || "User";
  const userId = session.user.id;

  // Determine ownerId untuk filtering gas stations
  // OWNER: user.id adalah ownerId itu sendiri
  // OWNER_GROUP & ADMINISTRATOR: perlu ambil ownerId dari database
  // DEVELOPER: tidak perlu filter (lihat semua)
  let targetOwnerId: string | undefined = undefined;
  
  if (roleCode === "OWNER") {
    targetOwnerId = userId;
  } else if (roleCode === "OWNER_GROUP" || roleCode === "ADMINISTRATOR") {
    // Ambil ownerId dari database
    const userWithOwner = await UserService.findById(userId);
    if (userWithOwner?.ownerId) {
      targetOwnerId = userWithOwner.ownerId;
    }
  }
  // DEVELOPER: targetOwnerId tetap undefined (lihat semua)

  // Parallel fetch: gas stations always needed, admin data and current user conditionally
  // Semua user bisa melihat gas station INACTIVE di list, tapi hanya DEVELOPER yang bisa akses
  // Fetch owners untuk semua role agar bisa menampilkan owner tanpa gas station
  // ADMINISTRATOR hanya melihat owner mereka sendiri
  const [gasStations, adminData, currentUser, unreadNotificationCounts] = await Promise.all([
    GasStationService.findAll(isDeveloper, targetOwnerId), // Filter by ownerId jika bukan DEVELOPER
    isAdmin
      ? Promise.all([
          UserService.findOwners(),
          Promise.resolve(RoleService.findAllActive()), // No DB call, just enum
        ])
      : Promise.all([
          UserService.findOwners(), // Fetch owners untuk semua role
          Promise.resolve([]), // Roles hanya untuk admin
        ]),
    userId ? UserService.findById(userId) : Promise.resolve(null),
    userId ? NotificationService.getUnreadCountsByGasStation(userId) : Promise.resolve({} as Record<string, number>),
  ]);

  let [owners, roles] = adminData;

  // Filter owners untuk OWNER, OWNER_GROUP, dan ADMINISTRATOR - hanya owner mereka sendiri
  if ((roleCode === "OWNER" || roleCode === "OWNER_GROUP" || roleCode === "ADMINISTRATOR") && targetOwnerId) {
    owners = owners.filter((owner) => owner.id === targetOwnerId);
  }

  return (
    <WelcomeClient
      spbus={gasStations}
      isAdmin={isAdmin}
      userName={userName}
      userRole={roleCode || ""}
      owners={owners}
      roles={roles}
      currentUser={currentUser}
      unreadNotificationCounts={unreadNotificationCounts}
    />
  );
}
