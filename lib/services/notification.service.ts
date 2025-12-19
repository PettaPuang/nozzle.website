import { prisma } from "@/lib/prisma";

export class NotificationService {
  /**
   * Get unread notifications count for a gas station
   */
  static async getUnreadCountForGasStation(
    gasStationId: string,
    userId: string
  ): Promise<number> {
    return await prisma.notification.count({
      where: {
        gasStationId,
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Get unread notifications for a user (all gas stations)
   */
  static async getUnreadNotificationsForUser(userId: string) {
    return await prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      include: {
        gasStation: {
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

  /**
   * Get unread notifications count per gas station for a user
   * User bisa melihat notifikasi untuk SPBU yang bisa mereka akses (owner, ownerGroup, admin)
   */
  static async getUnreadCountsByGasStation(
    userId: string
  ): Promise<Record<string, number>> {
    // Get user dengan role dan ownerId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        ownerId: true,
      },
    });

    if (!user) return {};

    // Determine accessible gas station IDs
    let accessibleGasStationIds: string[] = [];

    if (user.role === "DEVELOPER") {
      // Developer bisa lihat semua
      const allGasStations = await prisma.gasStation.findMany({
        select: { id: true },
      });
      accessibleGasStationIds = allGasStations.map((gs) => gs.id);
    } else if (user.role === "OWNER") {
      // Owner bisa lihat SPBU miliknya
      const gasStations = await prisma.gasStation.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });
      accessibleGasStationIds = gasStations.map((gs) => gs.id);
    } else if (user.role === "OWNER_GROUP" || user.role === "ADMINISTRATOR") {
      // OwnerGroup dan Admin bisa lihat SPBU milik owner mereka
      if (user.ownerId) {
        const gasStations = await prisma.gasStation.findMany({
          where: { ownerId: user.ownerId },
          select: { id: true },
        });
        accessibleGasStationIds = gasStations.map((gs) => gs.id);
      }
    }

    if (accessibleGasStationIds.length === 0) return {};

    // Get notifications untuk SPBU yang bisa diakses user
    // Query berdasarkan gasStationId, bukan userId spesifik
    // Hanya hitung incoming messages (bukan outgoing/SUBSCRIPTION_EXTENSION_REQUEST)
    const notifications = await prisma.notification.findMany({
      where: {
        isRead: false,
        gasStationId: { in: accessibleGasStationIds },
        // Exclude SUBSCRIPTION_EXTENSION_REQUEST karena itu outgoing (dari owner/admin gas station)
        type: { not: "SUBSCRIPTION_EXTENSION_REQUEST" },
        // Tidak filter berdasarkan userId - semua user dengan akses ke gas station bisa lihat
      },
      select: {
        gasStationId: true,
      },
    });

    const counts: Record<string, number> = {};
    notifications.forEach((n) => {
      if (n.gasStationId) {
        counts[n.gasStationId] = (counts[n.gasStationId] || 0) + 1;
      }
    });

    return counts;
  }
}

