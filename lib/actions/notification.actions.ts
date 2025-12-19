"use server";

import { NotificationService } from "@/lib/services/notification.service";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
};

/**
 * Get unread notification counts per gas station for current user
 */
export async function getUnreadNotificationCounts(): Promise<ActionResult<Record<string, number>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }

    const counts = await NotificationService.getUnreadCountsByGasStation(
      session.user.id
    );

    return {
      success: true,
      data: counts,
    };
  } catch (error) {
    console.error("Error fetching notification counts:", error);
    return {
      success: false,
      message: "Gagal mengambil data notifikasi",
    };
  }
}

/**
 * Get notifications for a specific gas station
 * User bisa melihat notifikasi untuk SPBU yang bisa mereka akses (owner, ownerGroup, admin)
 */
export async function getNotificationsForGasStation(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }

    // Verify user has access to this gas station
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        ownerId: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "User tidak ditemukan",
      };
    }

    // Check gas station access
    let hasAccess = false;
    if (user.role === "DEVELOPER") {
      hasAccess = true;
    } else if (user.role === "OWNER") {
      const gasStation = await prisma.gasStation.findFirst({
        where: {
          id: gasStationId,
          ownerId: user.id,
        },
      });
      hasAccess = !!gasStation;
    } else if (user.role === "OWNER_GROUP" || user.role === "ADMINISTRATOR") {
      if (user.ownerId) {
        const gasStation = await prisma.gasStation.findFirst({
          where: {
            id: gasStationId,
            ownerId: user.ownerId,
          },
        });
        hasAccess = !!gasStation;
      }
    }

    if (!hasAccess) {
      return {
        success: false,
        message: "Tidak memiliki akses ke SPBU ini",
      };
    }

    // Get notifications untuk SPBU ini (berdasarkan gasStationId, bukan userId)
    // Semua user dengan akses ke gas station ini bisa melihat notifikasi yang sama
    const notifications = await prisma.notification.findMany({
      where: {
        gasStationId,
        // Tidak filter berdasarkan userId - semua user dengan akses ke gas station bisa lihat
      },
      include: {
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
        fromUser: {
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
        replyTo: {
          include: {
            fromUser: {
              include: {
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        replies: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            fromUser: {
              include: {
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: notifications,
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      success: false,
      message: "Gagal mengambil notifikasi",
    };
  }
}

/**
 * Mark notification as read
 * User bisa mark notifikasi untuk gas station yang bisa mereka akses (owner, owner group, administrator, developer)
 * Notifikasi berbasis gas station, bukan user spesifik
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        message: "Unauthorized",
      };
    }

    // Get notification dengan gas station info
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        gasStation: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!notification) {
      return {
        success: false,
        message: "Notifikasi tidak ditemukan",
      };
    }

    // Verify user has access to this gas station
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        ownerId: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "User tidak ditemukan",
      };
    }

    // Check gas station access
    let hasAccess = false;
    if (user.role === "DEVELOPER") {
      // Developer bisa akses semua gas station
      hasAccess = true;
    } else if (!notification.gasStationId) {
      // Jika tidak ada gasStationId, tidak bisa diakses
      hasAccess = false;
    } else if (user.role === "OWNER") {
      // Owner bisa akses gas station miliknya
      hasAccess = notification.gasStation?.ownerId === user.id;
    } else if (user.role === "OWNER_GROUP" || user.role === "ADMINISTRATOR") {
      // Owner group dan administrator bisa akses gas station milik owner mereka
      if (user.ownerId) {
        hasAccess = notification.gasStation?.ownerId === user.ownerId;
      }
    }

    if (!hasAccess) {
      return {
        success: false,
        message: "Tidak memiliki akses ke notifikasi ini",
      };
    }

    // Update notification as read
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: nowUTC(),
      },
    });

    return {
      success: true,
      message: "Notifikasi ditandai sebagai sudah dibaca",
    };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      message: "Gagal menandai notifikasi",
    };
  }
}
