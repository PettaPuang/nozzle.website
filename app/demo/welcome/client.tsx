"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SpbuList } from "@/components/demo/welcome/spbu-list";
import { DelayedContent } from "@/components/reusable/delayed-content";
import type { GasStationWithOwner, ProductForClient, UserWithDetails, RoleOption } from "@/lib/types/demo";

const SpbuMap = dynamic(
  () => import("@/components/demo/welcome/spbu-map").then((mod) => mod.SpbuMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 animate-pulse" />,
  }
);

type WelcomeClientProps = {
  spbus: GasStationWithOwner[];
  isAdmin: boolean;
  userName: string;
  userRole: string;
  owners?: Array<{ id: string; name: string }>;
  roles?: RoleOption[]; // RoleOption dari RoleService
  currentUser?: UserWithDetails | null;
  unreadNotificationCounts?: Record<string, number>;
};

export function WelcomeClient({
  spbus,
  isAdmin,
  userName,
  userRole,
  owners = [],
  roles = [],
  currentUser,
  unreadNotificationCounts = {},
}: WelcomeClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DelayedContent delay={3000}>
      <div className="welcome-grid h-screen w-screen fixed inset-0 overflow-hidden">
        {/* Left Panel - Gas Station List */}
        <div className="h-full border-r overflow-hidden">
          <SpbuList
            spbus={spbus}
            selectedId={selectedId}
            onSelectStation={setSelectedId}
            isAdmin={isAdmin}
            userName={userName}
            userRole={userRole}
            owners={owners}
            roles={roles}
            currentUser={currentUser}
            unreadNotificationCounts={unreadNotificationCounts}
          />
        </div>

        {/* Right Panel - Map */}
        <div className="h-full overflow-hidden">
          <SpbuMap spbus={spbus} selectedId={selectedId} />
        </div>
      </div>
    </DelayedContent>
  );
}

