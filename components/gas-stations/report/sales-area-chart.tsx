"use client";

import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, formatCurrency } from "@/lib/utils/format-client";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
export type ChartType = "volume" | "amount";
export type ChartDisplay = "stacked" | "overlap";
export type ChartStyle = "area" | "bar" | "line";

// Warna khusus untuk chart (background untuk area chart)
const CHART_COLORS: Record<
  string,
  { bg: string; text?: string; stroke?: string }
> = {
  pertalite: {
    bg: "#f0fdf4", // green-50
    text: "#166534", // green-800 - hanya untuk Pertalite
    stroke: "#166534", // green-800 - border color untuk Pertalite
  },
  pertamax: {
    bg: "#0073B2", // Pertamina Blue
  },
  "pertamax turbo": {
    bg: "#FD0017", // Pertamina Red
  },
  biosolar: {
    bg: "#9ca3af", // gray-400
  },
  solar: {
    bg: "#9ca3af", // gray-400
  },
  dexlite: {
    bg: "#f59e0b", // amber-500
  },
  "pertamina dex": {
    bg: "#047857", // emerald-700
  },
  "pertamax green": {
    bg: "#10b981", // emerald-500
  },
  default: {
    bg: "#8884d8",
  },
};

const getChartColor = (
  productName: string
): { bg: string; text?: string; stroke?: string } => {
  const normalizedName = productName.toLowerCase().trim();
  return CHART_COLORS[normalizedName] || CHART_COLORS.default;
};

// Urutan produk untuk sorting
const PRODUCT_ORDER = ["pertalite", "biosolar", "pertamax", "dexlite"];

const getProductOrder = (productName: string): number => {
  const normalizedName = productName.toLowerCase().trim();
  const index = PRODUCT_ORDER.indexOf(normalizedName);
  return index === -1 ? 999 : index;
};

type SalesChartData = {
  date: string;
  [productKey: string]: number | string;
};

type SalesAreaChartProps = {
  data: SalesChartData[];
  products: Array<{ id: string; name: string }>;
  isLoading?: boolean;
};

