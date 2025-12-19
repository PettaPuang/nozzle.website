"use client";

import { useState } from "react";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/format-client";
import { Loader2 } from "lucide-react";
import { ProductBadge } from "@/components/reusable/badges/product-badge";

type DraftPurchase = {
  gasStationId: string;
  productId: string;
  purchaseVolume: number;
};

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
  }>;
};

type DraftPurchaseTableProps = {
  draftPurchases: DraftPurchase[];
  loData: LODataItem[];
  isExecuting: boolean;
  onExecute: () => void;
  onResetDraft: () => void;
};

export function DraftPurchaseTable({
  draftPurchases,
  loData,
  isExecuting,
  onExecute,
  onResetDraft,
}: DraftPurchaseTableProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Get all unique products from loData and sort them
  const getAllProducts = () => {
    const productMap = new Map<
      string,
      { productId: string; productName: string }
    >();

    loData.forEach((gasStation) => {
      gasStation.products.forEach((product) => {
        if (!productMap.has(product.productName)) {
          productMap.set(product.productName, {
            productId: product.productId,
            productName: product.productName,
          });
        }
      });
    });

    // Custom sort order
    const order = ["pertalite", "pertamax", "turbo", "solar", "dexlite", "dex"];

    return Array.from(productMap.values()).sort((a, b) => {
      const findIndex = (productName: string) => {
        const lower = productName.toLowerCase();
        if (lower.includes("turbo")) return order.indexOf("turbo");
        return order.findIndex((name) => lower.includes(name));
      };

      const aIndex = findIndex(a.productName);
      const bIndex = findIndex(b.productName);

      if (aIndex === -1 && bIndex === -1)
        return a.productName.localeCompare(b.productName);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  };

  const allProducts = getAllProducts();

  // Group draft purchases by gas station
  const draftByGasStation = new Map<string, DraftPurchase[]>();
  draftPurchases.forEach((draft) => {
    if (!draftByGasStation.has(draft.gasStationId)) {
      draftByGasStation.set(draft.gasStationId, []);
    }
    draftByGasStation.get(draft.gasStationId)!.push(draft);
  });

  // Calculate total value per gas station (draft only)
  const calculateTotalValue = (
    gasStationId: string,
    drafts: DraftPurchase[]
  ) => {
    let total = 0;
    drafts.forEach((draft) => {
      const gasStation = loData.find((gs) => gs.gasStationId === gasStationId);
      if (gasStation) {
        const product = gasStation.products.find(
          (p) => p.productId === draft.productId
        );
        if (product) {
          total += draft.purchaseVolume * product.purchasePrice;
        }
      }
    });
    return total;
  };

  // Get product volume and value for gas station (draft only)
  const getProductData = (
    gasStationId: string,
    productId: string
  ): { volume: number; value: number } => {
    const gasStation = loData.find((gs) => gs.gasStationId === gasStationId);
    if (!gasStation) return { volume: 0, value: 0 };

    const product = gasStation.products.find((p) => p.productId === productId);
    if (!product) return { volume: 0, value: 0 };

    let volume = 0;
    let value = 0;

    // Draft purchases only
    const drafts = draftByGasStation.get(gasStationId) || [];
    const draft = drafts.find((d) => d.productId === productId);
    if (draft) {
      volume += draft.purchaseVolume;
      value += draft.purchaseVolume * product.purchasePrice;
    }

    return { volume, value };
  };

  // Get product names for draft (untuk dialog konfirmasi)
  const getProductNames = (gasStationId: string, drafts: DraftPurchase[]) => {
    const gasStation = loData.find((gs) => gs.gasStationId === gasStationId);
    if (!gasStation) return [];

    return drafts
      .map((draft) => {
        const product = gasStation.products.find(
          (p) => p.productId === draft.productId
        );
        return product
          ? `${product.productName} (${draft.purchaseVolume.toLocaleString(
              "id-ID"
            )} L)`
          : "";
      })
      .filter(Boolean);
  };

  const hasDrafts = draftPurchases.length > 0;

  const handleExecuteClick = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmExecute = () => {
    setConfirmDialogOpen(false);
    onExecute();
  };

  // Calculate total value for all drafts
  const calculateTotalAllValue = () => {
    let total = 0;
    draftPurchases.forEach((draft) => {
      const gasStation = loData.find(
        (gs) => gs.gasStationId === draft.gasStationId
      );
      if (gasStation) {
        const product = gasStation.products.find(
          (p) => p.productId === draft.productId
        );
        if (product) {
          total += draft.purchaseVolume * product.purchasePrice;
        }
      }
    });
    return total;
  };

  if (!hasDrafts) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg">
            List Pembelian BBM
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetDraft}
              disabled={isExecuting}
              className="text-xs lg:text-sm"
            >
              Reset Draft
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteClick}
              disabled={isExecuting}
              className="text-xs lg:text-sm"
            >
              Eksekusi Pembelian ({draftPurchases.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs lg:text-sm w-[150px] min-w-[150px] sticky left-0 z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                  SPBU
                </TableHead>
                {allProducts.map((product) => (
                  <TableHead
                    key={product.productId}
                    className="text-xs lg:text-sm text-center w-[120px] min-w-[120px]"
                  >
                    <ProductBadge productName={product.productName} />
                  </TableHead>
                ))}
                <TableHead className="text-xs lg:text-sm text-right w-[120px] min-w-[120px]">
                  Saldo Bank
                </TableHead>
                <TableHead className="text-xs lg:text-sm text-right w-[150px] min-w-[150px]">
                  Nilai Total Pembelian
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loData
                .filter((gs) => {
                  const hasDraft = draftByGasStation.has(gs.gasStationId);
                  return hasDraft;
                })
                .map((gasStation) => {
                  const drafts =
                    draftByGasStation.get(gasStation.gasStationId) || [];
                  const draftTotalValue = calculateTotalValue(
                    gasStation.gasStationId,
                    drafts
                  );

                  return (
                    <React.Fragment key={gasStation.gasStationId}>
                      {/* Gas station row - one row per SPBU */}
                      <TableRow className="bg-blue-50">
                        <TableCell className="text-xs lg:text-sm font-medium sticky left-0 z-10 bg-blue-50 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                          {gasStation.gasStationName}
                        </TableCell>
                        {allProducts.map((product) => {
                          const productData = getProductData(
                            gasStation.gasStationId,
                            product.productId
                          );
                          return (
                            <TableCell
                              key={product.productId}
                              className="text-xs lg:text-sm border-r"
                            >
                              {productData.volume > 0 ||
                              productData.value > 0 ? (
                                <div className="flex flex-col items-end gap-1 py-1">
                                  <div className="font-mono font-semibold text-xs lg:text-sm">
                                    {productData.volume > 0
                                      ? `${productData.volume.toLocaleString(
                                          "id-ID"
                                        )} L`
                                      : ""}
                                  </div>
                                  <div className="font-mono text-xs lg:text-sm text-muted-foreground">
                                    {productData.value > 0
                                      ? formatCurrency(productData.value)
                                      : ""}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground">
                                  -
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-xs lg:text-sm text-right font-mono border-r">
                          {formatCurrency(gasStation.bankBalance)}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm text-right font-mono font-semibold">
                          {formatCurrency(draftTotalValue)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent showCloseButton={!isExecuting}>
          <DialogHeader>
            <DialogTitle>Konfirmasi Eksekusi Pembelian</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengeksekusi {draftPurchases.length}{" "}
              pembelian berikut?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 lg:space-y-4 max-h-[400px] overflow-y-auto">
            {Array.from(draftByGasStation.entries()).map(
              ([gasStationId, drafts]) => {
                const gasStation = loData.find(
                  (gs) => gs.gasStationId === gasStationId
                );
                if (!gasStation) return null;

                const totalValue = calculateTotalValue(gasStationId, drafts);
                const productNames = getProductNames(gasStationId, drafts);

                return (
                  <div
                    key={gasStationId}
                    className="rounded-lg bg-gray-50 border border-gray-200 p-3 lg:p-4 space-y-2"
                  >
                    <div className="font-semibold text-xs lg:text-sm">
                      {gasStation.gasStationName}
                    </div>
                    <div className="space-y-1">
                      {productNames.map((name, idx) => (
                        <div
                          key={idx}
                          className="text-xs lg:text-sm text-muted-foreground"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-xs lg:text-sm text-muted-foreground">
                        Total Nilai:
                      </span>
                      <span className="text-xs lg:text-sm font-mono font-semibold">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 lg:p-4">
              <div className="flex justify-between items-center">
                <span className="text-xs lg:text-sm font-semibold text-blue-900">
                  Total Semua Pembelian:
                </span>
                <span className="text-xs lg:text-sm font-mono font-bold text-blue-900">
                  {formatCurrency(calculateTotalAllValue())}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={isExecuting}
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmExecute}
              disabled={isExecuting}
              className="text-xs lg:text-sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                  Mengeksekusi...
                </>
              ) : (
                "Ya, Eksekusi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
