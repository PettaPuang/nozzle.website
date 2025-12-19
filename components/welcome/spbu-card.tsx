import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Edit, Clock, Menu, Trash2, Bell } from "lucide-react";
import type { GasStationWithOwner } from "@/lib/services/gas-station.service";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

type SpbuCardProps = {
  spbu: GasStationWithOwner;
  isSelected?: boolean;
  onClick?: () => void;
  isAdmin?: boolean;
  onEdit?: (spbu: GasStationWithOwner) => void;
  onDelete?: (spbu: GasStationWithOwner) => void;
  unreadNotificationCount?: number;
  userRole?: string;
};

export function SpbuCard({
  spbu,
  isSelected,
  onClick,
  isAdmin,
  onEdit,
  onDelete,
  unreadNotificationCount = 0,
  userRole,
}: SpbuCardProps) {
  const isInactive = spbu.status === "INACTIVE";
  const router = useRouter();
  const hasNotifications = unreadNotificationCount > 0;

  const handleCardClick = () => {
    if (isSelected) {
      // Jika sudah selected, klik kedua akan masuk ke detail gas station
      router.push(`/gas-stations/${spbu.id}`);
    } else {
      // Jika belum selected, klik pertama akan select (pindah ke peta)
      onClick?.();
    }
  };

  return (
    <div
      className={cn(
        "transition-all border-b border-gray-200 px-2 lg:px-3 py-2 lg:py-2.5",
        isSelected && !isInactive && "bg-blue-50 border-l-4 border-l-blue-500"
      )}
    >
      <div className="flex items-center justify-between gap-2 lg:gap-3 min-w-0 overflow-hidden">
        <button
          className={cn(
            "flex-1 min-w-0 max-w-full text-left transition-all rounded px-1 -mx-1 py-1 overflow-hidden",
            isInactive
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:bg-gray-50"
          )}
          onClick={handleCardClick}
          disabled={isInactive}
        >
          <div className="flex-1 min-w-0 flex items-center gap-2 lg:gap-3 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5 lg:mb-1 min-w-0">
                <Image
                  src="/picture/pertaminalogo.png"
                  alt="Pertamina"
                  width={16}
                  height={16}
                  className="h-3 w-3 lg:h-4 lg:w-4 shrink-0"
                />
                <h3
                  className={cn(
                    "text-sm lg:text-base font-semibold truncate min-w-0 flex-1",
                    isInactive && "text-gray-500"
                  )}
                >
                  {spbu.name}
                </h3>
              </div>
              <div
                className={cn(
                  "flex items-start gap-1 lg:gap-1.5 text-[10px] lg:text-xs mb-0.5 lg:mb-1",
                  isInactive ? "text-gray-400" : "text-gray-600"
                )}
              >
                <MapPin className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0 mt-0.5" />
                <span className="flex-1 min-w-0 line-clamp-2 wrap-break-words">
                  {spbu.address}
                </span>
              </div>
              <div className="flex items-center gap-1 lg:gap-1.5 flex-wrap">
                {spbu.openTime && spbu.closeTime && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-[10px] lg:text-xs",
                      isInactive ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0" />
                    <span className="whitespace-nowrap">
                      {spbu.openTime} - {spbu.closeTime}
                    </span>
                  </div>
                )}
                <Badge
                  variant={spbu.status === "ACTIVE" ? "default" : "destructive"}
                  className="shrink-0 text-[10px] lg:text-xs px-1.5 py-0"
                >
                  {spbu.status}
                </Badge>
              </div>
              {isSelected && (
                <div className="mt-1 lg:mt-1.5 text-[10px] lg:text-xs text-blue-600 font-medium">
                  Klik lagi untuk masuk ke detail SPBU
                </div>
              )}
            </div>
          </div>
        </button>
        {isAdmin && (onEdit || onDelete) ? (
          <div className="flex items-center gap-1 lg:gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 lg:h-8 lg:w-8 border border-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Menu className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(spbu);
                    }}
                  >
                    <Edit className="mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(spbu);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {hasNotifications && unreadNotificationCount > 0 && (
        <div className="mt-2 pt-2 border-t flex items-center justify-end gap-2">
          <Badge
            variant="destructive"
            className="h-5 min-w-5 px-1.5 text-xs flex items-center justify-center shrink-0"
          >
            {unreadNotificationCount}
          </Badge>
        </div>
      )}
    </div>
  );
}
