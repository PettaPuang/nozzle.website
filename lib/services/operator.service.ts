import { prisma } from "@/lib/prisma";
import { startOfDayUTC, endOfDayUTC, getDateRangeBetweenUTC } from "@/lib/utils/datetime";

export type OperatorWithShifts = {
  id: string;
  username: string;
  email: string;
  profile?: {
    name: string;
    avatar?: string | null;
  } | null;
  completedShiftsCount: number;
  pendingDepositsCount: number;
};

export type OperatorShiftHistory = {
  id: string;
  shift: string;
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  station: {
    code: string;
    name: string;
  };
  deposit: {
    id: string;
    status: string;
    totalAmount: number;
    operatorDeclaredAmount: number;
    depositDetails: Array<{
      id: string;
      paymentMethod: string;
      operatorAmount: number;
    }>;
  } | null;
  totalSales: number;
  nozzleDetails: Array<{
    nozzleId: string;
    nozzleCode: string;
    nozzleName: string;
    productName: string;
    openReading: number;
    closeReading: number;
    pumpTest: number;
    salesVolume: number;
    pricePerLiter: number;
    totalAmount: number;
    notes: string | null;
  }>;
};

export type OperatorDetail = {
  id: string;
  username: string;
  email: string;
  profile?: {
    name: string;
    avatar?: string | null;
  } | null;
};

export type ShiftWithSales = {
  id: string;
  shift: string;
  gasStationId: string;
  status: string;
  isVerified: boolean;
  totalSales: number;
  operator?: {
    id: string;
    username: string;
    profile: { name: string } | null;
  } | null;
  nozzleDetails: Array<{
    nozzleId: string;
    nozzleCode: string;
    nozzleName: string;
    productName: string;
    openReading: number;
    closeReading: number;
    pumpTest: number;
    salesVolume: number;
    pricePerLiter: number;
    totalAmount: number;
    notes: string | null;
    openImageUrl?: string | null;
    closeImageUrl?: string | null;
  }>;
  nozzleReadings: Array<{
    id: string;
    nozzleId: string;
    readingType: string;
    totalizerReading: number;
    pumpTest: number;
    priceSnapshot: number;
    imageUrl?: string | null;
  }>;
  hasDeposit: boolean;
};

