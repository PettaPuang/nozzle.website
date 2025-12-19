"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { SalesAreaChart } from "./sales-area-chart";
import { SalesStockReport } from "./sales-stock-report";
import { toast } from "sonner";
import {
  getTodayLocalAsUTC,
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
} from "@/lib/utils/datetime";

type SalesChartData = {
  date: string;
  [productKey: string]: number | string;
};

type OperationalReportTabProps = {
  gasStationId: string;
  gasStationName?: string;
  dateRange: DateRange;
};

export function OperationalReportTab({
  gasStationId,
  gasStationName = "SPBU",
  dateRange,
}: OperationalReportTabProps) {
  const [chartData, setChartData] = useState<SalesChartData[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(
          `/api/reports/products?gasStationId=${gasStationId}`
        );
        const result = await response.json();
        if (result.success) {
          setProducts(result.data);
        } else {
          toast.error("Gagal memuat data produk");
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Gagal memuat data produk");
      }
    };
    fetchProducts();
  }, [gasStationId]);

  // Fetch chart data - last 30 days, harian
  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoadingChart(true);
      try {
        const todayLocalUTC = getTodayLocalAsUTC();
        const last30Days = startOfDayUTC(addDaysUTC(todayLocalUTC, -29));

        const params = new URLSearchParams({
          gasStationId,
          startDate: last30Days.toISOString(),
          endDate: endOfDayUTC(todayLocalUTC).toISOString(),
          groupBy: "daily",
        });
        const response = await fetch(`/api/reports/sales-chart?${params}`);
        const result = await response.json();
        if (result.success) {
          setChartData(result.data);
        } else {
          toast.error("Gagal memuat data grafik");
          setChartData([]);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
        toast.error("Gagal memuat data grafik");
        setChartData([]);
      } finally {
        setIsLoadingChart(false);
      }
    };

    fetchChartData();
  }, [gasStationId]);

  return (
    <div className="p-2 lg:p-6 space-y-3 lg:space-y-6">
      {/* Chart */}
      <SalesAreaChart
        data={chartData}
        products={products}
        isLoading={isLoadingChart}
      />

      {/* Sales Stock Report */}
      <SalesStockReport
        gasStationId={gasStationId}
        gasStationName={gasStationName}
        dateRange={dateRange}
      />
    </div>
  );
}
