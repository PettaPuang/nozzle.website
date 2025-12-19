import { prisma } from "@/lib/prisma";

export class TankService {
  static async findAll(gasStationId?: string) {
    return await prisma.tank.findMany({
      where: gasStationId ? { gasStationId } : undefined,
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findAllForClient(gasStationId?: string) {
    const tanks = await this.findAll(gasStationId);
    return tanks.map((tank) => ({
      ...tank,
      capacity: tank.capacity, // Sudah Int
    }));
  }

  static async findById(id: string) {
    return await prisma.tank.findUnique({
      where: { id },
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        stationConnections: {
          include: {
            station: {
              include: {
                nozzles: true,
              },
            },
          },
        },
      },
    });
  }
}

// Export inferred types
export type TankWithRelations = Awaited<
  ReturnType<typeof TankService.findAll>
>[number];
export type TankDetail = Awaited<ReturnType<typeof TankService.findById>>;
export type TankForClient = Awaited<
  ReturnType<typeof TankService.findAllForClient>
>[number];
