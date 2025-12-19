"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format-client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  nowUTC,
} from "@/lib/utils/datetime";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { DatePicker } from "@/components/reusable/date-picker";
import type { DateRange } from "react-day-picker";

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

type PurchaseHistoryTableProps = {
  purchases: PurchaseTransaction[];
  loData: LODataItem[];
};

export function PurchaseHistoryTable({
  purchases,
  loData,
}: PurchaseHistoryTableProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = nowUTC();
    return {
      from: startOfDayUTC(addDaysUTC(today, -6)), // Default: last 7 days
      to: endOfDayUTC(today),
    };
  });

  // Filter purchases berdasarkan dateRange dan sort by SPBU then date descending
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((purchase) => {
        const purchaseDate = new Date(purchase.date);
        const fromDate = dateRange.from ? startOfDayUTC(dateRange.from) : null;
        const toDate = dateRange.to ? endOfDayUTC(dateRange.to) : null;
        if (!fromDate || !toDate) return false;
        return purchaseDate >= fromDate && purchaseDate <= toDate;
      })
      .sort((a, b) => {
        // Sort by SPBU name first, then by date descending
        const spbuCompare = a.gasStationName.localeCompare(b.gasStationName);
        if (spbuCompare !== 0) return spbuCompare;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [purchases, dateRange]);

  // Get all unique products from loData and purchases, then sort them
  const getAllProducts = () => {
    const productMap = new Map<
      string,
      { productId: string; productName: string }
    >();

    // Get products from loData
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

    // Also get products from purchases (for SPBU that might not be in loData)
    purchases.forEach((purchase) => {
      if (purchase.productName && !productMap.has(purchase.productName)) {
        // Try to find productId from loData first
        let productId = purchase.productName; // fallback to productName as id
        for (const gasStation of loData) {
          const product = gasStation.products.find(
            (p) =>
              p.productName.toLowerCase() ===
              purchase.productName?.toLowerCase()
          );
          if (product) {
            productId = product.productId;
            break;
          }
        }
        productMap.set(purchase.productName, {
          productId,
          productName: purchase.productName,
        });
      }
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

  // Group purchases by gas station, then by date
  const purchasesByGasStation = useMemo(() => {
    const gasStationMap = new Map<string, Map<string, PurchaseTransaction[]>>();

    filteredPurchases.forEach((purchase) => {
      const purchaseDate = new Date(purchase.date);
      const dateKey = format(startOfDayUTC(purchaseDate), "yyyy-MM-dd");

      if (!gasStationMap.has(purchase.gasStationId)) {
        gasStationMap.set(purchase.gasStationId, new Map());
      }

      const dateMap = gasStationMap.get(purchase.gasStationId)!;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }

      dateMap.get(dateKey)!.push(purchase);
    });

    return gasStationMap;
  }, [filteredPurchases]);

  // Get sorted gas stations (by name)
  const sortedGasStations = useMemo(() => {
    const gasStationIds = Array.from(purchasesByGasStation.keys());
    return gasStationIds
      .map((id) => {
        // Try to get from loData first
        const fromLoData = loData.find((gs) => gs.gasStationId === id);
        if (fromLoData) return fromLoData;

        // If not in loData, get from purchases
        const dateMap = purchasesByGasStation.get(id);
        if (dateMap) {
          const firstDate = Array.from(dateMap.keys())[0];
          const purchases = dateMap.get(firstDate) || [];
          if (purchases.length > 0) {
            return {
              gasStationId: id,
              gasStationName: purchases[0].gasStationName,
              address: "",
              cashBalance: 0,
              bankBalance: 0,
              products: [],
            } as LODataItem;
          }
        }
        return null;
      })
      .filter((gs): gs is LODataItem => gs !== null)
      .sort((a, b) => a.gasStationName.localeCompare(b.gasStationName));
  }, [purchasesByGasStation, loData]);

  // Get product volume and value for gas station on specific date
  const getProductData = (
    gasStationId: string,
    productId: string,
    purchases: PurchaseTransaction[]
  ): { volume: number; value: number } => {
    // Get product name from allProducts
    const product = allProducts.find((p) => p.productId === productId);
    if (!product) return { volume: 0, value: 0 };

    let volume = 0;
    let value = 0;

    purchases.forEach((purchase) => {
      if (
        purchase.productName?.toLowerCase() ===
        product.productName.toLowerCase()
      ) {
        volume += purchase.purchaseVolume;
        value += purchase.totalValue;
      }
    });

    return { volume, value };
  };

  // Calculate total value for gas station on specific date
  const calculateTotalValue = (purchases: PurchaseTransaction[]) => {
    return purchases.reduce((sum, p) => sum + p.totalValue, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg">
            History Pembelian BBM
          </CardTitle>
          <DatePicker
            date={dateRange}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({
                  from: startOfDayUTC(range.from),
                  to: endOfDayUTC(range.to),
                });
              }
            }}
            size="sm"
          />
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
                <TableHead className="text-xs lg:text-sm w-[100px] min-w-[100px] text-center">
                  Tanggal
                </TableHead>
                {allProducts.map((product) => (
                  <TableHead
                    key={product.productId}
                    className="text-xs lg:text-sm text-center w-[120px] min-w-[120px]"
                  >
                    <ProductBadge productName={product.productName} />
                  </TableHead>
                ))}
                <TableHead className="text-xs lg:text-sm text-right w-[150px] min-w-[150px]">
                  Nilai Total Pembelian
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={allProducts.length + 3}
                    className="text-center text-xs lg:text-sm text-muted-foreground py-4"
                  >
                    Tidak ada history pembelian
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Group by gas station, then by date */}
                  {sortedGasStations.map((gasStation) => {
                    const dateMap = purchasesByGasStation.get(gasStation.gasStationId);
                    if (!dateMap) return null;

                    // Get sorted dates for this gas station (descending - terbaru dulu)
                    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
                      return new Date(b).getTime() - new Date(a).getTime();
                    });

                    const totalRows = sortedDates.length;

                    return (
                      <React.Fragment key={gasStation.gasStationId}>
                        {sortedDates.map((dateKey, dateIdx) => {
                          const purchases = dateMap.get(dateKey) || [];
                          const totalValue = calculateTotalValue(purchases);
                          const dateObj = new Date(dateKey);
                          const isFirstRow = dateIdx === 0;

                          return (
                            <TableRow
                              key={`${gasStation.gasStationId}-${dateKey}`}
                            >
                              {isFirstRow && (
                                <TableCell
                                  rowSpan={totalRows}
                                  className="text-xs lg:text-sm font-medium sticky left-0 z-10 bg-background border-r align-top shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
                                >
                                  {gasStation.gasStationName}
                                </TableCell>
                              )}
                              <TableCell className="text-xs lg:text-sm border-r font-medium text-center">
                                {format(dateObj, "dd/MM/yyyy", { locale: id })}
                              </TableCell>
                              {allProducts.map((product) => {
                                const productData = getProductData(
                                  gasStation.gasStationId,
                                  product.productId,
                                  purchases
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
                              <TableCell className="text-xs lg:text-sm text-right font-mono font-semibold">
                                {formatCurrency(totalValue)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
