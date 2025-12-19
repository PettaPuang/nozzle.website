import { prisma } from "@/lib/prisma";
import { getDateRangeUTC, nowUTC } from "@/lib/utils/datetime";

export class NozzleService {
  static async findAll(stationId?: string) {
    return await prisma.nozzle.findMany({
      where: {
        ...(stationId ? { stationId } : {}),
        deletedAt: null, // Filter soft-deleted nozzles
      },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            gasStationId: true,
          },
        },
        tank: {
          select: {
            id: true,
            code: true,
            name: true,
            capacity: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            ron: true,
            purchasePrice: true,
            sellingPrice: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findById(id: string) {
    return await prisma.nozzle.findFirst({
      where: {
        id,
        deletedAt: null, // Filter soft-deleted nozzles
      },
      include: {
        station: {
          include: {
            gasStation: true,
          },
        },
        tank: {
          include: {
            product: true,
          },
        },
        product: true,
      },
    });
  }

  static async findByStationWithReadings(stationId: string, date?: Date) {
    const targetDate = date || nowUTC();
    const { start: startOfDay, end: endOfDay } = getDateRangeUTC(targetDate);

    const nozzles = await prisma.nozzle.findMany({
      where: {
        stationId,
        deletedAt: null, // Filter soft-deleted nozzles
      },
      include: {
        product: true,
        tank: true,
        nozzleReadings: {
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
            operatorShift: {
              select: {
                id: true,
                shift: true,
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
              },
            },
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return nozzles;
  }
}

// Export inferred types
export type NozzleWithRelations = Awaited<
  ReturnType<typeof NozzleService.findAll>
>[number];
export type NozzleDetail = Awaited<ReturnType<typeof NozzleService.findById>>;
export type NozzleWithReadings = Awaited<
  ReturnType<typeof NozzleService.findByStationWithReadings>
>[number];
