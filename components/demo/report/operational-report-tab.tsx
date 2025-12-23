"use client";

import { useMemo } from "react";
import { MockDataService } from "@/lib/utils/mock-data";
import { SalesAreaChart } from "./sales-area-chart";
import { SalesStockReport } from "./sales-stock-report";

type OperationalReportTabProps = {
  gasStationId: string;
  gasStationName?: string;
};

export function OperationalReportTab({
  gasStationId,
  gasStationName = "SPBU",
}: OperationalReportTabProps) {
  // Demo mode: use mock data
  const salesReport = MockDataService.getSalesReport(gasStationId);
  const products = MockDataService.getProducts(gasStationId);

  // Transform mock data for chart
  const chartData = useMemo(() => {
    if (!salesReport) return [];
    return salesReport.dailySales.map((daily) => ({
      date: daily.date,
      ...salesReport.byProduct.reduce((acc, product) => {
        const dailyProduct = salesReport.byProduct.find(
          (p) => p.productId === product.productId
        );
        acc[product.productName] = dailyProduct
          ? Math.round(dailyProduct.volume / salesReport.dailySales.length)
          : 0;
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [salesReport]);

  const productsList = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    [products]
  );

  return (
    <div className="p-2 lg:p-6 space-y-3 lg:space-y-6">
      {/* Chart */}
      <SalesAreaChart
        data={chartData}
        products={productsList}
        isLoading={false}
      />

      {/* Sales Stock Report */}
      <SalesStockReport
        gasStationId={gasStationId}
        gasStationName={gasStationName}
      />
    </div>
  );
}
