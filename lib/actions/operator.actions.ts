"use server";

import { OperatorService } from "@/lib/services/operator.service";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";

type ActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

/**
 * Get shift with sales by ID
 */
export async function getShiftWithSales(
  shiftId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
      "OPERATOR",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: null };
    }

    const shiftData = await OperatorService.getShiftWithSales(shiftId);

    if (!shiftData) {
      return { success: false, message: "Shift not found", data: null };
    }

    return {
      success: true,
      data: shiftData,
    };
  } catch (error) {
    console.error("Get shift with sales error:", error);
    return { success: false, message: "Gagal mengambil data", data: null };
  }
}

/**
 * Get operator shifts with sales
 */
export async function getOperatorShiftsWithSales(
  operatorId: string,
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized, user } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "MANAGER", "OPERATOR"],
      gasStationId
    );
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized", data: null };
    }

    // Jika role OPERATOR, hanya bisa melihat data mereka sendiri
    if (user.roleCode === "OPERATOR" && user.id !== operatorId) {
      return {
        success: false,
        message: "Forbidden: You can only view your own data",
        data: null,
      };
    }

    const data = await OperatorService.getOperatorShiftsWithSales(
      operatorId,
      gasStationId
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Get operator shifts error:", error);
    return { success: false, message: "Gagal mengambil data", data: null };
  }
}

/**
 * Get station shifts with sales
 */
