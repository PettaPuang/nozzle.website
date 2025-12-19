"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatCurrency,
  formatNumber,
  parseFormattedNumber,
} from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { TankCard } from "@/components/gas-stations/tank/tank-card";
import { Loader2 } from "lucide-react";
import type { TankWithStock } from "@/lib/services/operational.service";

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

type StockLOTableProps = {
  loData: LODataItem[];
  draftPurchases: DraftPurchase[];
  onDraftChange: (draft: DraftPurchase | null) => void;
};

export function StockLOTable({
  loData,
  draftPurchases,
  onDraftChange,
}: StockLOTableProps) {
  const [expandedGasStations, setExpandedGasStations] = useState<Set<string>>(
    new Set()
  );
  const [tanksData, setTanksData] = useState<Record<string, TankWithStock[]>>(
    {}
  );
  const [loadingTanks, setLoadingTanks] = useState<Set<string>>(new Set());

  const getDraftValue = (gasStationId: string, productId: string): number => {
    const draft = draftPurchases.find(
      (d) => d.gasStationId === gasStationId && d.productId === productId
    );
    return draft?.purchaseVolume || 0;
  };

  const handleDraftInput = (
    gasStationId: string,
    productId: string,
    value: string
  ) => {
    const numValue = parseFormattedNumber(value);
    onDraftChange({
      gasStationId,
      productId,
      purchaseVolume: numValue,
    });
  };

  const handleGasStationClick = async (gasStationId: string) => {
    const isExpanded = expandedGasStations.has(gasStationId);

    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedGasStations);
      newExpanded.delete(gasStationId);
      setExpandedGasStations(newExpanded);
    } else {
      // Expand - fetch tanks if not already fetched
      setExpandedGasStations(new Set(expandedGasStations).add(gasStationId));

      if (!tanksData[gasStationId]) {
        setLoadingTanks(new Set(loadingTanks).add(gasStationId));
        try {
          const response = await fetch(
            `/api/ownergroup/tanks?gasStationId=${gasStationId}`
          );
          const result = await response.json();
          if (result.success) {
            setTanksData({
              ...tanksData,
              [gasStationId]: result.data,
            });
          }
        } catch (error) {
          console.error("Error fetching tanks:", error);
        } finally {
          const newLoading = new Set(loadingTanks);
          newLoading.delete(gasStationId);
          setLoadingTanks(newLoading);
        }
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base lg:text-lg">
          Stock & LO Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tank Cards untuk expanded SPBU - di atas tabel */}
        {loData.map((spbu) => {
          if (!expandedGasStations.has(spbu.gasStationId)) return null;

          const tanks = tanksData[spbu.gasStationId] || [];
          const isLoading = loadingTanks.has(spbu.gasStationId);

          return (
            <div
              key={spbu.gasStationId}
              className="mb-4 pb-4 border-b border-gray-200"
            >
              <div className="mb-2">
                <h3 className="text-sm lg:text-base font-semibold">
                  Tank Detail - {spbu.gasStationName}
                </h3>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tanks.length > 0 ? (
                <div className="grid grid-cols-5 gap-2 lg:gap-4">
                  {tanks.map((tank) => (
                    <TankCard
                      key={tank.id}
                      tank={tank}
                      canUnload={false}
                      gasStationOpenTime={null}
                      gasStationCloseTime={null}
                      hideName={true}
                      showCodeBadgeOnMobile={true}
                      hideProductBadgeOnMobile={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Tidak ada tank untuk SPBU ini
                </div>
              )}
            </div>
          );
        })}

        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs lg:text-sm w-[140px] lg:w-[200px] min-w-[140px] lg:min-w-[200px] sticky left-0 z-10 border-r border-gray-300 shadow-[2px_0_4px_rgba(0,0,0,0.1)] px-1 lg:px-4 py-1.5 lg:py-2">
                  SPBU
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px] text-right border-r border-gray-300 px-1 lg:px-4 py-1.5 lg:py-2 hidden lg:table-cell">
                  Saldo Kas
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px] text-right border-r border-gray-300 px-1 lg:px-4 py-1.5 lg:py-2 hidden lg:table-cell">
                  Saldo Bank
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[130px] min-w-[130px] text-right border-r border-gray-300 px-1 lg:px-4 py-1.5 lg:py-2 lg:hidden">
                  Saldo
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[70px] lg:w-[150px] min-w-[70px] lg:min-w-[150px] px-1 lg:px-4 py-1.5 lg:py-2">
                  Produk
                </TableHead>
                <TableHead className="text-xs lg:text-sm w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] px-1 lg:px-4 py-1.5 lg:py-2">
                  Tangki
                </TableHead>
                <TableHead className="text-xs lg:text-sm text-right w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] px-1 lg:px-4 py-1.5 lg:py-2">
                  Stock Tank
                </TableHead>
                <TableHead className="text-xs lg:text-sm text-right w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] px-1 lg:px-4 py-1.5 lg:py-2">
                  LO Sisa
                </TableHead>
                <TableHead className="text-xs lg:text-sm text-right w-[100px] lg:w-[100px] min-w-[100px] lg:min-w-[100px] px-1 lg:px-4 py-1.5 lg:py-2">
                  Input Pembelian
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-xs lg:text-sm text-muted-foreground py-4 lg:col-span-8"
                  >
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                loData.flatMap((spbu, spbuIdx) => {
                  // Calculate total rows untuk rowspan SPBU, Saldo Kas, Saldo Bank
                  const totalProductRows = spbu.products.reduce(
                    (sum, product) => {
                      // Gunakan jumlah tank yang ada, minimal 1
                      return (
                        sum +
                        (product.tanks.length > 0 ? product.tanks.length : 1)
                      );
                    },
                    0
                  );

                  return spbu.products.flatMap((product, productIdx) => {
                    const isFirstProduct = productIdx === 0;
                    const tankRows =
                      product.tanks.length > 0 ? product.tanks.length : 1;

                    // Tampilkan semua tangki, baik yang 1 maupun multiple
                    return (
                      product.tanks.length > 0
                        ? product.tanks
                        : [
                            {
                              code: "-",
                              volume: product.totalVolume,
                              stock: product.totalStock,
                            },
                          ]
                    ).map((tank, tankIdx) => (
                      <TableRow
                        key={`${spbu.gasStationId}-${product.productId}-${tankIdx}`}
                        className={
                          isFirstProduct && tankIdx === 0 && spbuIdx > 0
                            ? "border-t-2 border-gray-400"
                            : ""
                        }
                      >
                        {/* SPBU, Saldo Kas, Saldo Bank - hanya di row pertama product pertama */}
                        {isFirstProduct && tankIdx === 0 && (
                          <>
                            <TableCell
                              rowSpan={totalProductRows}
                              className={cn(
                                "text-xs lg:text-sm font-medium align-top h-full w-[140px] lg:w-[200px] min-w-[140px] lg:min-w-[200px] sticky left-0 z-10 bg-background border-r border-gray-300 whitespace-normal shadow-[2px_0_4px_rgba(0,0,0,0.1)] px-1 lg:px-4 py-1 lg:py-2",
                                expandedGasStations.has(spbu.gasStationId) &&
                                  "bg-blue-50",
                                "cursor-pointer hover:bg-gray-50"
                              )}
                              onClick={() =>
                                handleGasStationClick(spbu.gasStationId)
                              }
                            >
                              <div className="w-full">
                                <div className="font-semibold wrap-break-words">
                                  {spbu.gasStationName}
                                </div>
                                <div className="text-[10px] lg:text-xs text-muted-foreground wrap-break-words mt-0.5 lg:mt-1">
                                  {spbu.address}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell
                              rowSpan={totalProductRows}
                              className="text-xs lg:text-sm text-right font-mono align-top w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px] border-r border-gray-300 px-1 lg:px-4 py-1 lg:py-2 hidden lg:table-cell"
                            >
                              {formatCurrency(spbu.cashBalance)}
                            </TableCell>
                            <TableCell
                              rowSpan={totalProductRows}
                              className="text-xs lg:text-sm text-right font-mono align-top w-[100px] lg:w-[120px] min-w-[100px] lg:min-w-[120px] border-r border-gray-300 px-1 lg:px-4 py-1 lg:py-2 hidden lg:table-cell"
                            >
                              {formatCurrency(spbu.bankBalance)}
                            </TableCell>
                            <TableCell
                              rowSpan={totalProductRows}
                              className="text-xs lg:text-sm text-right font-mono align-top w-[130px] min-w-[130px] border-r border-gray-300 px-1 lg:px-4 py-1 lg:py-2 lg:hidden"
                            >
                              <div className="flex flex-col gap-0.5 text-[10px]">
                                <div>Kas: {formatCurrency(spbu.cashBalance)}</div>
                                <div>Bank: {formatCurrency(spbu.bankBalance)}</div>
                              </div>
                            </TableCell>
                          </>
                        )}

                        {/* Produk - hanya di row pertama tank */}
                        {tankIdx === 0 && (
                          <TableCell
                            rowSpan={tankRows}
                            className="text-xs lg:text-sm font-medium w-[70px] lg:w-[150px] min-w-[70px] lg:min-w-[150px] align-top px-1 lg:px-4 py-1 lg:py-2"
                          >
                            <ProductBadge
                              productName={product.productName}
                            />
                          </TableCell>
                        )}

                        {/* Tangki - setiap row */}
                        <TableCell className="text-xs lg:text-sm w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] px-1 lg:px-4 py-1 lg:py-2">
                          {tank.code}
                        </TableCell>

                        {/* Stock Tank - setiap row */}
                        <TableCell className="text-xs lg:text-sm text-right font-mono w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] px-1 lg:px-4 py-1 lg:py-2">
                          {tank.stock.toLocaleString("id-ID")}
                        </TableCell>

                        {/* LO Sisa dan Input Pembelian - hanya di row pertama tank */}
                        {tankIdx === 0 && (
                          <>
                            <TableCell
                              rowSpan={tankRows}
                              className="text-xs lg:text-sm text-right font-mono font-semibold w-[70px] lg:w-[80px] min-w-[70px] lg:min-w-[80px] align-top px-1 lg:px-4 py-1 lg:py-2"
                            >
                              {product.totalLO.toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell
                              rowSpan={tankRows}
                              className="text-xs lg:text-sm text-right w-[100px] lg:w-[100px] min-w-[100px] lg:min-w-[100px] align-top px-1 lg:px-4 py-1 lg:py-2"
                            >
                              <Input
                                type="text"
                                placeholder="0"
                                className={cn(
                                  "text-right font-mono text-[10px] lg:text-xs h-6 lg:h-8 px-1 lg:px-2",
                                  "focus-visible:ring-2 focus-visible:ring-primary"
                                )}
                                value={
                                  getDraftValue(
                                    spbu.gasStationId,
                                    product.productId
                                  ) > 0
                                    ? formatNumber(
                                        getDraftValue(
                                          spbu.gasStationId,
                                          product.productId
                                        )
                                      )
                                    : ""
                                }
                                onChange={(e) =>
                                  handleDraftInput(
                                    spbu.gasStationId,
                                    product.productId,
                                    e.target.value
                                  )
                                }
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ));
                  });
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
