import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import type { Prisma } from "@prisma/client";

export class GasStationService {
  static async findAll(includeInactive: boolean = false, ownerId?: string) {
    return await prisma.gasStation.findMany({
      where: {
        ...(includeInactive ? {} : { status: "ACTIVE" }),
        ...(ownerId ? { ownerId } : {}), // Filter by ownerId if provided
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        ownerId: true,
        openTime: true,
        closeTime: true,
        status: true,
        managerCanPurchase: true,
        financeCanPurchase: true,
        hasTitipan: true,
        titipanNames: true,
        subscriptionType: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        isTrial: true,
        createdAt: true,
        updatedAt: true,
        owner: {
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
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findById(id: string, includeInactive: boolean = false) {
    return await prisma.gasStation.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { status: "ACTIVE" }),
      },
      include: {
        owner: {
          include: {
            profile: true,
            administrators: {
              include: {
                profile: true,
              },
            },
          },
        },
        users: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        tanks: {
          include: {
            product: true,
            stationConnections: {
              include: {
                station: {
                  include: {
                    nozzles: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  static async findByIdBasic(id: string, includeInactive: boolean = false) {
    return await prisma.gasStation.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { status: "ACTIVE" }),
      },
      select: {
        id: true,
        name: true,
        address: true,
        status: true,
        openTime: true,
        closeTime: true,
      },
    });
  }

  static async findByIdForDetail(id: string, includeInactive: boolean = false) {
    const gasStation = await this.findById(id, includeInactive);
    if (!gasStation) return null;

    // Fetch stations separately with new schema
    const stations = await prisma.station.findMany({
      where: {
        gasStationId: id,
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
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    // Get staff list
    const staff = gasStation.users
      .filter((userGasStation) => userGasStation.status === "ACTIVE")
      .map((userGasStation) => userGasStation.user);

    // Get administrators (ADMINISTRATOR role only) for this owner
    const administrators = (gasStation.owner.administrators || []).filter(
      (admin) => admin.role === "ADMINISTRATOR"
    );

    // Get owner groups (OWNER_GROUP role) for this owner
    const ownerGroups = await prisma.user.findMany({
      where: {
        role: "OWNER_GROUP",
        ownerId: gasStation.ownerId,
      },
      include: {
        profile: true,
      },
    });

    // Transform Decimal to number for client
    return {
      gasStation: {
        ...gasStation,
        tanks: gasStation.tanks.map((tank) => ({
          ...tank,
          capacity: tank.capacity,
          initialStock: tank.initialStock,
          product: {
            ...tank.product,
            purchasePrice: tank.product.purchasePrice,
            sellingPrice: tank.product.sellingPrice,
          },
          stationConnections: tank.stationConnections.map((conn) => ({
            ...conn,
            station: {
              ...conn.station,
              nozzles: conn.station.nozzles.map((nozzle) => ({
                ...nozzle,
                product: {
                  ...nozzle.product,
                  purchasePrice: nozzle.product.purchasePrice,
                  sellingPrice: nozzle.product.sellingPrice,
                },
              })),
            },
          })),
        })),
      },
      stations: stations.map((station) => ({
        ...station,
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
        })),
      })),
      staff,
      administrators,
      ownerGroups,
    };
  }

  static async create(data: Prisma.GasStationCreateInput, createdById: string) {
    return await prisma.gasStation.create({
      data: {
        ...data,
        createdBy: {
          connect: { id: createdById },
        },
        createdAt: nowUTC(),
      },
    });
  }
}

// Export inferred types
export type GasStationWithOwner = Awaited<
  ReturnType<typeof GasStationService.findAll>
>[number];
export type GasStationDetail = Awaited<
  ReturnType<typeof GasStationService.findById>
>;
export type GasStationDetailForClient = NonNullable<
  Awaited<ReturnType<typeof GasStationService.findByIdForDetail>>
>;
