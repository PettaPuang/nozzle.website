"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StockLOTable } from "./stock-lo-table";
import { DraftPurchaseTable } from "./draft-purchase-table";
import { PurchaseHistoryTable } from "./purchase-history-table";
import { OwnerReportSummary } from "@/components/welcome/owner-report-summary";
import { executePurchaseTransactions } from "@/lib/actions/purchase.actions";
import { toast } from "sonner";
import { LoadingPage } from "@/components/reusable/loading-page";
import { hasPermission } from "@/lib/utils/permissions";
import type { RoleCode } from "@/lib/utils/permissions";
import { startOfDayUTC, nowUTC } from "@/lib/utils/datetime";

type LODataItem = {
  gasStationId: string;
  gasStationName: string;
  address: string;
  cashBalance: number;
  bankBalance: number;
  products: Array<{
    productId: string;
    productName: string;
    purchasePrice: number;
    tanks: Array<{
      code: string;
      name: string;
      stock: number;
      volume: number;
    }>;
    totalStock: number;
    totalVolume: number;
    totalPurchase: number;
    totalDelivered: number;
    totalLO: number;
    latestPurchaseVolume: number;
  }>;
};

type DraftPurchase = {
  gasStationId: string;
  productId: string;
  purchaseVolume: number;
};

type PurchaseTransaction = {
  id: string;
  date: Date;
  description: string;
  referenceNumber: string | null;
  gasStationId: string;
  gasStationName: string;
  productName: string | null;
  purchaseVolume: number;
  deliveredVolume: number;
  remainingVolume: number;
  totalValue: number;
};

type OwnerGroupDashboardProps = {
  ownerId?: string;
  userRole?: string;
  gasStationId?: string;
};

