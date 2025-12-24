import { notFound } from "next/navigation";
import { MockDataService } from "@/lib/utils/mock-data";
import { GasStationClient } from "./client";
import type { RoleCode } from "@/lib/utils/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GasStationPage({ params }: PageProps) {
  const { id } = await params;

  // Demo mode: hanya spbu-001 yang bisa dibuka
  if (id !== "spbu-001") {
    notFound();
  }

  const gasStation = MockDataService.getGasStationById(id);
  if (!gasStation) {
    notFound();
  }

  const products = MockDataService.getProducts(id);
  const tanks = MockDataService.getTanks(id);
  const stations = MockDataService.getStations(id);
  const nozzles = MockDataService.getNozzles(id);

  // Transform mock data to match expected types
  const gasStationDetail = {
    gasStation: {
      id: gasStation.id,
      name: gasStation.name,
      address: gasStation.address,
      latitude: gasStation.latitude,
      longitude: gasStation.longitude,
      openTime: gasStation.openTime,
      closeTime: gasStation.closeTime,
      status: gasStation.status,
      financeCanPurchase: false,
      managerCanPurchase: false,
    },
    stations: stations.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      gasStationId: s.gasStationId,
    })),
    staff: [],
    administrators: [],
    ownerGroups: [],
  };

  const operationalData = {
    stations: stations.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      gasStationId: s.gasStationId,
      tanks: tanks
        .filter((t) => s.tanks.includes(t.id))
        .map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          productId: t.productId,
          capacity: t.capacity,
          currentStock: t.currentStock || 0,
          product: {
            name: t.product.name,
            sellingPrice: t.product.sellingPrice,
          },
        })),
      nozzles: nozzles
        .filter((n) => n.stationId === s.id)
        .map((n) => ({
          id: n.id,
          code: n.code,
          name: n.name,
          tankId: n.tankId,
          productId: n.productId,
          product: {
            name: n.product.name,
            sellingPrice: n.product.sellingPrice,
          },
        })),
      tankConnections: tanks
        .filter((t) => s.tanks.includes(t.id))
        .map((t) => ({
          id: `connection-${t.id}`,
          tank: {
            code: t.code,
            product: {
              name: t.product.name,
            },
          },
        })),
    })),
    gasStation: {
      openTime: gasStation.openTime,
      closeTime: gasStation.closeTime,
      userActiveShiftInOtherStation: null,
    },
  };

  const tanksWithStock = tanks.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    capacity: t.capacity,
    currentStock: t.currentStock || 0,
    product: {
      id: t.productId,
      name: t.product.name,
      sellingPrice: t.product.sellingPrice,
    },
  }));

  return (
    <GasStationClient
      gasStationDetail={gasStationDetail as any}
      operationalData={operationalData as any}
      userRole="OWNER" as RoleCode
      userId="demo-user"
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        ron: p.ron,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        gasStationId: p.gasStationId,
      }))}
      unloads={[]}
      pendingUnloadCount={0}
      pendingDepositsCountForFinance={0}
      pendingDepositsCountForManager={0}
      shiftVerificationCount={0}
      pendingCashTransactionCount={0}
      pendingTransactionsCount={0}
      pendingTankReadingsCount={0}
      tanksWithStock={tanksWithStock as any}
      roles={[]}
      operators={[]}
    />
  );
}

