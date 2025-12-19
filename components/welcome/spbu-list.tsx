"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  MapPin,
  LogOut,
  Package,
  Settings,
  Menu,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpbuCard } from "./spbu-card";
import { GasStationForm } from "./gas-station-form";
import { UserForm } from "@/components/reusable/form";
import {
  updateGasStation,
  toggleGasStationStatus,
  deleteGasStation,
} from "@/lib/actions/gas-station.actions";
import type { GasStationWithOwner } from "@/lib/services/gas-station.service";
import type { ProductForClient } from "@/lib/services/product.service";
import type { UserWithDetails } from "@/lib/services/user.service";
import { useRouter } from "next/navigation";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import { toast } from "sonner";
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
  const [editGasStationOpen, setEditGasStationOpen] = useState(false);
  const [selectedGasStation, setSelectedGasStation] =
    useState<GasStationWithOwner | null>(null);
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gasStationToDelete, setGasStationToDelete] =
    useState<GasStationWithOwner | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const isDeveloper = userRole === "DEVELOPER";
  const canDelete = isDeveloper || userRole === "ADMINISTRATOR";

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


  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleEditGasStation = (spbu: GasStationWithOwner) => {
    // ADMIN ONLY: This function should only be called by admin users
    // Additional server-side check is enforced in updateGasStation action
    setSelectedGasStation(spbu);
    setEditGasStationOpen(true);
  };

  const handleUpdateGasStation = async (data: any) => {
    if (!selectedGasStation) return;

    // ADMIN ONLY: Server-side permission check enforced in action
    const result = await updateGasStation(selectedGasStation.id, data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setEditGasStationOpen(false);
      setSelectedGasStation(null);
    } else {
      toast.error(result.message);
    }
  };

  const handleStatusToggle = async (
    id: string,
    status: "ACTIVE" | "INACTIVE"
  ) => {
    setUpdatingStatus((prev) => new Set(prev).add(id));
    try {
      const result = await toggleGasStationStatus(id, status);
      if (result.success) {
        toast.success(result.message);
        window.location.reload();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Gagal mengubah status gas station");
    } finally {
      setUpdatingStatus((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteClick = (spbu: GasStationWithOwner) => {
    setGasStationToDelete(spbu);
    setConfirmName("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!gasStationToDelete) return;

    // Validasi nama harus sesuai
    if (confirmName.trim() !== gasStationToDelete.name.trim()) {
      toast.error("Nama SPBU tidak sesuai");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteGasStation(gasStationToDelete.id);
      if (result.success) {
        toast.success(result.message);
        setDeleteDialogOpen(false);
        setGasStationToDelete(null);
        setConfirmName("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Gagal menghapus gas station");
    } finally {
      setIsDeleting(false);
    }
  };

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild suppressHydrationWarning>
              <Button
                variant="ghost"
                size="icon"
                suppressHydrationWarning
                className="h-8 w-8 lg:h-10 lg:w-10"
              >
                <Menu className="h-4 w-4 lg:h-5 lg:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentUser && roles.length > 0 && (
                <>
                  <DropdownMenuItem onClick={() => setEditUserOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </>
              )}
              <div className="h-px bg-border my-1" />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                        isAdmin={isAdmin}
                        onEdit={canDelete ? handleEditGasStation : undefined}
                        onDelete={canDelete ? handleDeleteClick : undefined}
                        unreadNotificationCount={unreadNotificationCounts[spbu.id] || 0}
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


      {/* Edit Gas Station Form - ADMIN ONLY */}
      {/* Both UI check (isAdmin) and server-side permission check enforced */}
      {isAdmin && (
        <GasStationForm
          owners={owners}
          onSubmit={handleUpdateGasStation}
          isDeveloper={isDeveloper}
          userRole={userRole}
          ownerId={currentUser?.ownerId || null}
          open={editGasStationOpen}
          onOpenChange={(open) => {
            setEditGasStationOpen(open);
            if (!open) setSelectedGasStation(null);
          }}
          editData={
            selectedGasStation
              ? {
                  id: selectedGasStation.id,
                  name: selectedGasStation.name,
                  address: selectedGasStation.address,
                  latitude: selectedGasStation.latitude?.toString() ?? null,
                  longitude: selectedGasStation.longitude?.toString() ?? null,
                  ownerId: selectedGasStation.ownerId,
                  openTime: selectedGasStation.openTime,
                  closeTime: selectedGasStation.closeTime,
                  status: selectedGasStation.status,
                  managerCanPurchase: selectedGasStation.managerCanPurchase,
                  financeCanPurchase: selectedGasStation.financeCanPurchase,
                  hasTitipan: selectedGasStation.hasTitipan,
                  titipanNames: selectedGasStation.titipanNames,
                }
              : undefined
          }
        />
      )}

      {/* Edit User Form */}
      {currentUser && roles.length > 0 && (
        <UserForm
          roles={roles}
          open={editUserOpen}
          onOpenChange={setEditUserOpen}
          allowRoleChange={false} // Tidak bisa ubah role dari settings
          editData={{
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role, // Role enum string
            profile: currentUser.profile
              ? {
                  name: currentUser.profile.name,
                  phone: currentUser.profile.phone,
                  address: currentUser.profile.address,
                  avatar: currentUser.profile.avatar,
                }
              : null,
          }}
          trigger={null}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setGasStationToDelete(null);
            setConfirmName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Gas Station</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus semua data terkait (tanks, stations,
              products, transactions, dll) dan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Untuk konfirmasi, ketikkan nama SPBU yang akan dihapus:
              </p>
              <p className="text-sm font-semibold mb-3">
                {gasStationToDelete?.name}
              </p>
              <Input
                placeholder="Ketik nama SPBU di sini"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={isDeleting}
                className="text-sm"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    confirmName.trim() === gasStationToDelete?.name.trim()
                  ) {
                    handleDeleteConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setGasStationToDelete(null);
                setConfirmName("");
              }}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={
                isDeleting ||
                confirmName.trim() !== gasStationToDelete?.name.trim()
              }
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
