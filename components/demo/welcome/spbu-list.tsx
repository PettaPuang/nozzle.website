"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  MapPin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { SpbuCard } from "./spbu-card";
import type { GasStationWithOwner } from "@/lib/types/demo";
import { useRouter } from "next/navigation";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { getRoleLabel } from "@/lib/utils/permissions";
import { Badge } from "@/components/ui/badge";

type SpbuListProps = {
  spbus: GasStationWithOwner[];
  selectedId?: string | null;
  onSelectStation?: (id: string) => void;
  isAdmin?: boolean;
  userName?: string;
  userRole?: string;
  owners?: Array<{ id: string; name: string }>;
  roles?: Array<{ value: string; label: string }>; // RoleOption dari RoleService
  currentUser?: UserWithDetails | null;
  unreadNotificationCounts?: Record<string, number>;
};

export function SpbuList({
  spbus,
  selectedId,
  onSelectStation,
  isAdmin,
  userName,
  userRole = "",
  owners = [],
  roles = [],
  currentUser,
  unreadNotificationCounts = {},
}: SpbuListProps) {
  const [search, setSearch] = useState("");
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Filter SPBU berdasarkan search
  const filteredSpbus = spbus.filter(
    (spbu) =>
      spbu.name.toLowerCase().includes(search.toLowerCase()) ||
      spbu.owner.profile?.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group SPBU by owner dari filtered SPBU
  const groupedByOwner = filteredSpbus.reduce((acc, spbu) => {
    const ownerId = spbu.ownerId;
    const ownerName = spbu.owner.profile?.name || "Unknown Owner";

    if (!acc[ownerId]) {
      acc[ownerId] = {
        ownerId,
        ownerName,
        spbus: [],
      };
    }
    acc[ownerId].spbus.push(spbu);
    return acc;
  }, {} as Record<string, { ownerId: string; ownerName: string; spbus: GasStationWithOwner[] }>);

  // Include semua owners, bahkan yang tidak memiliki gas station
  // Filter owners berdasarkan search jika ada
  owners.forEach((owner) => {
    const ownerMatchesSearch =
      !search || owner.name.toLowerCase().includes(search.toLowerCase());

    if (!groupedByOwner[owner.id] && ownerMatchesSearch) {
      groupedByOwner[owner.id] = {
        ownerId: owner.id,
        ownerName: owner.name,
        spbus: [],
      };
    }
  });

  // Filter owner groups berdasarkan search jika ada
  let ownerGroups = Object.values(groupedByOwner);

  if (search) {
    // Jika ada search, filter owner groups yang match atau memiliki SPBU yang match
    ownerGroups = ownerGroups.filter(
      (group) =>
        group.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        group.spbus.length > 0
    );
  }

  ownerGroups.sort((a, b) => a.ownerName.localeCompare(b.ownerName));

  // Set all owners expanded by default
  useEffect(() => {
    if (ownerGroups.length > 0 && expandedOwners.size === 0) {
      const allOwnerIds = new Set(ownerGroups.map((group) => group.ownerId));
      setExpandedOwners(allOwnerIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spbus]);




  const toggleOwner = (ownerId: string) => {
    setExpandedOwners((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ownerId)) {
        newSet.delete(ownerId);
      } else {
        newSet.add(ownerId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Header */}
      <div className="px-3 lg:px-4 pt-2 lg:pt-4 pb-1.5 lg:pb-2">
        <div className="flex items-center justify-between">
          {/* Tablet: compact */}
          <h1 className="text-sm lg:text-base font-normal header-tablet">
            <span className="font-bold">{userName}</span>
            <span className="text-[10px] lg:text-xs text-gray-500">
              {" "}
              ({getRoleLabel(userRole)})
            </span>
          </h1>

          {/* Desktop: full */}
          <h1 className="text-lg font-normal header-desktop">
            Welcome <span className="font-bold">{userName}</span>
            <span className="text-sm text-gray-500">
              , you are a {getRoleLabel(userRole)}
            </span>
          </h1>
        </div>

        {/* Pertamina Stripes */}
        <div className="mt-2 lg:mt-3">
          <PertaminaStripes />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 lg:px-4 pb-2 lg:pb-3">
        <div className="relative">
          <Search className="absolute left-2 lg:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
          <Input
            placeholder="Search Gas Station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 lg:pl-10 h-8 lg:h-10 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 lg:px-4 pb-3 lg:pb-4 pt-1 lg:pt-2 space-y-1.5 lg:space-y-2">
        {ownerGroups.map((group) => {
          const isDeveloper = userRole === "DEVELOPER";
          const canViewDashboard =
            userRole === "OWNER" ||
            userRole === "OWNER_GROUP" ||
            userRole === "DEVELOPER" ||
            userRole === "ADMINISTRATOR";
          const isExpanded = isDeveloper
            ? expandedOwners.has(group.ownerId)
            : canViewDashboard
            ? true
            : expandedOwners.has(group.ownerId);

          return (
            <div key={group.ownerId} className="space-y-1 lg:space-y-2">
              <div className="flex items-center gap-1.5 lg:gap-2 px-1.5 lg:px-2 py-1 lg:py-1.5 bg-gray-50 rounded-md border">
                {/* Kolom 1: Expand/Collapse (hanya untuk developer) */}
                {isDeveloper && (
                  <div
                    className="cursor-pointer hover:bg-gray-100 rounded px-0.5 lg:px-1 -mx-0.5 lg:-mx-1 transition-colors flex items-center"
                    onClick={() => toggleOwner(group.ownerId)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 text-gray-600" />
                    )}
                  </div>
                )}
                {!isDeveloper && !canViewDashboard && (
                  <div
                    className="cursor-pointer hover:bg-gray-100 rounded px-0.5 lg:px-1 -mx-0.5 lg:-mx-1 transition-colors flex items-center"
                    onClick={() => toggleOwner(group.ownerId)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4 text-gray-600" />
                    )}
                  </div>
                )}

                {/* Kolom 2: Konten (icon, nama, dll) - bisa diklik untuk dashboard */}
                <div
                  className={`flex items-center gap-1 lg:gap-2 flex-1 ${
                    canViewDashboard
                      ? "cursor-pointer hover:bg-gray-100 rounded px-0.5 lg:px-1 -mx-0.5 lg:-mx-1 transition-colors"
                      : ""
                  }`}
                  onClick={() => {
                    if (canViewDashboard) {
                      router.push(`/ownergroup?ownerId=${group.ownerId}`);
                    }
                  }}
                >
                  <Image
                    src="/logo/NozzlLogomark.svg"
                    alt="Nozzl"
                    width={16}
                    height={16}
                    className="h-3 w-3 lg:h-4 lg:w-4"
                  />
                  <h2
                    className={`text-xs lg:text-sm font-semibold ${
                      canViewDashboard
                        ? "text-blue-600 hover:text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {group.ownerName}
                  </h2>
                  <span className="text-[10px] lg:text-xs text-gray-500">
                    ({group.spbus.length} SPBU)
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div className="space-y-1 lg:space-y-2 pl-1 lg:pl-2">
                  {group.spbus.length > 0 ? (
                    group.spbus.map((spbu) => (
                      <SpbuCard
                        key={spbu.id}
                        spbu={spbu}
                        isSelected={selectedId === spbu.id}
                        onClick={() => onSelectStation?.(spbu.id)}
                        isAdmin={false}
                        unreadNotificationCount={0}
                        userRole={userRole}
                      />
                    ))
                  ) : (
                    <div className="text-xs lg:text-sm text-muted-foreground px-2 py-1">
                      Tidak ada SPBU
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {ownerGroups.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No SPBU found</p>
          </div>
        )}
      </div>


    </div>
  );
}
