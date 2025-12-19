"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Container,
  Package,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyStart,
} from "lucide-react";
import { useSidebar } from "@/components/gas-stations/office/sidebar-context";
import { toast } from "sonner";
import { deleteTank, checkTankRelatedData } from "@/lib/actions/tank.actions";
import { deleteStation, checkStationRelatedData } from "@/lib/actions/station.actions";
import { deleteUser } from "@/lib/actions/user.actions";
import { deleteNozzle, checkNozzleRelatedData } from "@/lib/actions/nozzle.actions";
import { UserForm } from "@/components/reusable/form";
import { TankForm } from "@/components/gas-stations/office/admin/tank-form";
import { StationForm } from "@/components/gas-stations/office/admin/station-form";
import { NozzleForm } from "@/components/gas-stations/office/admin/nozzle-form";
import { StaffTabContent } from "@/components/gas-stations/office/admin/staff-tab-content";
import { InfrastructureTabContent } from "@/components/gas-stations/office/admin/infrastructure-tab-content";
import { ProductListSheet } from "@/components/gas-stations/office/admin/product-list-sheet";
import { createTank, updateTank } from "@/lib/actions/tank.actions";
import { createStation, updateStation } from "@/lib/actions/station.actions";
import { createNozzle, updateNozzle } from "@/lib/actions/nozzle.actions";
import type { OperationalDataForClient } from "@/lib/services/operational.service";
import type { ProductForClient } from "@/lib/services/product.service";

