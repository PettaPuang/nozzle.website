import { prisma } from "@/lib/prisma";
import {
  calculateTankStockByCalculation,
  calculateSalesFromNozzleReadings,
  calculatePumpTestFromNozzleReadings,
} from "@/lib/utils/tank-calculations";
import { todayRangeUTC, getDateRangeUTC, startOfDayUTC, endOfDayUTC, addDaysUTC } from "@/lib/utils/datetime";

export class OperationalService {
  static async getTanksWithStock(gasStationId: string) {
    const { start: startToday, end: endToday } = todayRangeUTC();
    // Normalize untuk query @db.Date field
    const todayDate = startOfDayUTC(startToday);

    // Batch fetch: tanks, today readings, latest readings, unloads, shifts, gas station
    const [
      tanks,
      todayReadingsAll,
      latestReadingsAll,
      unloadsAll,
      completedShiftsAll,
      gasStation,
    ] = await Promise.all([
      // Fetch all tanks
      prisma.tank.findMany({
        where: { gasStationId },
        include: {
          product: true,
        },
        orderBy: {
          code: "asc",
        },
      }),
      // Batch fetch today's readings for all tanks (gunakan date field untuk konsistensi)
      prisma.tankReading.findMany({
        where: {
          tank: { gasStationId },
          approvalStatus: "APPROVED",
          date: todayDate, // Gunakan date field (tanggal operasional), bukan createdAt
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          tankId: true,
          literValue: true,
          date: true,
          createdAt: true,
        },
      }),
      // Batch fetch latest readings for all tanks (fetch all, then group by tankId)
      prisma.tankReading.findMany({
        where: {
          tank: { gasStationId },
          approvalStatus: "APPROVED",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          tankId: true,
          literValue: true,
          createdAt: true,
        },
      }),
      // Batch fetch all approved unloads for all tanks
      prisma.unload.findMany({
        where: {
          tank: { gasStationId },
          status: "APPROVED",
        },
        select: {
          tankId: true,
          id: true,
          literAmount: true,
          createdAt: true,
          status: true,
        },
      }),
      // Batch fetch all completed shifts for all tanks in this gas station
      // Include deposit untuk filter berdasarkan status APPROVED
      prisma.operatorShift.findMany({
        where: {
          gasStationId,
          status: "COMPLETED",
        },
        include: {
          nozzleReadings: {
            include: {
              nozzle: {
                select: {
                  tankId: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          deposit: {
            select: {
              status: true,
            },
          },
        },
      }),
      // Fetch gas station for hasTitipan and titipanNames
      prisma.gasStation.findUnique({
        where: { id: gasStationId },
        select: {
          hasTitipan: true,
          titipanNames: true,
        },
      }),
    ]);

    // Group data by tankId for efficient lookup
    const todayReadingsByTank = new Map<
      string,
      Array<{ literValue: number; createdAt: Date }>
    >();
    const latestReadingsByTank = new Map<
      string,
      { literValue: number; createdAt: Date }
    >();
    const unloadsByTank = new Map<
      string,
      Array<{ id: string; literAmount: number; createdAt: Date }>
    >();
    const shiftsByTank = new Map<
      string,
      Array<(typeof completedShiftsAll)[0]>
    >();

    // Group today readings
    todayReadingsAll.forEach((reading) => {
      if (!todayReadingsByTank.has(reading.tankId)) {
        todayReadingsByTank.set(reading.tankId, []);
      }
      todayReadingsByTank.get(reading.tankId)!.push({
        literValue: reading.literValue,
        createdAt: reading.createdAt,
      });
    });

    // Group latest readings (only keep the first/latest one per tank since already ordered desc)
    latestReadingsAll.forEach((reading) => {
      if (!latestReadingsByTank.has(reading.tankId)) {
        latestReadingsByTank.set(reading.tankId, {
          literValue: reading.literValue,
          createdAt: reading.createdAt,
        });
      }
    });

    // Group unloads
    unloadsAll.forEach((unload) => {
      if (!unloadsByTank.has(unload.tankId)) {
        unloadsByTank.set(unload.tankId, []);
      }
      unloadsByTank.get(unload.tankId)!.push({
        id: unload.id,
        literAmount: unload.literAmount,
        createdAt: unload.createdAt,
      });
    });

    // Group shifts by tank (filter nozzleReadings by tankId)
    completedShiftsAll.forEach((shift) => {
      // Group nozzleReadings by tankId
      const readingsByTank = new Map<string, typeof shift.nozzleReadings>();
      shift.nozzleReadings.forEach((reading) => {
        const tankId = reading.nozzle.tankId;
        if (!readingsByTank.has(tankId)) {
          readingsByTank.set(tankId, []);
        }
        readingsByTank.get(tankId)!.push(reading);
      });

      // Add shift to each tank's shift list
      readingsByTank.forEach((readings, tankId) => {
        if (!shiftsByTank.has(tankId)) {
          shiftsByTank.set(tankId, []);
        }
        shiftsByTank.get(tankId)!.push({
          ...shift,
          nozzleReadings: readings,
        });
      });
    });

    // Calculate current stock for each tank using centralized function
    const tanksWithStock = await Promise.all(
      tanks.map(async (tank) => {
        const currentStock = await this.getCurrentStock(tank.id);

        return {
          id: tank.id,
          code: tank.code,
          name: tank.name,
          capacity: tank.capacity,
          gasStationId: tank.gasStationId,
          productId: tank.productId,
          currentStock,
          product: {
            id: tank.product.id,
            name: tank.product.name,
            ron: tank.product.ron,
            purchasePrice: tank.product.purchasePrice,
            sellingPrice: tank.product.sellingPrice,
          },
          // Include hasTitipan and titipanNames from gas station
          hasTitipan: gasStation?.hasTitipan || false,
          titipanNames: gasStation?.titipanNames || [],
        };
      })
    );

    return tanksWithStock;
  }

  /**
   * Get current stock for a tank (centralized calculation)
   * Priority:
   * 1. Today's latest reading (most accurate)
   * 2. Calculate realtime from today's open reading + unloads - sales
   * 3. Calculate realtime from latest reading + unloads - sales
   * 4. Calculate from initialStock + all unloads - all sales
   */
  static async getCurrentStock(tankId: string): Promise<number> {
    const { start: startToday, end: endToday } = todayRangeUTC();

    // Get tank info
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      select: {
        id: true,
        gasStationId: true,
        initialStock: true,
      },
    });

    if (!tank) {
      throw new Error("Tank not found");
    }

    // Get today's readings (gunakan date field untuk konsistensi)
    const todayDate = startOfDayUTC(startToday);
    const todayReadings = await prisma.tankReading.findMany({
      where: {
        tankId,
        approvalStatus: "APPROVED",
        date: todayDate, // Gunakan date field (tanggal operasional), bukan createdAt
      },
      orderBy: { createdAt: "asc" },
      select: {
        literValue: true,
        createdAt: true,
      },
    });

    const todayOpenReading = todayReadings.length > 0 ? todayReadings[0] : null;
    const todayCloseReading = todayReadings.length > 0 ? todayReadings[todayReadings.length - 1] : null;

    // Priority 1: Use today's latest reading (most accurate)
    if (todayCloseReading) {
      return todayCloseReading.literValue;
    }

    // Priority 2: Calculate realtime if open reading exists TODAY
    if (todayOpenReading) {
      const unloadsSinceOpen = await prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: todayOpenReading.createdAt,
            lte: endToday,
          },
        },
        select: { literAmount: true },
      });