export function SalesAreaChart({
  data,
  products,
  isLoading = false,
}: SalesAreaChartProps) {
  const [chartType, setChartType] = useState<ChartType>("volume");
  const [chartDisplay, setChartDisplay] = useState<ChartDisplay>("stacked");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("area");

  // Generate chart config dynamically based on products
  const chartConfig = useMemo(() => {
    const config: Record<
      string,
      { label: string; color: string; textColor?: string; strokeColor?: string }
    > = {};

    products.forEach((product) => {
      const productKey = product.name.toLowerCase().replace(/\s+/g, "");
      const chartColor = getChartColor(product.name);

      config[productKey] = {
        label: product.name,
        color: chartColor.bg,
        textColor: chartColor.text, // Hanya Pertalite yang punya textColor
        strokeColor: chartColor.stroke, // Border color untuk Pertalite
      };
    });

    return config;
  }, [products]);

  // Get product keys for rendering areas (sorted by order)
  const productKeys = useMemo(() => {
    const sortedProducts = [...products].sort((a, b) => {
      const orderA = getProductOrder(a.name);
      const orderB = getProductOrder(b.name);
      return orderA - orderB;
    });
    return sortedProducts.map((p) => p.name.toLowerCase().replace(/\s+/g, ""));
  }, [products]);

  // Determine suffix based on chart type
  const suffix = chartType === "volume" ? "_volume" : "_amount";

  const formatValue = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "-";
    }
    if (chartType === "volume") {
      return `${formatNumber(value)} L`;
    }
    return formatCurrency(value);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, "dd MMM", { locale: localeId });
    } catch {
      return dateStr;
    }
  };

  const formatYAxisValue = (value: number) => {
    if (chartType === "volume") {
      return formatNumber(value);
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return formatNumber(value);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Grafik Penjualan
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Memuat data...
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Loading chart data...
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-2 lg:p-3">
        <div className="p-2 lg:p-3">
          <div className="text-base lg:text-lg font-semibold">
            Grafik Penjualan
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground">
            Menampilkan {chartType === "volume" ? "volume" : "nilai"}{" "}
            penjualan per produk (30 Hari Terakhir)
          </div>
        </div>
        <div className="h-[250px] lg:h-[400px] flex items-center justify-center p-2 lg:p-3">
          <div className="text-xs lg:text-sm text-muted-foreground">
            Tidak ada data penjualan untuk 30 hari terakhir
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-2 lg:p-3">
      <div className="p-2 lg:p-3">
        <div className="flex flex-row items-center justify-between gap-2 lg:gap-4">
          <div>
            <div className="text-base lg:text-lg font-semibold">
              Grafik Penjualan
            </div>
            <div className="text-xs lg:text-sm text-muted-foreground">
              Menampilkan {chartType === "volume" ? "volume" : "nilai"}{" "}
              penjualan per produk (30 Hari Terakhir)
            </div>
          </div>

          {/* Chart Controls */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap shrink-0">
            <Select
              value={chartStyle}
              onValueChange={(value) => setChartStyle(value as ChartStyle)}
            >
              <SelectTrigger className="h-8 lg:h-9 w-[100px] lg:w-[120px] text-xs lg:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="line">Line</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={chartType}
              onValueChange={(value) => setChartType(value as ChartType)}
            >
              <SelectTrigger className="h-8 lg:h-9 w-[120px] lg:w-[140px] text-xs lg:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume">Volume (L)</SelectItem>
                <SelectItem value="amount">Nominal (Rp)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={chartDisplay}
              onValueChange={(value) => setChartDisplay(value as ChartDisplay)}
            >
              <SelectTrigger className="h-8 lg:h-9 w-[100px] lg:w-[120px] text-xs lg:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stacked">Stacked</SelectItem>
                <SelectItem value="overlap">Overlap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="p-2 lg:p-3">
        <ChartContainer
          config={chartConfig}
          className="h-[250px] lg:h-[400px] w-full"
        >
          {chartStyle === "area" ? (
            <AreaChart
              data={data}
              width={undefined}
              height={undefined}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                {productKeys.map((key) => (
                  <linearGradient
                    key={key}
                    id={`gradient-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={chartConfig[key]?.color || "#8884d8"}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartConfig[key]?.color || "#8884d8"}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="date"
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateLabel}
              />

              <YAxis
                tickFormatter={formatYAxisValue}
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
              />

              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  return (
                    <div className="rounded-lg border bg-background p-2 lg:p-3 shadow-md">
                      <div className="mb-1.5 lg:mb-2 font-semibold text-xs lg:text-sm">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry: any) => {
                          const productKey = entry.dataKey.replace(suffix, "");
                          const productName =
                            chartConfig[productKey]?.label || productKey;
                          const textColor = chartConfig[productKey]?.textColor;

                          return (
                            <div
                              key={entry.dataKey}
                              className="flex items-center justify-between gap-2 lg:gap-4"
                            >
                              <div className="flex items-center gap-1.5 lg:gap-2">
                                <div
                                  className="h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span
                                  className="text-xs lg:text-sm"
                                  style={
                                    textColor ? { color: textColor } : undefined
                                  }
                                >
                                  {productName}:
                                </span>
                              </div>
                              <span className="font-mono text-xs lg:text-sm font-medium">
                                {formatValue(entry.value as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                height={28}
                iconSize={10}
                wrapperStyle={{ fontSize: "10px" }}
                formatter={(value) => {
                  const productName = chartConfig[value]?.label || value;
                  const textColor = chartConfig[value]?.textColor;
                  return (
                    <span style={textColor ? { color: textColor } : undefined}>
                      {productName}
                    </span>
                  );
                }}
              />

              {productKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={`${key}${suffix}`}
                  stroke={
                    chartConfig[key]?.strokeColor ||
                    chartConfig[key]?.color ||
                    "#8884d8"
                  }
                  fill={`url(#gradient-${key})`}
                  fillOpacity={1}
                  strokeWidth={2}
                  stackId={chartDisplay === "stacked" ? "stack" : undefined}
                  name={key}
                />
              ))}
            </AreaChart>
          ) : chartStyle === "bar" ? (
            <BarChart
              data={data}
              width={undefined}
              height={undefined}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="date"
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateLabel}
              />

              <YAxis
                tickFormatter={formatYAxisValue}
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
              />

              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  return (
                    <div className="rounded-lg border bg-background p-2 lg:p-3 shadow-md">
                      <div className="mb-1.5 lg:mb-2 font-semibold text-xs lg:text-sm">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry: any) => {
                          const productKey = entry.dataKey.replace(suffix, "");
                          const productName =
                            chartConfig[productKey]?.label || productKey;
                          const textColor = chartConfig[productKey]?.textColor;

                          return (
                            <div
                              key={entry.dataKey}
                              className="flex items-center justify-between gap-2 lg:gap-4"
                            >
                              <div className="flex items-center gap-1.5 lg:gap-2">
                                <div
                                  className="h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span
                                  className="text-xs lg:text-sm"
                                  style={
                                    textColor ? { color: textColor } : undefined
                                  }
                                >
                                  {productName}:
                                </span>
                              </div>
                              <span className="font-mono text-xs lg:text-sm font-medium">
                                {formatValue(entry.value as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                height={28}
                iconSize={10}
                wrapperStyle={{ fontSize: "10px" }}
                formatter={(value) => {
                  const productName = chartConfig[value]?.label || value;
                  const textColor = chartConfig[value]?.textColor;
                  return (
                    <span style={textColor ? { color: textColor } : undefined}>
                      {productName}
                    </span>
                  );
                }}
              />

              {productKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={`${key}${suffix}`}
                  fill={chartConfig[key]?.color || "#8884d8"}
                  stackId={chartDisplay === "stacked" ? "stack" : undefined}
                  name={key}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart
              data={data}
              width={undefined}
              height={undefined}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

              <XAxis
                dataKey="date"
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateLabel}
              />

              <YAxis
                tickFormatter={formatYAxisValue}
                className="text-[10px] lg:text-xs"
                tick={{ fontSize: 10 }}
              />

              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  return (
                    <div className="rounded-lg border bg-background p-2 lg:p-3 shadow-md">
                      <div className="mb-1.5 lg:mb-2 font-semibold text-xs lg:text-sm">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry: any) => {
                          const productKey = entry.dataKey.replace(suffix, "");
                          const productName =
                            chartConfig[productKey]?.label || productKey;
                          const textColor = chartConfig[productKey]?.textColor;

                          return (
                            <div
                              key={entry.dataKey}
                              className="flex items-center justify-between gap-2 lg:gap-4"
                            >
                              <div className="flex items-center gap-1.5 lg:gap-2">
                                <div
                                  className="h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span
                                  className="text-xs lg:text-sm"
                                  style={
                                    textColor ? { color: textColor } : undefined
                                  }
                                >
                                  {productName}:
                                </span>
                              </div>
                              <span className="font-mono text-xs lg:text-sm font-medium">
                                {formatValue(entry.value as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                height={28}
                iconSize={10}
                wrapperStyle={{ fontSize: "10px" }}
                formatter={(value) => {
                  const productName = chartConfig[value]?.label || value;
                  const textColor = chartConfig[value]?.textColor;
                  return (
                    <span style={textColor ? { color: textColor } : undefined}>
                      {productName}
                    </span>
                  );
                }}
              />

              {productKeys.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={`${key}${suffix}`}
                  stroke={
                    chartConfig[key]?.strokeColor ||
                    chartConfig[key]?.color ||
                    "#8884d8"
                  }
                  strokeWidth={2}
                  name={key}
                />
              ))}
            </LineChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