type SettingsDetailPanelProps = {
  gasStation: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    status: "ACTIVE" | "INACTIVE";
    ownerId: string;
    owner: {
      id: string;
      username: string;
      email: string;
      role?: string;
      profile?: {
        name: string;
        phone?: string | null;
      } | null;
    };
    openTime: string | null;
    closeTime: string | null;
    tanks?: OperationalDataForClient["tanks"];
    userActiveShiftInOtherStation?: {
      stationCode: string;
      stationName: string;
      gasStationName: string;
    } | null;
  };
  stations: OperationalDataForClient["stations"];
  staff: Array<{
    id: string;
    username: string;
    email: string;
    role: string; // Role enum: DEVELOPER, ADMINISTRATOR, OWNER, etc.
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  administrators?: Array<{
    id: string;
    username: string;
    email: string;
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  ownerGroups?: Array<{
    id: string;
    username: string;
    email: string;
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  products: ProductForClient[];
  roles: Array<
    | { value: string; label: string }
    | { id: string; name: string; code: string }
  >;
  currentUserRole?: string;
};

export function SettingsDetailPanel({
  gasStation,
  stations,
  staff,
  administrators = [],
  ownerGroups = [],
  products,
  roles,
  currentUserRole,
}: SettingsDetailPanelProps) {
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const tanks = gasStation.tanks || [];

  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [editTankOpen, setEditTankOpen] = useState(false);
  const [editStationOpen, setEditStationOpen] = useState(false);
  const [editNozzleOpen, setEditNozzleOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addTankOpen, setAddTankOpen] = useState(false);
  const [addStationOpen, setAddStationOpen] = useState(false);
  const [addNozzleOpen, setAddNozzleOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "staff" | "tank" | "station" | "nozzle";
    id: string;
    name: string;
  } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [relatedDataInfo, setRelatedDataInfo] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<
    (typeof staff)[number] | null
  >(null);
  const [selectedTank, setSelectedTank] = useState<
    (typeof tanks)[number] | null
  >(null);
  const [selectedStation, setSelectedStation] = useState<
    (typeof stations)[number] | null
  >(null);
  const [selectedNozzle, setSelectedNozzle] = useState<any | null>(null);

  const handleDeleteStaff = async (userId: string) => {
    const result = await deleteUser(userId);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleEditStaff = (user: (typeof staff)[number]) => {
    setSelectedStaff(user);
    setEditStaffOpen(true);
  };

  const handleEditTank = (tank: (typeof tanks)[number]) => {
    setSelectedTank(tank);
    setEditTankOpen(true);
  };

  const handleEditStation = (station: (typeof stations)[number]) => {
    setSelectedStation(station);
    setEditStationOpen(true);
  };

  const handleEditNozzle = (nozzle: any) => {
    setSelectedNozzle(nozzle);
    setEditNozzleOpen(true);
  };

  const handleDeleteTank = async (tankId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteTank(tankId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setConfirmName("");
        setRelatedDataInfo(null);
      } else {
        toast.error(result.message);
        // Dialog tetap terbuka dan tampilkan info data terkait
        if (result.data && typeof result.data === 'object' && 'relatedData' in result.data) {
          const relatedData = (result.data as any).relatedData;
          const info = `Tank ini memiliki data terkait:\n` +
            `- ${relatedData.nozzles || 0} Nozzle\n` +
            `- ${relatedData.unloads || 0} Unload\n` +
            `${relatedData.hasTankReadings ? "- TankReading\n" : ""}` +
            `${relatedData.hasNozzleReadings ? "- NozzleReading\n" : ""}` +
            `\n⚠️ Penghapusan diblokir untuk mencegah kehilangan data.`;
          setRelatedDataInfo(info);
        }
      }
    } catch (error) {
      toast.error("Gagal menghapus tank");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteStation = async (stationId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteStation(stationId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setConfirmName("");
        setRelatedDataInfo(null);
      } else {
        toast.error(result.message);
        // Dialog tetap terbuka dan tampilkan info data terkait
        if (result.data && typeof result.data === 'object' && 'relatedData' in result.data) {
          const relatedData = (result.data as any).relatedData;
          const info = `Station ini memiliki data terkait:\n` +
            `- ${relatedData.nozzles || 0} Nozzle\n` +
            `${relatedData.hasOperatorShifts ? "- OperatorShift\n" : ""}` +
            `${relatedData.hasNozzleReadings ? "- NozzleReading\n" : ""}` +
            `\n⚠️ Penghapusan diblokir untuk mencegah kehilangan data.`;
          setRelatedDataInfo(info);
        }
      }
    } catch (error) {
      toast.error("Gagal menghapus station");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteNozzle = async (nozzleId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteNozzle(nozzleId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setConfirmName("");
        setRelatedDataInfo(null);
      } else {
        toast.error(result.message);
        // Dialog tetap terbuka dan tampilkan info data terkait
        // Note: Nozzle menggunakan soft delete jika ada data, jadi biasanya tidak akan error
        // Tapi tetap handle jika ada error lain
      }
    } catch (error) {
      toast.error("Gagal menghapus nozzle");
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = async (
    type: "staff" | "tank" | "station" | "nozzle",
    id: string,
    name: string
  ) => {
    setDeleteTarget({ type, id, name });
    setConfirmName("");
    setRelatedDataInfo(null);
    setDeleteDialogOpen(true);

    // Check related data untuk tank, station, dan nozzle
    if (type !== "staff") {
      try {
        let result;
        if (type === "tank") {
          result = await checkTankRelatedData(id);
        } else if (type === "station") {
          result = await checkStationRelatedData(id);
        } else {
          result = await checkNozzleRelatedData(id);
        }

        if (result.success && result.data) {
          const data = result.data as any;
          if (data.hasImportantData && data.relatedData) {
            const relatedData = data.relatedData;
            let info = "";
            if (type === "tank") {
              info = `Tank ini memiliki data terkait:\n` +
                `- ${relatedData.nozzles || 0} Nozzle\n` +
                `- ${relatedData.unloads || 0} Unload\n` +
                `${relatedData.hasTankReadings ? "- TankReading\n" : ""}` +
                `${relatedData.hasNozzleReadings ? "- NozzleReading\n" : ""}` +
                `\n⚠️ Penghapusan akan diblokir untuk mencegah kehilangan data.`;
            } else if (type === "station") {
              info = `Station ini memiliki data terkait:\n` +
                `- ${relatedData.nozzles || 0} Nozzle\n` +
                `${relatedData.hasOperatorShifts ? "- OperatorShift\n" : ""}` +
                `${relatedData.hasNozzleReadings ? "- NozzleReading\n" : ""}` +
                `\n⚠️ Penghapusan akan diblokir untuk mencegah kehilangan data.`;
            } else {
              info = `Nozzle ini memiliki data terkait:\n` +
                `- ${relatedData.nozzleReadings || 0} NozzleReading\n` +
                `- ${relatedData.pendingShifts || 0} Pending Shift\n` +
                `- ${relatedData.pendingDeposits || 0} Pending Deposit\n` +
                `- ${relatedData.completedShifts || 0} Completed Shift\n` +
                `\n⚠️ Nozzle akan di-soft delete untuk menjaga data historis.`;
            }
            setRelatedDataInfo(info);
          }
        }
      } catch (error) {
        console.error("Error checking related data:", error);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    // Validasi nama harus sesuai untuk tank, station, dan nozzle
    if (deleteTarget.type !== "staff") {
      if (confirmName.trim() !== deleteTarget.name.trim()) {
        toast.error(`Nama ${deleteTarget.type === "tank" ? "Tank" : deleteTarget.type === "station" ? "Station" : "Nozzle"} tidak sesuai`);
        return;
      }
    }

    switch (deleteTarget.type) {
      case "staff":
        await handleDeleteStaff(deleteTarget.id);
        break;
      case "tank":
        await handleDeleteTank(deleteTarget.id);
        break;
      case "station":
        await handleDeleteStation(deleteTarget.id);
        break;
      case "nozzle":
        await handleDeleteNozzle(deleteTarget.id);
        break;
    }
  };

  const handleCreateTank = async (data: any) => {
    const result = await createTank(data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setAddTankOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleUpdateTank = async (data: any) => {
    if (!selectedTank) return;
    const result = await updateTank(selectedTank.id, data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setEditTankOpen(false);
      setSelectedTank(null);
    } else {
      toast.error(result.message);
    }
  };

  const handleCreateStation = async (data: any) => {
    const result = await createStation(data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setAddStationOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleUpdateStation = async (data: any) => {
    if (!selectedStation) return;
    const result = await updateStation(selectedStation.id, data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setEditStationOpen(false);
      setSelectedStation(null);
    } else {
      toast.error(result.message);
    }
  };

  const handleCreateNozzle = async (data: any) => {
    const result = await createNozzle(data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setAddNozzleOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleUpdateNozzle = async (data: any) => {
    if (!selectedNozzle) return;
    const result = await updateNozzle(selectedNozzle.id, data);
    if (result.success) {
      toast.success(result.message);
      router.refresh();
      setEditNozzleOpen(false);
      setSelectedNozzle(null);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-2 lg:px-6 py-2 lg:py-4 border-b flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 lg:h-8 lg:w-8 shrink-0"
          >
            {sidebarOpen ? (
              <AlignHorizontalJustifyStart className="h-6 w-6 lg:h-10 lg:w-10" />
            ) : (
              <AlignHorizontalJustifyCenter className="h-6 w-6 lg:h-10 lg:w-10" />
            )}
          </Button>
          <div className="text-right pr-2 md:pr-4">
            <h2 className="text-base lg:text-xl font-semibold">
              Admin Dashboard
            </h2>
          </div>
        </div>

        <div className="flex-1">
          <Tabs defaultValue="staff" className="h-full flex flex-col">
            <div className="px-2 lg:px-6 pt-2 lg:pt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="staff"
                  className="gap-1 lg:gap-2 text-xs lg:text-sm"
                >
                  <Users className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                  <span className={sidebarOpen ? "hidden lg:inline" : "inline"}>
                    Staff & Users
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="infrastructure"
                  className="gap-1 lg:gap-2 text-xs lg:text-sm"
                >
                  <Container className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                  <span className={sidebarOpen ? "hidden lg:inline" : "inline"}>
                    Infrastructure
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="products"
                  className="gap-1 lg:gap-2 text-xs lg:text-sm"
                >
                  <Package className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                  <span className={sidebarOpen ? "hidden lg:inline" : "inline"}>
                    Produk
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1">
              <TabsContent
                value="staff"
                className="mt-0 px-2 lg:px-6 pb-2 lg:pb-6"
              >
                <StaffTabContent
                  gasStation={gasStation}
                  staff={staff}
                  administrators={administrators}
                  ownerGroups={ownerGroups}
                  onAddStaff={() => setAddStaffOpen(true)}
                  onEditStaff={handleEditStaff}
                  onDeleteStaff={(id, name) => confirmDelete("staff", id, name)}
                />
              </TabsContent>

              <TabsContent
                value="infrastructure"
                className="mt-0 px-2 lg:px-6 pb-2 lg:pb-6"
              >
                <InfrastructureTabContent
                  tanks={tanks}
                  stations={stations}
                  onAddTank={() => setAddTankOpen(true)}
                  onEditTank={handleEditTank}
                  onDeleteTank={(id, name) => confirmDelete("tank", id, name)}
                  onAddStation={() => setAddStationOpen(true)}
                  onEditStation={handleEditStation}
                  onDeleteStation={(id, name) =>
                    confirmDelete("station", id, name)
                  }
                  onAddNozzle={() => setAddNozzleOpen(true)}
                  onEditNozzle={handleEditNozzle}
                  onDeleteNozzle={(id, name) =>
                    confirmDelete("nozzle", id, name)
                  }
                />
              </TabsContent>

              <TabsContent value="products" className="mt-0 p-0 h-full">
                <ProductListSheet
                  open={true}
                  onOpenChange={() => {}}
                  gasStationId={gasStation.id}
                  products={products}
                  inline={true}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
            setConfirmName("");
            setRelatedDataInfo(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Konfirmasi Hapus {deleteTarget?.type === "tank" ? "Tank" : deleteTarget?.type === "station" ? "Station" : deleteTarget?.type === "nozzle" ? "Nozzle" : "Staff"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type !== "staff" ? (
                <>
                  Tindakan ini akan menghapus{" "}
                  <span className="font-semibold">{deleteTarget?.name}</span> dan data terkait.
                  Tindakan ini tidak dapat dibatalkan.
                </>
              ) : (
                <>
                  Yakin ingin menghapus{" "}
                  <span className="font-semibold">{deleteTarget?.name}</span>?
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.type !== "staff" && (
            <div className="space-y-4 py-4">
              {relatedDataInfo && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  <div className="font-semibold mb-2">⚠️ Peringatan:</div>
                  <pre className="whitespace-pre-wrap text-xs">{relatedDataInfo}</pre>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Untuk konfirmasi, ketikkan nama {deleteTarget?.type === "tank" ? "Tank" : deleteTarget?.type === "station" ? "Station" : "Nozzle"} yang akan dihapus:
                </p>
                <p className="text-sm font-semibold mb-3">
                  {deleteTarget?.name}
                </p>
                <Input
                  placeholder={`Ketik nama ${deleteTarget?.type === "tank" ? "Tank" : deleteTarget?.type === "station" ? "Station" : "Nozzle"} di sini`}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  disabled={isDeleting}
                  className="text-sm"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      confirmName.trim() === deleteTarget?.name.trim()
                    ) {
                      handleConfirmDelete();
                    }
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
                setConfirmName("");
                setRelatedDataInfo(null);
              }}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={
                isDeleting ||
                (deleteTarget?.type !== "staff" &&
                  confirmName.trim() !== deleteTarget?.name.trim())
              }
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Forms */}
      {selectedStaff && editStaffOpen && (
        <UserForm
          trigger={null}
          roles={roles}
          gasStationId={gasStation.id}
          open={editStaffOpen}
          onOpenChange={(open) => {
            setEditStaffOpen(open);
            if (!open) setSelectedStaff(null);
          }}
          staffOnly={true}
          allowRoleChange={false} // Tidak bisa ubah role dari settings
          currentUserRole={currentUserRole}
          editData={{
            id: selectedStaff.id,
            username: selectedStaff.username,
            email: selectedStaff.email,
            role: selectedStaff.role, // Role enum string
            profile: selectedStaff.profile
              ? {
                  name: selectedStaff.profile.name,
                  phone: selectedStaff.profile.phone || null,
                  address: null,
                  avatar: null,
                }
              : null,
          }}
        />
      )}

      {/* Add Staff Form */}
      <UserForm
        trigger={null}
        roles={roles}
        gasStationId={gasStation.id}
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        staffOnly={true}
        currentUserRole={currentUserRole}
      />

      {/* Tank Forms */}
      <TankForm
        gasStationId={gasStation.id}
        gasStationName={gasStation.name}
        products={products}
        onSubmit={handleCreateTank}
        open={addTankOpen}
        onOpenChange={setAddTankOpen}
      />

      {selectedTank && editTankOpen && (
        <TankForm
          gasStationId={gasStation.id}
          gasStationName={gasStation.name}
          products={products}
          onSubmit={handleUpdateTank}
          open={editTankOpen}
          onOpenChange={(open) => {
            setEditTankOpen(open);
            if (!open) setSelectedTank(null);
          }}
          editData={{
            id: selectedTank.id,
            code: selectedTank.code,
            name: selectedTank.name,
            capacity: selectedTank.capacity,
            initialStock: selectedTank.initialStock,
            gasStationId: gasStation.id,
            productId: selectedTank.product.id,
          }}
        />
      )}

      {/* Station Forms */}
      <StationForm
        gasStationId={gasStation.id}
        tanks={tanks.map((tank) => ({
          id: tank.id,
          name: tank.name,
          code: tank.code,
          product: { name: tank.product.name },
        }))}
        onSubmit={handleCreateStation}
        open={addStationOpen}
        onOpenChange={setAddStationOpen}
      />

      {selectedStation && editStationOpen && (
        <StationForm
          gasStationId={gasStation.id}
          tanks={tanks.map((tank) => ({
            id: tank.id,
            name: tank.name,
            code: tank.code,
            product: { name: tank.product.name },
          }))}
          onSubmit={handleUpdateStation}
          open={editStationOpen}
          onOpenChange={(open) => {
            setEditStationOpen(open);
            if (!open) setSelectedStation(null);
          }}
          editData={{
            id: selectedStation.id,
            code: selectedStation.code,
            name: selectedStation.name,
            gasStationId: gasStation.id,
            tankIds: selectedStation.tankConnections.map((tc) => tc.tankId),
          }}
        />
      )}

      {/* Nozzle Forms */}
      <NozzleForm
        stations={stations}
        products={products}
        onSubmit={handleCreateNozzle}
        open={addNozzleOpen}
        onOpenChange={setAddNozzleOpen}
      />

      {selectedNozzle && editNozzleOpen && (
        <NozzleForm
          stations={stations}
          products={products}
          onSubmit={handleUpdateNozzle}
          open={editNozzleOpen}
          onOpenChange={(open) => {
            setEditNozzleOpen(open);
            if (!open) setSelectedNozzle(null);
          }}
          editData={{
            id: selectedNozzle.id,
            code: selectedNozzle.code,
            stationId: selectedNozzle.stationId,
            tankId: selectedNozzle.tankId,
          }}
        />
      )}
    </>
  );
}