      const shiftsSinceOpen = await prisma.operatorShift.findMany({
        where: {
          gasStationId: tank.gasStationId,
          status: "COMPLETED",
          deposit: {
            status: "APPROVED",
          },
          date: {
            gte: startToday,
            lte: endToday,
          },
          nozzleReadings: {
            some: {
              nozzle: { tankId },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: { tankId },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      let sales = 0;
      let pumpTest = 0;
      for (const shift of shiftsSinceOpen) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        const shiftPumpTest = calculatePumpTestFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            pumpTest: r.pumpTest,
          }))
        );
        sales += shiftSales;
        pumpTest += shiftPumpTest;
      }

      const openStock = todayOpenReading.literValue;
      const unloads = unloadsSinceOpen.reduce((sum, u) => sum + u.literAmount, 0);

      return calculateTankStockByCalculation({
        stockOpen: openStock,
        unloads,
        sales,
        pumpTest,
      });
    }

    // Priority 3: No reading today, calculate from latest reading + all unloads since then
    const latestReading = await prisma.tankReading.findFirst({
      where: {
        tankId,
        approvalStatus: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
      select: {
        literValue: true,
        createdAt: true,
      },
    });

    if (latestReading) {
      const unloadsSinceReading = await prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: latestReading.createdAt,
          },
        },
        select: { literAmount: true },
      });

      const shiftsSinceReading = await prisma.operatorShift.findMany({
        where: {
          gasStationId: tank.gasStationId,
          status: "COMPLETED",
          deposit: {
            status: "APPROVED",
          },
          createdAt: {
            gte: latestReading.createdAt,
          },
          nozzleReadings: {
            some: {
              nozzle: { tankId },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: { tankId },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      let sales = 0;
      let pumpTest = 0;
      for (const shift of shiftsSinceReading) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        const shiftPumpTest = calculatePumpTestFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            pumpTest: r.pumpTest,
          }))
        );
        sales += shiftSales;
        pumpTest += shiftPumpTest;
      }

      const lastStock = latestReading.literValue;
      const unloads = unloadsSinceReading.reduce((sum, u) => sum + u.literAmount, 0);

      return calculateTankStockByCalculation({
        stockOpen: lastStock,
        unloads,
        sales,
        pumpTest,
      });
    }

    // Priority 4: No reading at all, calculate from initialStock + all unloads - all sales
    const allUnloads = await prisma.unload.findMany({
      where: {
        tankId,
        status: "APPROVED",
      },
      select: { literAmount: true },
    });

    const allShifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId: tank.gasStationId,
        status: "COMPLETED",
        deposit: {
          status: "APPROVED",
        },
        nozzleReadings: {
          some: {
            nozzle: { tankId },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: { tankId },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    let sales = 0;
    let pumpTest = 0;
    for (const shift of allShifts) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      const shiftPumpTest = calculatePumpTestFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          pumpTest: r.pumpTest,
        }))
      );
      sales += shiftSales;
      pumpTest += shiftPumpTest;
    }

    const unloads = allUnloads.reduce((sum, u) => sum + u.literAmount, 0);

    return calculateTankStockByCalculation({
      stockOpen: tank.initialStock || 0,
      unloads,
      sales,
      pumpTest,
    });
  }

  /**
   * Get opening stock (stock awal) for a specific date
   * Stock awal = closing stock hari sebelumnya (reading kemarin ATAU stock realtime kemarin)
   *
   * Priority:
   * 1. Reading kemarin (jika ada)
   * 2. Stock realtime kemarin (calculated dari reading sebelumnya + unloads - sales)
   */
  static async getOpeningStockForDate(
    tankId: string,
    targetDate: Date
  ): Promise<number> {
    const yesterday = addDaysUTC(targetDate, -1);
    const startYesterday = startOfDayUTC(yesterday);
    const endYesterday = endOfDayUTC(yesterday);

    // Get tank info
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      select: {
        id: true,
        gasStationId: true,
        initialStock: true,
      },
    });

    if (!tank) {
      throw new Error("Tank not found");
    }

    // Priority 1: Cari reading kemarin (priority tertinggi)
    const yesterdayDate = startOfDayUTC(yesterday);
    const yesterdayReading = await prisma.tankReading.findFirst({
      where: {
        tankId,
        approvalStatus: "APPROVED",
        date: yesterdayDate,
      },
      orderBy: { createdAt: "desc" },
      select: { literValue: true },
    });

    if (yesterdayReading) {
      return yesterdayReading.literValue; // Stock awal = reading kemarin
    }

    // Priority 2: Jika tidak ada reading kemarin, hitung stock realtime kemarin
    // Cari reading terakhir sebelum kemarin
    const latestReading = await prisma.tankReading.findFirst({
      where: {
        tankId,
        approvalStatus: "APPROVED",
        date: { lt: yesterdayDate }, // Sebelum kemarin
      },
      orderBy: { date: "desc" },
      select: { literValue: true, createdAt: true },
    });

    // Base stock = latest reading atau initialStock
    const baseStock = latestReading?.literValue ?? tank.initialStock ?? 0;

    // Hitung unloads dan sales kemarin
    const unloadsYesterday = await prisma.unload.findMany({
      where: {
        tankId,
        status: "APPROVED",
        createdAt: {
          gte: startYesterday,
          lte: endYesterday,
        },
      },
      select: { literAmount: true },
    });

    // Get gas station untuk filter shifts
    const gasStation = await prisma.gasStation.findUnique({
      where: { id: tank.gasStationId },
      select: { id: true },
    });

    if (!gasStation) {
      throw new Error("Gas station not found");
    }

    // Get shifts kemarin yang completed
    const shiftsYesterday = await prisma.operatorShift.findMany({
      where: {
        gasStationId: gasStation.id,
        status: "COMPLETED",
        date: {
          gte: startYesterday,
          lte: endYesterday,
        },
        nozzleReadings: {
          some: {
            nozzle: { tankId },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: { tankId },
          },
          include: { nozzle: { select: { tankId: true } } },
        },
      },
    });

    // Calculate sales from shifts kemarin
    let salesYesterday = 0;
    for (const shift of shiftsYesterday) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      salesYesterday += shiftSales;
    }

    const unloadsTotalYesterday = unloadsYesterday.reduce(
      (sum, u) => sum + u.literAmount,
      0
    );

    // Jika ada latest reading, hitung unloads dan sales sejak reading tersebut sampai akhir kemarin
    if (latestReading) {
      const unloadsSinceBase = await prisma.unload.findMany({
        where: {
          tankId,
          status: "APPROVED",
          createdAt: {
            gte: latestReading.createdAt,
            lte: endYesterday,
          },
        },
        select: { literAmount: true },
      });

      const shiftsSinceBase = await prisma.operatorShift.findMany({
        where: {
          gasStationId: gasStation.id,
          status: "COMPLETED",
          createdAt: {
            gte: latestReading.createdAt,
            lte: endYesterday,
          },
          nozzleReadings: {
            some: {
              nozzle: { tankId },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: { tankId },
            },
            include: { nozzle: { select: { tankId: true } } },
          },
        },
      });

      let salesSinceBase = 0;
      let pumpTestSinceBase = 0;
      for (const shift of shiftsSinceBase) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        const shiftPumpTest = calculatePumpTestFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            pumpTest: r.pumpTest,
          }))
        );
        salesSinceBase += shiftSales;
        pumpTestSinceBase += shiftPumpTest;
      }

      const unloadsTotalSinceBase = unloadsSinceBase.reduce(
        (sum, u) => sum + u.literAmount,
        0
      );

      // Stock realtime kemarin = base + unloads sejak reading - (sales + pumpTest) sejak reading
      return calculateTankStockByCalculation({
        stockOpen: baseStock,
        unloads: unloadsTotalSinceBase,
        sales: salesSinceBase,
        pumpTest: pumpTestSinceBase,
      });
    }

    // Jika tidak ada reading sama sekali, hitung stock realtime kemarin berdasarkan
    // initialStock + semua unloads sejak tank creation sampai akhir kemarin - semua sales sejak tank creation sampai akhir kemarin
    // Bukan hanya unloads dan sales kemarin saja
    const tankWithCreatedAt = await prisma.tank.findUnique({
      where: { id: tankId },
      select: { createdAt: true },
    });

    const tankCreatedAt = tankWithCreatedAt?.createdAt || new Date(0);

    // Hitung semua unloads sejak tank creation sampai akhir kemarin
    const allUnloadsUntilYesterday = await prisma.unload.findMany({
      where: {
        tankId,
        status: "APPROVED",
        createdAt: {
          gte: tankCreatedAt,
          lte: endYesterday,
        },
      },
      select: { literAmount: true },
    });

    // Hitung semua sales sejak tank creation sampai akhir kemarin
    const allShiftsUntilYesterday = await prisma.operatorShift.findMany({
      where: {
        gasStationId: gasStation.id,
        status: "COMPLETED",
        deposit: {
          status: "APPROVED",
        },
        createdAt: {
          gte: tankCreatedAt,
          lte: endYesterday,
        },
        nozzleReadings: {
          some: {
            nozzle: { tankId },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: { tankId },
          },
          include: { nozzle: { select: { tankId: true } } },
        },
      },
    });

    let allSalesUntilYesterday = 0;
    let allPumpTestUntilYesterday = 0;
    for (const shift of allShiftsUntilYesterday) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      const shiftPumpTest = calculatePumpTestFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          pumpTest: r.pumpTest,
        }))
      );
      allSalesUntilYesterday += shiftSales;
      allPumpTestUntilYesterday += shiftPumpTest;
    }

    const allUnloadsTotalUntilYesterday = allUnloadsUntilYesterday.reduce(
      (sum, u) => sum + u.literAmount,
      0
    );

    // Stock realtime kemarin = initialStock + semua unloads - (semua sales + pumpTest) sampai akhir kemarin
    return calculateTankStockByCalculation({
      stockOpen: baseStock,
      unloads: allUnloadsTotalUntilYesterday,
      sales: allSalesUntilYesterday,
      pumpTest: allPumpTestUntilYesterday,
    });
  }

  static async getDataForClient(gasStationId: string, userId?: string) {
    const gasStation = await prisma.gasStation.findFirst({
      where: {
        id: gasStationId,
        status: "ACTIVE",
      },
      include: {
        owner: {
          include: {
            profile: true,
          },
        },
        tanks: {
          include: {
            product: true,
          },
          orderBy: {
            code: "asc",
          },
        },
      },
    });

    if (!gasStation) {
      return null;
    }

    // Fetch stations separately
    const stations = await prisma.station.findMany({
      where: {
        gasStationId,
      },
      include: {
        tankConnections: {
          include: {
            tank: {
              include: {
                product: true,
              },
            },
          },
        },
        nozzles: {
          where: {
            deletedAt: null, // Filter soft-deleted nozzles
          },
          include: {
            product: true,
            tank: true,
          },
          orderBy: {
            code: "asc",
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    // Fetch active shifts untuk user yang sedang login (jika userId tersedia)
    // Filter berdasarkan userId untuk memastikan hanya shift dari user yang sedang login yang ditampilkan
    let activeShiftsByStation: Record<string, any> = {};

    const activeShifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "STARTED",
        ...(userId && { operatorId: userId }), // Filter berdasarkan userId jika tersedia
      },
      include: {
        operator: {
          include: {
            profile: true,
          },
        },
        nozzleReadings: {
          include: {
            nozzle: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // Check if user has active shift in other station (for UI validation)
    // Cek di semua station (termasuk di gas station yang sama atau berbeda)
    let userActiveShiftInOtherStation: {
      stationCode: string;
      stationName: string;
      gasStationName: string;
    } | null = null;

    if (userId) {
      const { start: startToday, end: endToday } = todayRangeUTC();

      // Cek apakah user sudah check-in di station manapun hari ini
      const userActiveShiftElsewhere = await prisma.operatorShift.findFirst({
        where: {
          operatorId: userId,
          date: {
            gte: startToday,
            lt: endToday,
          },
          status: {
            in: ["PENDING", "STARTED"],
          },
        },
        include: {
          station: {
            select: {
              code: true,
              name: true,
            },
          },
          gasStation: {
            select: {
              name: true,
            },
          },
        },
      });

      // Set info active shift di station lain
      // Note: UI akan filter apakah ini station yang berbeda dari station card yang sedang dilihat
      if (userActiveShiftElsewhere) {
        userActiveShiftInOtherStation = {
          stationCode: userActiveShiftElsewhere.station.code,
          stationName: userActiveShiftElsewhere.station.name,
          gasStationName: userActiveShiftElsewhere.gasStation.name,
        };
      }
    }

    // Fetch semua active shift di gas station ini (tanpa filter userId) untuk mengetahui apakah station sudah digunakan
    const allActiveShiftsInStation = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "STARTED",
      },
      include: {
        operator: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Buat map stationId -> operator info untuk mengetahui apakah station sudah digunakan dan siapa yang menggunakan
    const stationOccupiedBy: Record<string, string> = {};
    const stationOccupiedByOperator: Record<
      string,
      {
        id: string;
        username: string;
        name: string | null;
        avatar: string | null;
        shift: string;
        startTime: Date | null;
      }
    > = {};
    allActiveShiftsInStation.forEach((shift) => {
      stationOccupiedBy[shift.stationId] = shift.operatorId;
      stationOccupiedByOperator[shift.stationId] = {
        id: shift.operator.id,
        username: shift.operator.username,
        name: shift.operator.profile?.name || null,
        avatar: shift.operator.profile?.avatar || null,
        shift: shift.shift,
        startTime: shift.startTime,
      };
    });

    // Group by stationId
    activeShifts.forEach((shift) => {
      const openReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );
      const closeReadings = shift.nozzleReadings.filter(
        (r) => r.readingType === "CLOSE"
      );

      activeShiftsByStation[shift.stationId] = {
        id: shift.id,
        operatorId: shift.operatorId, // Tambahkan operatorId untuk validasi di UI
        shift: shift.shift,
        startTime: shift.startTime,
        status: shift.status,
        hasOpenReading: openReadings.length > 0,
        hasCloseReading: closeReadings.length > 0,
        operator: {
          name: shift.operator.profile?.name || shift.operator.username,
          avatar: shift.operator.profile?.avatar || null,
        },
        nozzleReadings: shift.nozzleReadings.map((r) => ({
          id: r.id,
          operatorShiftId: r.operatorShiftId,
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          totalizerReading: r.totalizerReading,
          pumpTest: r.pumpTest,
          priceSnapshot: r.priceSnapshot,
          imageUrl: r.imageUrl,
          notes: r.notes,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };
    });

    // Fetch latest readings for nozzles (sederhana: ambil reading terakhir per nozzle)
    const latestReadingsMap: Record<string, any> = {};

    // Get all nozzles in this gas station
    const allNozzlesInStation = await prisma.nozzle.findMany({
      where: {
        station: {
          gasStationId,
        },
      },
      select: {
        id: true,
      },
    });

    // For each nozzle, get the latest readings (both OPEN and CLOSE)
    for (const nozzle of allNozzlesInStation) {
      // Get latest CLOSE reading (for check-in form - bacaan terakhir)
      const latestCloseReading = await prisma.nozzleReading.findFirst({
        where: {
          nozzleId: nozzle.id,
          readingType: "CLOSE",
        },
        include: {
          operatorShift: {
            include: {
              operator: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Get latest OPEN reading (for check-out form - bacaan buka)
      const latestOpenReading = await prisma.nozzleReading.findFirst({
        where: {
          nozzleId: nozzle.id,
          readingType: "OPEN",
        },
        include: {
          operatorShift: {
            include: {
              operator: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Use the most recent reading (either OPEN or CLOSE) for shift and operator info
      const latestReading = latestCloseReading || latestOpenReading;

      if (latestReading) {
        latestReadingsMap[nozzle.id] = {
          shift: latestReading.operatorShift.shift,
          open: latestOpenReading
            ? Number(latestOpenReading.totalizerReading)
            : null,
          close: latestCloseReading
            ? Number(latestCloseReading.totalizerReading)
            : null,
          operator:
            latestReading.operatorShift.operator.profile?.name ||
            latestReading.operatorShift.operator.username,
        };
      }
    }

    // Transform Decimal to number for client
    return {
      gasStation: {
        id: gasStation.id,
        name: gasStation.name,
        address: gasStation.address,
        latitude: gasStation.latitude,
        longitude: gasStation.longitude,
        status: gasStation.status,
        ownerId: gasStation.ownerId,
        userActiveShiftInOtherStation, // Info apakah user sudah check-in di station lain
        openTime: gasStation.openTime,
        closeTime: gasStation.closeTime,
      },
      tanks: gasStation.tanks.map((tank) => ({
        ...tank,
        capacity: tank.capacity,
        initialStock: tank.initialStock,
        product: {
          ...tank.product,
          purchasePrice: tank.product.purchasePrice,
          sellingPrice: tank.product.sellingPrice,
        },
      })),
      stations: stations.map((station) => ({
        ...station,
        activeShift: activeShiftsByStation[station.id] || null,
        isOccupied: !!stationOccupiedBy[station.id], // Station sudah digunakan jika ada active shift
        occupiedBy: stationOccupiedBy[station.id] || null, // OperatorId yang menggunakan station
        occupiedByOperator: stationOccupiedByOperator[station.id] || null, // Info operator yang menggunakan station
        tankConnections: station.tankConnections.map((conn) => ({
          ...conn,
          tank: {
            ...conn.tank,
            capacity: conn.tank.capacity,
            initialStock: conn.tank.initialStock,
            product: {
              ...conn.tank.product,
              purchasePrice: conn.tank.product.purchasePrice,
              sellingPrice: conn.tank.product.sellingPrice,
            },
          },
        })),
        nozzles: station.nozzles.map((nozzle) => ({
          ...nozzle,
          tank: {
            ...nozzle.tank,
            capacity: nozzle.tank.capacity,
            initialStock: nozzle.tank.initialStock,
          },
          product: {
            ...nozzle.product,
            purchasePrice: nozzle.product.purchasePrice,
            sellingPrice: nozzle.product.sellingPrice,
          },
          latestReading: latestReadingsMap[nozzle.id] || null,
        })),
      })),
    };
  }

  static async checkAccess(userId: string, gasStationId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        gasStations: {
          where: {
            status: "ACTIVE",
          },
        },
      },
    });

    if (!user) return false;

    // Developer can access all gas stations
    if (user.role === "DEVELOPER") return true;

    // Administrator & OWNER_GROUP can access gas stations owned by their owner
    if (user.role === "ADMINISTRATOR" || user.role === "OWNER_GROUP") {
      if (!user.ownerId) return false;

      const gasStation = await prisma.gasStation.findFirst({
        where: {
          id: gasStationId,
          ownerId: user.ownerId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      return !!gasStation;
    }

    // Owner can access their SPBUs
    if (user.role === "OWNER") {
      const owned = await prisma.gasStation.findFirst({
        where: {
          id: gasStationId,
          ownerId: userId,
          status: "ACTIVE",
        },
      });
      return !!owned;
    }

    // Staff can access assigned SPBU
    return user.gasStations.some((gs) => gs.gasStationId === gasStationId);
  }
}

export type OperationalDataForClient = NonNullable<
  Awaited<ReturnType<typeof OperationalService.getDataForClient>>
>;

export type TankWithStock = Awaited<
  ReturnType<typeof OperationalService.getTanksWithStock>
>[number];
