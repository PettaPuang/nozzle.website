import { prisma } from "@/lib/prisma";

export class StationService {
  static async findAll(tankId?: string) {
    return await prisma.station.findMany({
      where: tankId
        ? {
            tankConnections: {
              some: {
                tankId,
              },
            },
          }
        : undefined,
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        tankConnections: {
          include: {
            tank: {
              select: {
                id: true,
                name: true,
                code: true,
                gasStation: {
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
        createdAt: "desc",
      },
    });
  }

  static async findById(id: string) {
    return await prisma.station.findUnique({
      where: { id },
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        tankConnections: {
          include: {
            tank: {
              select: {
                id: true,
                name: true,
                code: true,
                gasStation: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        nozzles: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}

// Export inferred types
export type StationWithRelations = Awaited<
  ReturnType<typeof StationService.findAll>
>[number];
export type StationDetail = Awaited<ReturnType<typeof StationService.findById>>;
