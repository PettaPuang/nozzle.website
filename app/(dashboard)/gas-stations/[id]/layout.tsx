import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { GasStationService } from "@/lib/services/gas-station.service";
import { OperationalService } from "@/lib/services/operational.service";
import { UserService } from "@/lib/services/user.service";
import { GasStationHeader } from "@/components/layout/gas-station-header";
import { SidebarProviderWrapper } from "@/components/gas-stations/office/sidebar-provider-wrapper";
import type { RoleCode } from "@/lib/utils/permissions";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function GasStationLayout({
  children,
  params,
}: LayoutProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const isDeveloper = session.user.roleCode === "DEVELOPER";

  // Parallel fetch: authorization check, basic gas station info, and user profile
  // DEVELOPER bisa akses gas station yang inactive, user lain tidak
  const [hasAccess, gasStationBasic, user] = await Promise.all([
    OperationalService.checkAccess(session.user.id, id),
    GasStationService.findByIdBasic(id, isDeveloper),
    UserService.findById(session.user.id),
  ]);

  if (!hasAccess) {
    redirect("/welcome");
  }

  if (!gasStationBasic) {
    notFound();
  }

  // Jika gas station inactive dan user bukan DEVELOPER, redirect ke notfound
  if (gasStationBasic.status === "INACTIVE" && !isDeveloper) {
    notFound();
  }

  const userAvatar = user?.profile?.avatar || null;

  return (
    <SidebarProviderWrapper>
      <div className="h-screen flex flex-col overflow-hidden">
        <GasStationHeader
          gasStation={gasStationBasic}
          userRole={session.user.roleCode as RoleCode}
          userName={session.user.username || "User"}
          userAvatar={userAvatar}
        />
        {children}
      </div>
    </SidebarProviderWrapper>
  );
}
