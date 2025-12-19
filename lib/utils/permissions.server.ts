// Server-only permission utilities

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "./permissions";
import { hasPermission, ROLES } from "./permissions";

/**
 * Check permission dengan auto fetch current user
 * Gabungan auth check + permission check dalam 1 function
 * DEVELOPER selalu authorized!
 * HANYA UNTUK SERVER ACTIONS/API ROUTES!
 *
 * @param requiredRoles - Array role yang dibutuhkan
 * @returns Object dengan authorized status, user, dan message
 *
 * @example
 * ```typescript
 * // Dalam server action
 * const { authorized, user, message } = await checkPermission(["OPERATOR"]);
 * if (!authorized) {
 *   return { success: false, message };
 * }
 * // user sudah bisa langsung dipakai untuk audit trail
 * ```
 */
export async function checkPermission(requiredRoles: RoleCode[]) {
  const user = await getCurrentUser();

  if (!user?.id) {
    return {
      authorized: false,
      message: "Unauthorized",
      user: null,
    };
  }

  // Menggunakan hasPermission yang sudah handle DEVELOPER & ADMINISTRATOR bypass
  if (!hasPermission(user.roleCode as RoleCode, requiredRoles)) {
    const rolesStr = requiredRoles.join(", ");
    return {
      authorized: false,
      message: `Forbidden: ${rolesStr} only`,
      user: null,
    };
  }

  return { authorized: true, message: "Authorized", user };
}

/**
 * Check gas station access
 * DEVELOPER selalu authorized
 * ADMINISTRATOR & OWNER_GROUP: check apakah gas station milik ownernya
 * OWNER: check apakah gas station miliknya
 * OWNER_GROUP memiliki permission yang sama dengan OWNER (melalui ownerId)
 *
 * @param userId - User ID
 * @param gasStationId - Gas Station ID
 * @returns boolean - true jika user bisa akses gas station tersebut
 */
export async function checkGasStationAccess(
  userId: string,
  gasStationId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      ownerId: true,
      gasStations: {
        where: {
          gasStationId,
          status: "ACTIVE",
        },
        select: {
          gasStationId: true,
        },
      },
    },
  });

  if (!user) return false;

  // Developer selalu authorized
  if (user.role === ROLES.DEVELOPER) return true;

  // ADMINISTRATOR & OWNER_GROUP: check apakah gas station milik ownernya dan ACTIVE
  if (user.role === ROLES.ADMINISTRATOR || user.role === ROLES.OWNER_GROUP) {
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

  // OWNER: check apakah gas station miliknya dan ACTIVE
  // OWNER_GROUP sudah dihandle di atas (memiliki permission yang sama dengan OWNER melalui ownerId)
  if (user.role === ROLES.OWNER) {
    const gasStation = await prisma.gasStation.findFirst({
      where: {
        id: gasStationId,
        ownerId: userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    return !!gasStation;
  }

  // Staff: check apakah assigned ke gas station tersebut
  return user.gasStations.length > 0;
}

/**
 * Check permission + gas station access dalam 1 function
 * DEVELOPER selalu authorized!
 * ADMINISTRATOR perlu check gas station access berdasarkan owner
 * OWNER_GROUP memiliki permission yang sama dengan OWNER
 *
 * @param requiredRoles - Array role yang dibutuhkan
 * @param gasStationId - Gas Station ID (optional, hanya untuk action yang terkait gas station)
 * @returns Object dengan authorized status, user, dan message
 *
 * @example
 * ```typescript
 * // Action yang terkait gas station
 * const { authorized, user, message } = await checkPermissionWithGasStation(
 *   ["OPERATOR", "MANAGER"],
 *   gasStationId
 * );
 * if (!authorized) {
 *   return { success: false, message };
 * }
 *
 * // Action yang tidak terkait gas station
 * const { authorized, user, message } = await checkPermissionWithGasStation(["FINANCE"]);
 * ```
 */
export async function checkPermissionWithGasStation(
  requiredRoles: RoleCode[],
  gasStationId?: string
) {
  const user = await getCurrentUser();

  if (!user?.id) {
    return {
      authorized: false,
      message: "Unauthorized",
      user: null,
    };
  }

  // Menggunakan hasPermission yang sudah handle DEVELOPER & ADMINISTRATOR bypass
  // DEVELOPER selalu authorized (pass semua hal di aplikasi)
  if (user.roleCode === ROLES.DEVELOPER) {
    return { authorized: true, message: "Authorized", user };
  }

  // ADMINISTRATOR & OWNER_GROUP: jika ada gasStationId, check gas station access dulu
  // Jika tidak ada gasStationId, Administrator & OWNER_GROUP bisa pass semua permission check (via hasPermission)
  if (user.roleCode === ROLES.ADMINISTRATOR || user.roleCode === ROLES.OWNER_GROUP) {
    if (gasStationId) {
      const hasAccess = await checkGasStationAccess(user.id, gasStationId);
      if (!hasAccess) {
        return {
          authorized: false,
          message: "Forbidden: No access to this gas station",
          user: null,
        };
      }
    }
    // Administrator & OWNER_GROUP bisa pass semua permission check dalam gas station milik ownernya
    return { authorized: true, message: "Authorized", user };
  }

  // Check role permission menggunakan hasPermission (sudah handle OWNER_GROUP = OWNER)
  if (!hasPermission(user.roleCode as RoleCode, requiredRoles)) {
    const rolesStr = requiredRoles.join(", ");
    return {
      authorized: false,
      message: `Forbidden: ${rolesStr} only`,
      user: null,
    };
  }

  // Jika ada gasStationId, check gas station access untuk role lain (termasuk OWNER & OWNER_GROUP)
  if (gasStationId) {
    const hasAccess = await checkGasStationAccess(user.id, gasStationId);
    if (!hasAccess) {
      return {
        authorized: false,
        message: "Forbidden: No access to this gas station",
        user: null,
      };
    }
  }

  return { authorized: true, message: "Authorized", user };
}