export async function getStationShiftsWithSales(
  stationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
      "OWNER",
      "OWNER_GROUP",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const shifts = await OperatorService.getStationShiftsWithSales(
      stationId,
      startDate,
      endDate
    );

    return {
      success: true,
      data: shifts,
    };
  } catch (error) {
    console.error("Get station shifts error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get shifts that need verification (completed but not verified)
 */
export async function getShiftsToVerify(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const { prisma } = await import("@/lib/prisma");
    const shifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "COMPLETED",
        isVerified: false, // Hanya shifts yang belum diverifikasi
        deposit: null, // Belum ada deposit
      },
      include: {
        operator: {
          select: {
            username: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        station: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        endTime: "desc",
      },
    });

    return {
      success: true,
      data: shifts,
    };
  } catch (error) {
    console.error("Get shifts to verify error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get verified shifts for history table
 */
export async function getVerifiedShifts(
  gasStationId: string,
  startDate: Date,
  endDate: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const { prisma } = await import("@/lib/prisma");
    const shifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: "COMPLETED",
        isVerified: true,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
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
        station: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }],
    });

    return {
      success: true,
      data: shifts,
    };
  } catch (error) {
    console.error("Get verified shifts error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Get all shifts (verified, unverified, and active) for history table
 */
export async function getAllShifts(
  gasStationId: string,
  startDate: Date,
  endDate: Date
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized", data: [] };
    }

    const { prisma } = await import("@/lib/prisma");
    const shifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId,
        status: {
          in: ["STARTED", "COMPLETED"], // Include active and completed shifts
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
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
        station: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }],
    });

    return {
      success: true,
      data: shifts,
    };
  } catch (error) {
    console.error("Get all shifts error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Mark shift as verified - hanya untuk verifikasi nilai totalisator
 * Deposit akan dibuat saat input deposit, bukan saat verifikasi
 *
 * SEQUENTIAL VERIFICATION:
 * - Shift harus diverifikasi berurutan (tidak boleh skip shift)
 * - Cek apakah ada shift sebelumnya yang belum diverifikasi
 */
export async function markShiftAsVerified(
  shiftId: string
): Promise<ActionResult> {
  try {
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Get shift with gas station info dan station info
    const shift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        gasStation: true,
        deposit: true,
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Check permission with gas station
    const { authorized: gasStationAuthorized } =
      await checkPermissionWithGasStation(
        ["ADMINISTRATOR", "FINANCE", "MANAGER"],
        shift.gasStationId
      );
    if (!gasStationAuthorized) {
      return { success: false, message: "Unauthorized" };
    }

    // SEQUENTIAL VERIFICATION: Cek apakah ada shift sebelumnya yang belum diverifikasi
    const { format } = await import("date-fns");
    const { id: localeId } = await import("date-fns/locale");

    // Helper untuk mendapatkan shift yang lebih kecil
    const getShiftOrder = (shift: string): number => {
      if (shift === "MORNING") return 1;
      if (shift === "AFTERNOON") return 2;
      if (shift === "NIGHT") return 3;
      return 0;
    };

    const currentShiftOrder = getShiftOrder(shift.shift);

    const previousUnverifiedShift = await prisma.operatorShift.findFirst({
      where: {
        stationId: shift.stationId,
        OR: [
          { date: { lt: shift.date } },
          {
            date: shift.date,
            shift: {
              in:
                currentShiftOrder === 3
                  ? ["MORNING", "AFTERNOON"]
                  : currentShiftOrder === 2
                  ? ["MORNING"]
                  : [],
            },
          },
        ],
        status: "COMPLETED",
        isVerified: false,
      },
      orderBy: [{ date: "desc" }, { shift: "desc" }],
    });

    if (previousUnverifiedShift) {
      const shiftLabel =
        previousUnverifiedShift.shift === "MORNING"
          ? "Shift 1"
          : previousUnverifiedShift.shift === "AFTERNOON"
          ? "Shift 2"
          : "Shift 3";

      return {
        success: false,
        message: `Tidak bisa verify shift ini. Harus verify shift sebelumnya dulu: ${format(
          new Date(previousUnverifiedShift.date),
          "dd MMM yyyy",
          {
            locale: localeId,
          }
        )} - ${shiftLabel}`,
      };
    }

    // Mark shift as verified (hanya untuk verifikasi nilai totalisator)
    // Deposit akan dibuat saat input deposit, bukan saat verifikasi
    await prisma.operatorShift.update({
      where: { id: shiftId },
      data: {
        isVerified: true,
        updatedById: user.id,
      },
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/gas-stations/${shift.gasStationId}`);

    return {
      success: true,
      message: "Shift berhasil diverifikasi",
    };
  } catch (error) {
    console.error("Mark shift as verified error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal memverifikasi shift" };
  }
}

/**
 * Check if shift can be verified (no previous unverified shifts)
 */
export async function checkShiftCanBeVerified(
  shiftId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "MANAGER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const { prisma } = await import("@/lib/prisma");

    const shift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Helper untuk mendapatkan shift order
    const getShiftOrder = (shift: string): number => {
      if (shift === "MORNING") return 1;
      if (shift === "AFTERNOON") return 2;
      if (shift === "NIGHT") return 3;
      return 0;
    };

    const currentShiftOrder = getShiftOrder(shift.shift);

    const previousUnverifiedShift = await prisma.operatorShift.findFirst({
      where: {
        stationId: shift.stationId,
        OR: [
          { date: { lt: shift.date } },
          {
            date: shift.date,
            shift: {
              in:
                currentShiftOrder === 3
                  ? ["MORNING", "AFTERNOON"]
                  : currentShiftOrder === 2
                  ? ["MORNING"]
                  : [],
            },
          },
        ],
        status: "COMPLETED",
        isVerified: false,
      },
      orderBy: [{ date: "desc" }, { shift: "desc" }],
    });

    if (previousUnverifiedShift) {
      const { format } = await import("date-fns");
      const { id: localeId } = await import("date-fns/locale");

      const shiftLabel =
        previousUnverifiedShift.shift === "MORNING"
          ? "Shift 1"
          : previousUnverifiedShift.shift === "AFTERNOON"
          ? "Shift 2"
          : "Shift 3";

      return {
        success: false,
        message: `Tidak bisa verify shift ini. Harus verify shift sebelumnya dulu: ${format(
          new Date(previousUnverifiedShift.date),
          "dd MMM yyyy",
          {
            locale: localeId,
          }
        )} - ${shiftLabel}`,
      };
    }

    return { success: true, message: "Shift dapat diverifikasi" };
  } catch (error) {
    console.error("Check shift can be verified error:", error);
    return { success: false, message: "Gagal mengecek shift" };
  }
}

/**
 * Check if shift can have deposit input (no previous shifts without deposit)
 */
export async function checkShiftCanHaveDeposit(
  shiftId: string
): Promise<ActionResult> {
  try {
    const { authorized } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message: "Unauthorized" };
    }

    const { prisma } = await import("@/lib/prisma");

    const operatorShift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!operatorShift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Helper untuk mendapatkan shift order
    const getShiftOrder = (shift: string): number => {
      if (shift === "MORNING") return 1;
      if (shift === "AFTERNOON") return 2;
      if (shift === "NIGHT") return 3;
      return 0;
    };

    const currentShiftOrder = getShiftOrder(operatorShift.shift);

    // Cari shift sebelumnya yang belum diinput deposit
    const previousShiftWithoutDeposit = await prisma.operatorShift.findFirst({
      where: {
        stationId: operatorShift.stationId,
        AND: [
          {
            OR: [
              { date: { lt: operatorShift.date } },
              {
                date: operatorShift.date,
                shift: {
                  in:
                    currentShiftOrder === 3
                      ? ["MORNING", "AFTERNOON"]
                      : currentShiftOrder === 2
                      ? ["MORNING"]
                      : [],
                },
              },
            ],
          },
          {
            status: "COMPLETED",
          },
          {
            OR: [
              { isVerified: false },
              {
                isVerified: true,
                deposit: null, // Belum ada deposit
              },
              {
                isVerified: true,
                deposit: {
                  status: {
                    notIn: ["APPROVED", "PENDING"], // Deposit ditolak atau belum dibuat
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        station: {
          select: {
            code: true,
            name: true,
          },
        },
        deposit: {
          select: {
            status: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { shift: "desc" }],
    });

    if (previousShiftWithoutDeposit) {
      const { format } = await import("date-fns");
      const { id: localeId } = await import("date-fns/locale");

      const shiftLabel =
        previousShiftWithoutDeposit.shift === "MORNING"
          ? "Shift 1"
          : previousShiftWithoutDeposit.shift === "AFTERNOON"
          ? "Shift 2"
          : "Shift 3";

      let reason = "";
      if (!previousShiftWithoutDeposit.isVerified) {
        reason = "belum diverifikasi";
      } else if (!previousShiftWithoutDeposit.deposit) {
        reason = "belum diinput deposit";
      } else if (previousShiftWithoutDeposit.deposit.status === "REJECTED") {
        reason = "deposit ditolak";
      }

      return {
        success: false,
        message: `Tidak bisa input deposit shift ini. Shift sebelumnya ${reason}: ${format(
          new Date(previousShiftWithoutDeposit.date),
          "dd MMM yyyy",
          {
            locale: localeId,
          }
        )} - ${shiftLabel}`,
      };
    }

    return { success: true, message: "Shift dapat diinput deposit" };
  } catch (error) {
    console.error("Check shift can have deposit error:", error);
    return { success: false, message: "Gagal mengecek shift" };
  }
}

/**
 * Delete operator shift - hapus shift (hanya untuk ADMINISTRATOR dan DEVELOPER)
 *
 * Proses:
 * 1. Cek shift status (hanya bisa delete shift yang belum diverifikasi)
 * 2. Delete shift (cascade delete: nozzleReadings, deposit, depositDetails)
 */
export async function deleteOperatorShift(
  shiftId: string
): Promise<ActionResult> {
  try {
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Get shift with gas station info dan station info
    const shift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        gasStation: true,
        deposit: true,
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        nozzleReadings: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Check if shift is already verified
    if (shift.isVerified) {
      return {
        success: false,
        message: `⚠️ Tidak bisa delete shift yang sudah diverifikasi.

Solusi: Unverify shift terlebih dahulu, baru delete shift.`,
      };
    }

    // Check permission with gas station
    const { authorized: gasStationAuthorized } =
      await checkPermissionWithGasStation(
        ["ADMINISTRATOR", "DEVELOPER"],
        shift.gasStationId
      );
    if (!gasStationAuthorized) {
      return { success: false, message: "Unauthorized" };
    }

    // Delete dalam transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete deposit shift ini (jika ada)
      if (shift.deposit) {
        await tx.depositDetail.deleteMany({
          where: { depositId: shift.deposit.id },
        });
        await tx.deposit.delete({
          where: { id: shift.deposit.id },
        });
      }

      // 2. Delete nozzle readings
      await tx.nozzleReading.deleteMany({
        where: { operatorShiftId: shiftId },
      });

      // 3. Delete shift
      await tx.operatorShift.delete({
        where: { id: shiftId },
      });
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/gas-stations/${shift.gasStationId}`);

    return {
      success: true,
      message: "Shift berhasil dihapus",
    };
  } catch (error) {
    console.error("Delete operator shift error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal menghapus shift" };
  }
}

/**
 * Unverify shift - rollback verifikasi (hanya untuk ADMINISTRATOR dan DEVELOPER)
 *
 * Proses:
 * 1. Cek deposit status (tidak bisa unverify jika deposit sudah APPROVED)
 * 2. Delete deposit jika ada (status PENDING/REJECTED)
 * 3. Cascade unverify shift berikutnya untuk menjaga konsistensi chain
 * 4. Unverify shift ini
 */
export async function unverifyShift(
  shiftId: string,
  options: {
    cascadeUnverify?: boolean; // Default true untuk keamanan data
  } = { cascadeUnverify: true }
): Promise<ActionResult> {
  try {
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "DEVELOPER",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    const { prisma } = await import("@/lib/prisma");

    // Get shift with gas station info dan station info
    const shift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        gasStation: true,
        deposit: true,
        station: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Check if shift has deposit with status APPROVED
    if (shift.deposit && shift.deposit.status === "APPROVED") {
      return {
        success: false,
        message: `Tidak bisa unverify shift yang depositnya sudah APPROVED.

Solusi: Rollback deposit terlebih dahulu, baru unverify shift.`,
      };
    }

    // Check permission with gas station
    const { authorized: gasStationAuthorized } =
      await checkPermissionWithGasStation(
        ["ADMINISTRATOR", "DEVELOPER", "FINANCE"],
        shift.gasStationId
      );
    if (!gasStationAuthorized) {
      return { success: false, message: "Unauthorized" };
    }

    // Helper untuk mendapatkan shift yang lebih besar
    const getShiftOrder = (shift: string): number => {
      if (shift === "MORNING") return 1;
      if (shift === "AFTERNOON") return 2;
      if (shift === "NIGHT") return 3;
      return 0;
    };

    const currentShiftOrder = getShiftOrder(shift.shift);

    // Proses dalam transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete deposit jika ada (status PENDING/REJECTED)
      if (shift.deposit) {
        // Delete deposit details dulu (foreign key)
        await tx.depositDetail.deleteMany({
          where: { depositId: shift.deposit.id },
        });

        // Delete deposit
        await tx.deposit.delete({
          where: { id: shift.deposit.id },
        });
      }

      // 2. Unverify shift ini
      await tx.operatorShift.update({
        where: { id: shiftId },
        data: {
          isVerified: false,
          updatedById: user.id,
        },
      });

      // 3. CASCADE UNVERIFY: Unverify shift berikutnya jika diminta
      if (options.cascadeUnverify) {
        await tx.operatorShift.updateMany({
          where: {
            stationId: shift.stationId,
            OR: [
              { date: { gt: shift.date } },
              {
                date: shift.date,
                shift: {
                  in:
                    currentShiftOrder === 1
                      ? ["AFTERNOON", "NIGHT"]
                      : currentShiftOrder === 2
                      ? ["NIGHT"]
                      : [],
                },
              },
            ],
            isVerified: true,
          },
          data: {
            isVerified: false,
            updatedById: user.id,
          },
        });
      }
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/gas-stations/${shift.gasStationId}`);

    // Get count unverified shifts untuk message
    let unverifiedCount = 0;
    if (options.cascadeUnverify) {
      unverifiedCount = await prisma.operatorShift.count({
        where: {
          stationId: shift.stationId,
          OR: [
            { date: { gt: shift.date } },
            {
              date: shift.date,
              shift: {
                in:
                  currentShiftOrder === 1
                    ? ["AFTERNOON", "NIGHT"]
                    : currentShiftOrder === 2
                    ? ["NIGHT"]
                    : [],
              },
            },
          ],
          isVerified: false,
        },
      });
    }

    const successMessage =
      options.cascadeUnverify && unverifiedCount > 0
        ? `Shift berhasil di-unverify. ${unverifiedCount} shift setelahnya juga di-unverify untuk menjaga konsistensi data chain.`
        : "Shift berhasil di-unverify";

    return {
      success: true,
      message: successMessage,
      data: {
        unverifiedShiftsCount: unverifiedCount,
      },
    };
  } catch (error) {
    console.error("Unverify shift error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal unverify shift" };
  }
}
