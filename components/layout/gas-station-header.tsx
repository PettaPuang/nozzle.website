"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { MapPin, Clock, ChevronLeft, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { getRoleLabel, type RoleCode } from "@/lib/utils/permissions";

type GasStationHeaderProps = {
  gasStation: {
    id: string;
    name: string;
    address: string;
    status: string;
    openTime: string | null;
    closeTime: string | null;
  };
  userRole: RoleCode;
  userName: string;
  userAvatar?: string | null;
};

export function GasStationHeader({
  gasStation,
  userRole,
  userName,
  userAvatar,
}: GasStationHeaderProps) {
  const isAdminOrOwner =
    userRole === "DEVELOPER" ||
    userRole === "ADMINISTRATOR" ||
    userRole === "OWNER" ||
    userRole === "OWNER_GROUP";
  const roleLabel = getRoleLabel(userRole);

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <div className="bg-white">
        <div className="px-2 lg:px-6 py-2 lg:py-4 flex items-center justify-between">
          {/* Left: User Profile & Back Button */}
          <div className="flex items-center gap-1.5 lg:gap-3">
            {isAdminOrOwner && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-8 w-8 lg:h-9 lg:w-9"
              >
                <Link href="/welcome">
                  <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
                </Link>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 lg:h-9 lg:w-9 rounded-full p-0 ring-2 ring-offset-2 ring-blue-500/20 hover:ring-blue-500/40 transition-all"
                >
                  <Avatar className="h-8 w-8 lg:h-9 lg:w-9">
                    {userAvatar && (
                      <AvatarImage src={userAvatar} alt={userName} />
                    )}
                    <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs lg:text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 lg:w-56">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 text-xs lg:text-sm"
                >
                  <LogOut className="mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden sm:block">
              <p className="text-xs lg:text-sm font-semibold text-gray-900">
                Selamat datang, {userName}
              </p>
              <p className="text-xs lg:text-sm text-gray-500">{roleLabel}</p>
            </div>
          </div>

          {/* Right: Gas Station Info */}
          <div className="text-right">
            <div className="flex items-center gap-1.5 lg:gap-3 justify-end flex-wrap">
              <h1 className="text-sm lg:text-xl font-bold text-gray-900">
                {gasStation.name}
              </h1>
              <Badge
                variant={
                  gasStation.status === "ACTIVE" ? "default" : "secondary"
                }
                className="text-xs lg:text-sm shrink-0 px-1.5 lg:px-2 py-0"
              >
                {gasStation.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-3 mt-0.5 lg:mt-1 justify-end flex-wrap">
              <div className="hidden lg:flex items-center gap-0.5 lg:gap-1 text-xs lg:text-sm text-gray-600">
                <MapPin className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0" />
                <span>{gasStation.address}</span>
              </div>
              {gasStation.openTime && gasStation.closeTime && (
                <>
                  <div className="flex items-center gap-0.5 lg:gap-1 text-xs lg:text-sm text-gray-600">
                    <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0" />
                    <span>
                      {gasStation.openTime} - {gasStation.closeTime}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <PertaminaStripes />
    </>
  );
}