export function OwnerGroupDashboard({
  ownerId: propOwnerId,
  userRole,
  gasStationId,
}: OwnerGroupDashboardProps) {
  const router = useRouter();
  const [loData, setLoData] = useState<LODataItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseTransaction[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(propOwnerId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftPurchases, setDraftPurchases] = useState<DraftPurchase[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  // Default tab: jika tidak bisa akses report, selalu stock
  const canAccessReport = hasPermission(userRole as RoleCode, ["OWNER", "OWNER_GROUP", "DEVELOPER", "ADMINISTRATOR"]);
  const [activeTab, setActiveTab] = useState<"stock" | "report">(canAccessReport ? "stock" : "stock");

  // CRITICAL: Prioritize propOwnerId dari URL, jangan di-overwrite oleh ownerId dari loData
  useEffect(() => {
    if (propOwnerId) {
      setOwnerId(propOwnerId);
    }
  }, [propOwnerId]);

  useEffect(() => {
    if (ownerId) {
      fetchData();
    }
  }, [ownerId]);

  const fetchData = async () => {
    if (!ownerId) return; // Jangan fetch jika ownerId tidak ada

    setLoading(true);
    setError(null);
    try {
      const queryParams = `?ownerId=${ownerId}`;
      const [loResult, purchaseResult] = await Promise.all([
        fetch(`/api/ownergroup/lo-data${queryParams}`),
        fetch(`/api/ownergroup/purchase-transactions${queryParams}`),
      ]);

      const loJson = await loResult.json();
      const purchaseJson = await purchaseResult.json();

      // Process LO data
      if (loJson.success && loJson.data) {
        const loDataResult = loJson.data as {
          loData?: LODataItem[];
          ownerName?: string | null;
          ownerId?: string | null;
        };

        // Set LO data
        if (loDataResult.loData) {
          setLoData(loDataResult.loData);
        }

        // CRITICAL: Set ownerName dari loData (ini harus sesuai dengan ownerId yang dikirim)
        // ownerName dari loData adalah yang benar karena sudah di-query berdasarkan ownerId yang dikirim
        if (loDataResult.ownerName) {
          setOwnerName(loDataResult.ownerName);
        }

        // CRITICAL: JANGAN overwrite ownerId dari propOwnerId (URL)
        // ownerId dari URL adalah source of truth, jangan diubah oleh response loData
        // Hanya set ownerId jika propOwnerId tidak ada (untuk backward compatibility)
        if (!propOwnerId && loDataResult.ownerId) {
          setOwnerId(loDataResult.ownerId);
        } else if (
          propOwnerId &&
          loDataResult.ownerId &&
          propOwnerId !== loDataResult.ownerId
        ) {
          // Validasi: jika ownerId dari URL berbeda dengan ownerId dari response, ada masalah
          console.warn(
            `OwnerId mismatch: URL=${propOwnerId}, Response=${loDataResult.ownerId}`
          );
          setError("OwnerId tidak sesuai dengan data yang dikembalikan");
        }
      } else {
        setError(loJson.message || "Gagal mengambil data LO");
      }

      // Process purchase data
      if (purchaseJson.success && purchaseJson.data) {
        const purchaseResult = purchaseJson.data as {
          purchases?: PurchaseTransaction[];
          ownerName?: string | null;
        };

        // Set purchase data
        if (purchaseResult.purchases) {
          setPurchases(purchaseResult.purchases);
        }

        // CRITICAL: Update ownerName dari purchase hanya jika belum di-set dari loData
        // ownerName dari loData adalah yang benar karena sudah di-query berdasarkan ownerId yang dikirim
        if (!ownerName && purchaseResult.ownerName) {
          setOwnerName(purchaseResult.ownerName);
        }
      } else {
        setError(purchaseJson.message || "Gagal mengambil data pembelian");
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleDraftChange = (draft: DraftPurchase | null) => {
    if (!draft) return;

    setDraftPurchases((prev) => {
      const existing = prev.findIndex(
        (d) =>
          d.gasStationId === draft.gasStationId &&
          d.productId === draft.productId
      );
      if (existing >= 0) {
        if (draft.purchaseVolume > 0) {
          const updated = [...prev];
          updated[existing] = draft;
          return updated;
        } else {
          // Remove jika volume 0
          return prev.filter((_, idx) => idx !== existing);
        }
      }
      if (draft.purchaseVolume > 0) {
        return [...prev, draft];
      }
      return prev;
    });
  };

  const handleExecutePurchases = async () => {
    if (draftPurchases.length === 0) {
      toast.error("Tidak ada draft untuk dieksekusi");
      return;
    }

    setIsExecuting(true);
    try {
      // Prepare purchases dengan date hari ini (UTC)
      const purchasesToExecute = draftPurchases.map((draft) => {
        const product = loData
          .flatMap((gs) => gs.products)
          .find((p) => p.productId === draft.productId);

        return {
          gasStationId: draft.gasStationId,
          productId: draft.productId,
          purchaseVolume: draft.purchaseVolume,
          date: startOfDayUTC(nowUTC()),
          bankName: null,
          referenceNumber: null,
          notes: null,
        };
      });

      const result = await executePurchaseTransactions(purchasesToExecute);

      if (result.success) {
        toast.success(result.message);
        setDraftPurchases([]);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Execute purchases error:", error);
      toast.error(error.message || "Gagal mengeksekusi pembelian");
    } finally {
      setIsExecuting(false);
    }
  };

  if (loading) {
    return <LoadingPage variant="full" />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3 lg:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Untuk MANAGER dan FINANCE, kembali ke office tab di gas station mereka
            if ((userRole === "MANAGER" || userRole === "FINANCE") && gasStationId) {
              router.push(`/gas-stations/${gasStationId}?tab=management`);
            } else {
              router.push("/welcome");
            }
          }}
          className="h-8 lg:h-9 px-2 lg:px-3"
        >
          <ArrowLeft className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
          <span className="text-xs lg:text-sm">Kembali</span>
        </Button>
        <div className="text-right">
          <h1 className="text-xl lg:text-2xl font-bold">
            Dashboard Group {ownerName ? `"${ownerName}"` : ""}
          </h1>
        </div>
      </div>

      {canAccessReport ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "stock" | "report")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="stock"
              className="gap-1 lg:gap-2 text-xs lg:text-sm"
            >
              <Package className="h-3 w-3 lg:h-4 lg:w-4" />
              Stock & Purchase
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="gap-1 lg:gap-2 text-xs lg:text-sm"
            >
              <FileText className="h-3 w-3 lg:h-4 lg:w-4" />
              Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4 space-y-4 lg:space-y-6">
          {/* Table 1: Stock & LO Control */}
          <StockLOTable
            loData={loData}
            draftPurchases={draftPurchases}
            onDraftChange={handleDraftChange}
          />

          {/* Table 2: List Pembelian BBM (Draft) */}
          <DraftPurchaseTable
            draftPurchases={draftPurchases}
            loData={loData}
            isExecuting={isExecuting}
            onExecute={handleExecutePurchases}
            onResetDraft={() => setDraftPurchases([])}
          />

          {/* Table 3: History Pembelian BBM */}
          <PurchaseHistoryTable purchases={purchases} loData={loData} />
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          {ownerId ? (
            <OwnerReportSummary
              ownerId={ownerId}
              key={ownerId} // Force re-render ketika ownerId berubah untuk memastikan report hanya untuk owner ini
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-xs lg:text-sm text-muted-foreground">
                Report tidak tersedia untuk user ini
              </div>
            </div>
          )}
        </TabsContent>
        </Tabs>
      ) : (
        // Untuk MANAGER dan FINANCE, langsung tampilkan Stock & Purchase tanpa tab switcher
        <div className="mt-4 space-y-4 lg:space-y-6">
          {/* Table 1: Stock & LO Control */}
          <StockLOTable
            loData={loData}
            draftPurchases={draftPurchases}
            onDraftChange={handleDraftChange}
          />

          {/* Table 2: List Pembelian BBM (Draft) */}
          <DraftPurchaseTable
            draftPurchases={draftPurchases}
            loData={loData}
            isExecuting={isExecuting}
            onExecute={handleExecutePurchases}
            onResetDraft={() => setDraftPurchases([])}
          />

          {/* Table 3: History Pembelian BBM */}
          <PurchaseHistoryTable purchases={purchases} loData={loData} />
        </div>
      )}
    </div>
  );
}
