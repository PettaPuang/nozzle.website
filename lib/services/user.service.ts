import { prisma } from "@/lib/prisma";

export class UserService {
  static async findAll() {
    return await prisma.user.findMany({
      include: {
        profile: true,
        gasStations: {
          include: {
            gasStation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          where: {
            status: "ACTIVE",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findOwners() {
    const owners = await prisma.user.findMany({
      where: {
        role: "OWNER",
      },
      select: {
        id: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    });

    return owners.map((o) => ({
      id: o.id,
      name: o.profile?.name || "Unknown",
    }));
  }

  static async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        gasStations: {
          include: {
            gasStation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  static async findByGasStation(gasStationId: string) {
    return await prisma.user.findMany({
      where: {
        gasStations: {
          some: {
            gasStationId,
            status: "ACTIVE",
          },
        },
      },
      include: {
        profile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}

export type UserWithDetails = Awaited<
  ReturnType<typeof UserService.findAll>
>[number];
export type OwnerForSelect = Awaited<
  ReturnType<typeof UserService.findOwners>
>[number];
