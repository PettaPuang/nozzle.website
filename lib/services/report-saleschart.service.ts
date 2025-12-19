import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { startOfDayUTC, endOfDayUTC } from "@/lib/utils/datetime";

export type SalesChartData = {
  date: string;
  [productKey: string]: number | string;
};

export class ReportSalesChartService {
  /**
   * Get sales chart data for area chart visualization
   */
  static async getSalesChartData(
    gasStationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: "shift" | "daily" = "shift"
  ): Promise<SalesChartData[]> {
    const shifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "COMPLETED",
        date: {
          gte: startOfDayUTC(startDate),
          lte: endOfDayUTC(endDate),
        },
      },
      include: {
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        operator: {
          select: {
            profile: {
              select: {
                name: true,
              },
            },
            username: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const chartData: SalesChartData[] = [];

    // Helper function to get shift label from shift enum
    const getShiftLabel = (shift: string): string => {
      switch (shift) {
        case "MORNING":
          return "Pagi";
        case "AFTERNOON":
          return "Siang";
        case "NIGHT":
          return "Malam";
        default:
          return shift;
      }
    };

    for (const shift of shifts) {
      const shiftDate = new Date(shift.date);

      let dateKey: string;
      if (groupBy === "shift") {
        // Gunakan shift.shift dari database, bukan hardcode berdasarkan jam
        const shiftLabel = getShiftLabel(shift.shift);
        dateKey = `${format(shiftDate, "dd/MM")} - ${shiftLabel}`;
      } else {
        dateKey = format(shiftDate, "dd/MM");
      }

      const productSales = new Map<
        string,
        { volume: number; amount: number }
      >();

      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const volume =
            closeReading.totalizerReading -
            openReading.totalizerReading -
            closeReading.pumpTest;

          if (volume > 0) {
            const amount = volume * closeReading.priceSnapshot;
            const productName = closeReading.nozzle.product.name;

            if (!productSales.has(productName)) {
              productSales.set(productName, { volume: 0, amount: 0 });
            }

            const productData = productSales.get(productName)!;
            productData.volume += volume;
            productData.amount += amount;
          }
        }
      });

      if (groupBy === "daily") {
        const existingEntry = chartData.find((d) => d.date === dateKey);

        if (existingEntry) {
          productSales.forEach((data, productName) => {
            const productKey = productName.toLowerCase().replace(/\s+/g, "");
            const currentVolume =
              typeof existingEntry[`${productKey}_volume`] === "number"
                ? (existingEntry[`${productKey}_volume`] as number)
                : 0;
            const currentAmount =
              typeof existingEntry[`${productKey}_amount`] === "number"
                ? (existingEntry[`${productKey}_amount`] as number)
                : 0;
            existingEntry[`${productKey}_volume`] = currentVolume + data.volume;
            existingEntry[`${productKey}_amount`] = currentAmount + data.amount;
          });
        } else {
          const dataPoint: SalesChartData = { date: dateKey };
          productSales.forEach((data, productName) => {
            const productKey = productName.toLowerCase().replace(/\s+/g, "");
            dataPoint[`${productKey}_volume`] = Math.round(data.volume);
            dataPoint[`${productKey}_amount`] = Math.round(data.amount);
          });
          chartData.push(dataPoint);
        }
      } else {
        const existingEntry = chartData.find((d) => d.date === dateKey);

        if (existingEntry) {
          productSales.forEach((data, productName) => {
            const productKey = productName.toLowerCase().replace(/\s+/g, "");
            const currentVolume =
              typeof existingEntry[`${productKey}_volume`] === "number"
                ? (existingEntry[`${productKey}_volume`] as number)
                : 0;
            const currentAmount =
              typeof existingEntry[`${productKey}_amount`] === "number"
                ? (existingEntry[`${productKey}_amount`] as number)
                : 0;
            existingEntry[`${productKey}_volume`] = currentVolume + data.volume;
            existingEntry[`${productKey}_amount`] = currentAmount + data.amount;
          });
        } else {
          const dataPoint: SalesChartData = { date: dateKey };
          productSales.forEach((data, productName) => {
            const productKey = productName.toLowerCase().replace(/\s+/g, "");
            dataPoint[`${productKey}_volume`] = Math.round(data.volume);
            dataPoint[`${productKey}_amount`] = Math.round(data.amount);
          });
          chartData.push(dataPoint);
        }
      }
    }

    return chartData;
  }
}