export class OperatorService {
  /**
   * Get all operators for a gas station with their shift statistics
   * If userId is provided, only return that specific operator's data
   */
  static async getOperatorsWithShifts(
    gasStationId: string,
    userId?: string
  ): Promise<OperatorWithShifts[]> {
    // Get all users who have completed shifts at this gas station
    // (regardless of role, since admin can also do checkout)
    const completedShifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId: gasStationId,
        status: "COMPLETED",
        ...(userId && { operatorId: userId }), // Filter by userId if provided
      },
      select: {
        operatorId: true,
      },
    });

    // Get unique operator IDs
    const operatorIds = [
      ...new Set(completedShifts.map((shift) => shift.operatorId)),
    ];

    if (operatorIds.length === 0) {
      return [];
    }

    // Get operator details
    const operators = await prisma.user.findMany({
      where: {
        id: {
          in: operatorIds,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        profile: {
          select: {
            name: true,
            avatar: true,
          },
        },
        operatorShifts: {
          where: {
            gasStationId: gasStationId,
            status: "COMPLETED",
          },
          select: {
            id: true,
            deposit: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Map to include statistics
    return operators.map((operator) => {
      const completedShiftsCount = operator.operatorShifts.length;
      const pendingDepositsCount = operator.operatorShifts.filter(
        (shift) => !shift.deposit
      ).length;

      return {
        id: operator.id,
        username: operator.username,
        email: operator.email,
        profile: operator.profile,
        completedShiftsCount,
        pendingDepositsCount,
      };
    });
  }

  /**
   * Get operator shifts with sales calculation
   */
  static async getOperatorShiftsWithSales(
    operatorId: string,
    gasStationId: string
  ): Promise<{ operator: OperatorDetail; shifts: OperatorShiftHistory[] }> {
    // Fetch operator info
    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      select: {
        id: true,
        username: true,
        email: true,
        profile: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!operator) {
      throw new Error("Operator not found");
    }

    // Fetch completed shifts for this operator at this gas station
    // Limit to last 50 shifts untuk performa yang lebih baik
    const shifts = await prisma.operatorShift.findMany({
      where: {
        operatorId: operatorId,
        gasStationId: gasStationId,
        status: "COMPLETED",
      },
      include: {
        station: {
          select: {
            code: true,
            name: true,
          },
        },
        deposit: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            operatorDeclaredAmount: true,
            depositDetails: {
              select: {
                id: true,
                paymentAccount: true,
                paymentMethod: true,
                bankName: true,
                operatorAmount: true,
              },
            },
          },
        },
        nozzleReadings: {
          select: {
            id: true,
            nozzleId: true,
            readingType: true,
            totalizerReading: true,
            pumpTest: true,
            priceSnapshot: true,
            notes: true,
            nozzle: {
              select: {
                id: true,
                code: true,
                name: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 50, // Limit untuk performa
    });

    // Calculate total sales for each shift
    const shiftsWithSales: OperatorShiftHistory[] = shifts.map((shift) => {
      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      let totalSales = 0;
      const nozzleDetails: any[] = [];

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const salesVolume =
            Number(closeReading.totalizerReading) -
            Number(openReading.totalizerReading) -
            Number(closeReading.pumpTest);

          const totalAmount = salesVolume * Number(closeReading.priceSnapshot);

          if (salesVolume > 0) {
            totalSales += totalAmount;
          }

          nozzleDetails.push({
            nozzleId: closeReading.nozzleId,
            nozzleCode: closeReading.nozzle.code,
            nozzleName: closeReading.nozzle.name,
            productName: closeReading.nozzle.product.name,
            openReading: Number(openReading.totalizerReading),
            closeReading: Number(closeReading.totalizerReading),
            pumpTest: Number(closeReading.pumpTest),
            salesVolume,
            pricePerLiter: Number(closeReading.priceSnapshot),
            totalAmount,
            notes: openReading.notes || null, // Include notes from OPEN reading
          });
        }
      });

      return {
        id: shift.id,
        shift: shift.shift,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        station: shift.station,
        deposit: shift.deposit
          ? {
              id: shift.deposit.id,
              status: shift.deposit.status,
              totalAmount: shift.deposit.totalAmount, // Sudah Int
              operatorDeclaredAmount: shift.deposit.operatorDeclaredAmount, // Sudah Int
              depositDetails: shift.deposit.depositDetails.map((detail) => ({
                id: detail.id,
                paymentMethod: detail.paymentMethod || "",
                operatorAmount: detail.operatorAmount, // Sudah Int
              })),
            }
          : null,
        totalSales,
        nozzleDetails,
      };
    });

    return {
      operator,
      shifts: shiftsWithSales,
    };
  }

  /**
   * Get station shifts with sales calculation
   */
  static async getStationShiftsWithSales(
    stationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<
      OperatorShiftHistory & {
        operator: { id: string; name: string; avatar?: string | null };
        status: string;
      }
    >
  > {
    const where: any = {
      stationId,
    };

    if (startDate && endDate) {
      const { start, end } = getDateRangeBetweenUTC(startDate, endDate);
      where.date = {
        gte: start,
        lte: end,
      };
    }

    const shifts = await prisma.operatorShift.findMany({
      where,
      include: {
        operator: {
          include: {
            profile: true,
          },
        },
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
        },
        deposit: {
          include: {
            depositDetails: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 100,
    });

    const shiftsWithSales = shifts.map((shift) => {
      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      let totalSales = 0;
      const nozzleDetails: any[] = [];

      closeReadings.forEach((closeReading) => {
        const openReading = openReadings.find(
          (r) => r.nozzleId === closeReading.nozzleId
        );

        if (openReading) {
          const salesVolume =
            Number(closeReading.totalizerReading) -
            Number(openReading.totalizerReading) -
            Number(closeReading.pumpTest);

          const totalAmount = salesVolume * Number(closeReading.priceSnapshot);

          if (salesVolume > 0) {
            totalSales += totalAmount;
          }

          nozzleDetails.push({
            nozzleId: closeReading.nozzleId,
            nozzleCode: closeReading.nozzle.code,
            nozzleName: closeReading.nozzle.name,
            productName: closeReading.nozzle.product.name,
            openReading: Number(openReading.totalizerReading),
            closeReading: Number(closeReading.totalizerReading),
            pumpTest: Number(closeReading.pumpTest),
            salesVolume,
            pricePerLiter: Number(closeReading.priceSnapshot),
            totalAmount,
            notes: openReading.notes || null, // Include notes from OPEN reading
          });
        }
      });

      return {
        id: shift.id,
        shift: String(shift.shift),
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: String(shift.status),
        operator: {
          id: shift.operator.id,
          name: shift.operator.profile?.name || shift.operator.username,
          avatar: shift.operator.profile?.avatar,
        },
        station: {
          code: "",
          name: "",
        },
        deposit: shift.deposit
          ? {
              id: shift.deposit.id,
              status: String(shift.deposit.status),
              totalAmount: Number(shift.deposit.totalAmount),
              operatorDeclaredAmount: Number(
                shift.deposit.operatorDeclaredAmount
              ),
              depositDetails: shift.deposit.depositDetails.map((detail) => ({
                id: detail.id,
                paymentMethod: detail.paymentMethod || "",
                operatorAmount: Number(detail.operatorAmount),
              })),
            }
          : null,
        totalSales,
        nozzleDetails,
      };
    });

    return shiftsWithSales;
  }

  /**
   * Get shift with sales calculation
   */
  static async getShiftWithSales(shiftId: string): Promise<ShiftWithSales> {
    // Fetch shift with readings
    const shift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        operator: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
        },
        deposit: {
          include: {
            depositDetails: true,
          },
        },
      },
    });

    if (!shift) {
      throw new Error("Shift not found");
    }

    // Calculate total sales
    const openReadings = shift.nozzleReadings.filter(
      (r) => r.readingType === "OPEN"
    );
    const closeReadings = shift.nozzleReadings.filter(
      (r) => r.readingType === "CLOSE"
    );

    let totalSales = 0;
    const nozzleDetails: any[] = [];

    closeReadings.forEach((closeReading) => {
      const openReading = openReadings.find(
        (r) => r.nozzleId === closeReading.nozzleId
      );

      if (openReading) {
        const salesVolume =
          Number(closeReading.totalizerReading) -
          Number(openReading.totalizerReading) -
          Number(closeReading.pumpTest);

        const salesAmount = salesVolume * Number(closeReading.priceSnapshot);

        if (salesVolume > 0) {
          totalSales += salesAmount;
        }

        nozzleDetails.push({
          nozzleId: closeReading.nozzleId,
          nozzleCode: closeReading.nozzle.code,
          nozzleName: closeReading.nozzle.name,
          productName: closeReading.nozzle.product.name,
          openReading: Number(openReading.totalizerReading),
          closeReading: Number(closeReading.totalizerReading),
          pumpTest: Number(closeReading.pumpTest),
          salesVolume: salesVolume > 0 ? salesVolume : 0,
          pricePerLiter: Number(closeReading.priceSnapshot),
          totalAmount: salesAmount > 0 ? salesAmount : 0,
          notes: openReading.notes || null, // Include notes from OPEN reading
          openImageUrl: openReading.imageUrl, // Include imageUrl from OPEN reading
          closeImageUrl: closeReading.imageUrl, // Include imageUrl from CLOSE reading
        });
      }
    });

    // Convert all Decimal fields to numbers using utility
    const result = {
      id: shift.id,
      shift: shift.shift,
      gasStationId: shift.gasStationId,
      status: shift.status,
      isVerified: shift.isVerified,
      totalSales,
      operatorDeclaredAmount: shift.deposit
        ? Number(shift.deposit.operatorDeclaredAmount)
        : totalSales,
      operator: shift.operator
        ? {
            id: shift.operator.id,
            username: shift.operator.username,
            profile: shift.operator.profile,
          }
        : null,
      nozzleDetails,
      nozzleReadings: (() => {
        // Untuk keperluan display foto di verification form, kita deduplicate berdasarkan imageUrl
        // Tapi untuk keperluan check-out form dan perhitungan, kita perlu semua readings
        // Jadi kita kembalikan semua readings, tapi untuk display foto bisa di-deduplicate di frontend
        
        // Return semua readings (tanpa filter imageUrl) untuk memastikan semua nozzle mendapatkan reading mereka
        return shift.nozzleReadings.map((r) => ({
          id: r.id,
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          totalizerReading: Number(r.totalizerReading),
          pumpTest: Number(r.pumpTest),
          priceSnapshot: Number(r.priceSnapshot),
          imageUrl: r.imageUrl,
        }));
      })(),
      hasDeposit: !!shift.deposit,
      deposit: shift.deposit
        ? {
            id: shift.deposit.id,
            operatorShiftId: shift.deposit.operatorShiftId,
            adminFinanceId: shift.deposit.adminFinanceId,
            totalAmount: shift.deposit.totalAmount, // Sudah Int
            operatorDeclaredAmount: shift.deposit.operatorDeclaredAmount, // Sudah Int
            adminReceivedAmount: shift.deposit.adminReceivedAmount, // Sudah Int atau null
            status: shift.deposit.status,
            notes: shift.deposit.notes,
            createdAt: shift.deposit.createdAt,
            updatedAt: shift.deposit.updatedAt,
            depositDetails: shift.deposit.depositDetails.map((detail) => ({
              id: detail.id,
              depositId: detail.depositId,
              paymentMethod: detail.paymentMethod,
              operatorAmount: detail.operatorAmount, // Sudah Int
              adminAmount: detail.adminAmount, // Sudah Int atau null
              notes: detail.notes,
              createdAt: detail.createdAt,
              updatedAt: detail.updatedAt,
            })),
          }
        : null,
    };

    return result;
  }
}
