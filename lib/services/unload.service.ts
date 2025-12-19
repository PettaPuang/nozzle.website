import { prisma } from "@/lib/prisma";

export class UnloadService {
  static async findByGasStation(gasStationId: string, status?: string) {
    // Fetch tank IDs untuk gas station ini terlebih dahulu untuk memastikan query konsisten
    const tankIds = await prisma.tank.findMany({
      where: { gasStationId },
      select: { id: true },
    });
    const tankIdList = tankIds.map((t) => t.id);

    // Fetch unloads dengan explicit tankId filter untuk menghindari join issue
    const unloads = await prisma.unload.findMany({
      where: {
        tankId: { in: tankIdList },
        ...(status && { status: status as any }),
      },
      select: {
        id: true,
        tankId: true,
        unloaderId: true,
        managerId: true,
        purchaseTransactionId: true,
        initialOrderVolume: true,
        deliveredVolume: true,
        literAmount: true,
        invoiceNumber: true,
        imageUrl: true,
        status: true,
        notes: true,
        createdById: true,
        createdAt: true,
        updatedById: true,
        updatedAt: true,
        tank: {
          select: {
            id: true,
            name: true,
            code: true,
            capacity: true,
            gasStationId: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                ron: true,
              },
            },
          },
        },
        unloader: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        manager: {
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
      orderBy: [
        {
          tankId: "asc",
        },
        {
          createdAt: "desc",
        },
        {
          id: "asc",
        },
      ],
    });

    // Filter out data yang mismatch untuk mencegah data salah ditampilkan
    const validatedUnloads = unloads.filter((unload) => {
      if (unload.tankId !== unload.tank.id) {
        console.error(`CRITICAL: Data mismatch for unload ${unload.id} - tankId: ${unload.tankId} vs tank.id: ${unload.tank.id}`);
        return false;
      }
      return true;
    });

    return validatedUnloads;
  }

  static async findByGasStationForClient(
    gasStationId: string,
    status?: string
  ) {
    const unloads = await this.findByGasStation(gasStationId, status);
    return unloads.map((unload) => ({
      ...unload,
      literAmount: unload.literAmount, // Sudah Int
      tank: {
        ...unload.tank,
        capacity: unload.tank.capacity, // Sudah Int
      },
    }));
  }

  static async findPendingByGasStation(gasStationId: string) {
    return this.findByGasStationForClient(gasStationId, "PENDING");
  }

  static async countPendingByGasStation(gasStationId: string) {
    return await prisma.unload.count({
      where: {
        tank: {
          gasStationId,
        },
        status: "PENDING",
      },
    });
  }

  static async findHistoryByGasStation(gasStationId: string) {
    const unloads = await this.findByGasStationForClient(gasStationId);
    // Filter hanya APPROVED dan REJECTED
    return unloads.filter(
      (u) => u.status === "APPROVED" || u.status === "REJECTED"
    );
  }
}

export type UnloadWithRelations = Awaited<
  ReturnType<typeof UnloadService.findByGasStationForClient>
>[number];
