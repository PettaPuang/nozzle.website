"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import { ROLES, hasPermission } from "@/lib/utils/permissions";
import { getCurrentUser } from "@/lib/auth";
import {
  checkInSchema,
  checkOutSchema,
  type CheckInInput,
  type CheckOutInput,
} from "@/lib/validations/operational.validation";
import { getDateRangeUTC, nowUTC, startOfDayUTC } from "@/lib/utils/datetime";

type ActionResult = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Auto-detect shift berdasarkan urutan check-in di station pada hari yang sama
 * Check-in pertama → MORNING
 * Check-in kedua → AFTERNOON
 * Check-in ketiga → NIGHT
 */
async function autoDetectShift(
  stationId: string,
  date: Date
): Promise<"MORNING" | "AFTERNOON" | "NIGHT"> {
  const normalizedDate = startOfDayUTC(date);

  // Ambil semua shift yang sudah ada (bukan CANCELLED), urutkan berdasarkan waktu check-in
  // Gunakan startTime atau createdAt untuk sorting karena lebih akurat (datetime)
  // Untuk data baru: date menyimpan datetime (waktu check-in)
  // Untuk data lama: date menyimpan start of day, tapi startTime/createdAt punya datetime
  // Untuk field @db.Date, gunakan equals dengan startOfDay untuk filter tanggal yang sama
  const shiftDate = startOfDayUTC(normalizedDate);
  const existingShifts = await prisma.operatorShift.findMany({
    where: {
      stationId,
      date: shiftDate, // Untuk @db.Date, gunakan equals dengan startOfDay
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      shift: true,
      startTime: true, // Gunakan startTime untuk sorting (datetime)
      createdAt: true, // Fallback jika startTime null
    },
    orderBy: [
      { startTime: "asc" }, // Sort berdasarkan waktu check-in (startTime)
      { createdAt: "asc" }, // Fallback jika startTime null
    ],
  });

  // Shift berdasarkan urutan: index 0 = MORNING, 1 = AFTERNOON, 2 = NIGHT
  const shiftOrder: Array<"MORNING" | "AFTERNOON" | "NIGHT"> = ["MORNING", "AFTERNOON", "NIGHT"];
  
  // Jika sudah ada 3 shift, tidak bisa check-in lagi
  if (existingShifts.length >= 3) {
    throw new Error("Maksimal 3 shift per hari di station ini");
  }

  // Return shift berdasarkan urutan check-in (index = urutan check-in)
  return shiftOrder[existingShifts.length];
}

export async function checkIn(input: CheckInInput): Promise<ActionResult> {
  try {
    // 1. Validation
    const validated = checkInSchema.parse(input);

    // 2. Normalisasi tanggal ke start of day UTC untuk konsistensi
    const normalizedDate = startOfDayUTC(validated.date);

    // 3. Auto-detect shift (ignore input.shift, pakai urutan check-in)
    let autoShift: "MORNING" | "AFTERNOON" | "NIGHT";
    try {
      autoShift = await autoDetectShift(validated.stationId, normalizedDate);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Gagal detect shift",
      };
    }

    // 4. Check permission + gas station access dalam 1 function
    const { authorized, user } = await checkPermissionWithGasStation(
      ["OPERATOR"],
      validated.gasStationId
    );
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 5. Check if station sudah ada yang check-in (belum check-out)
    // Station tidak bisa digunakan oleh lebih dari 1 user sekaligus
    const existingShiftInStation = await prisma.operatorShift.findFirst({
      where: {
        stationId: validated.stationId,
        status: {
          in: ["PENDING", "STARTED"],
        },
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
            code: true,
            name: true,
          },
        },
      },
    });

    if (existingShiftInStation) {
      // Jika station sudah ada yang check-in (user lain), tolak
      if (existingShiftInStation.operatorId !== user.id) {
        const operatorName =
          existingShiftInStation.operator.profile?.name ||
          existingShiftInStation.operator.username;
        return {
          success: false,
          message: `Station ${existingShiftInStation.station.code} - ${existingShiftInStation.station.name} sedang digunakan oleh ${operatorName}. Silakan tunggu hingga user tersebut check-out.`,
        };
      }
      // Jika user yang sama sudah check-in di station ini dengan shift yang sama (auto-detected), tolak
      if (existingShiftInStation.shift === autoShift) {
        return {
          success: false,
          message: `Anda sudah memiliki shift ${autoShift} aktif di station ini hari ini`,
        };
      }
      // Jika user yang sama sudah check-in di station ini tapi shift berbeda, izinkan (untuk multiple shift di hari yang sama)
    }

    // 6. Check if user sudah check-in di station lain (tidak bisa check-in di dua station sekaligus)
    const { start, end } = getDateRangeUTC(normalizedDate);

    const existingShiftAnywhere = await prisma.operatorShift.findFirst({
      where: {
        operatorId: user.id,
        date: {
          gte: start,
          lt: end,
        },
        status: {
          in: ["PENDING", "STARTED"],
        },
      },
      include: {
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        gasStation: {
          select: {
            name: true,
          },
        },
      },
    });

    if (existingShiftAnywhere) {
      // Jika sudah check-in di station lain (station berbeda), TOLAK SEMUA check-in baru
      if (existingShiftAnywhere.stationId !== validated.stationId) {
        return {
          success: false,
          message: `Anda sudah check-in di station ${existingShiftAnywhere.station.code} - ${existingShiftAnywhere.station.name} (${existingShiftAnywhere.gasStation.name}). Silakan check-out terlebih dahulu sebelum check-in di station lain.`,
        };
      }
    }

    // 7. Create operator shift dengan auto-detected shift
    // Field date harus start of day UTC untuk konsistensi dengan query autoDetectShift
    // Field startTime menyimpan datetime aktual check-in untuk sorting
    const checkInDateTime = nowUTC(); // Waktu check-in aktual
    const operatorShift = await prisma.operatorShift.create({
      data: {
        operatorId: user.id,
        stationId: validated.stationId,
        gasStationId: validated.gasStationId,
        shift: autoShift, // Pakai auto-detected shift, bukan input.shift
        date: normalizedDate, // Start of day UTC untuk konsistensi dengan query
        startTime: checkInDateTime, // Datetime aktual check-in untuk sorting
        status: "STARTED",
        createdById: user.id,
      },
      include: {
        station: {
          include: {
            nozzles: {
              include: {
                product: true,
              },
              orderBy: {
                code: "asc",
              },
            },
          },
        },
      },
    });

    // Transform Decimal to number for client
    const transformedData = {
      ...operatorShift,
      station: {
        ...operatorShift.station,
        nozzles: operatorShift.station.nozzles.map((nozzle) => ({
          ...nozzle,
          product: {
            ...nozzle.product,
            purchasePrice: Number(nozzle.product.purchasePrice),
            sellingPrice: Number(nozzle.product.sellingPrice),
          },
        })),
      },
    };

    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    revalidatePath(`/gas-stations/${validated.gasStationId}`, "page");

    return {
      success: true,
      message: "Check in berhasil",
      data: transformedData,
    };
  } catch (error) {
    console.error("Check in error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal check in" };
  }
}

export async function checkOut(input: CheckOutInput): Promise<ActionResult> {
  try {
    // 1. Check permission - yang bisa check-in harus bisa check-out juga
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "OPERATOR",
      "DEVELOPER",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 2. Validation
    const validated = checkOutSchema.parse(input);

    // 3. Get operator shift
    const operatorShift = await prisma.operatorShift.findUnique({
      where: { id: validated.operatorShiftId },
      include: {
        nozzleReadings: true,
        station: {
          include: {
            nozzles: true,
          },
        },
      },
    });

    if (!operatorShift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // 4. Check ownership - hanya operator yang check-in di station tersebut yang bisa checkout
    // Cek session: user.id harus sama dengan operatorId dari shift
    if (operatorShift.operatorId !== user.id) {
      return {
        success: false,
        message:
          "Ini bukan shift Anda. Hanya user yang check-in di station ini yang bisa check-out.",
      };
    }

    // 5. Check if shift already completed
    if (operatorShift.status === "COMPLETED") {
      return { success: false, message: "Shift sudah selesai" };
    }

    // 6. Check if all nozzles have CLOSE readings
    const nozzleCount = operatorShift.station.nozzles.length;
    const closeReadings = operatorShift.nozzleReadings.filter(
      (r) => r.readingType === "CLOSE"
    );

    if (closeReadings.length !== nozzleCount) {
      return {
        success: false,
        message: "Harap input reading penutupan semua nozzle terlebih dahulu",
      };
    }

    // 7. Update shift status to COMPLETED
    await prisma.operatorShift.update({
      where: { id: validated.operatorShiftId },
      data: {
        status: "COMPLETED",
        endTime: nowUTC(), // Use UTC now
        notes: validated.notes,
        updatedById: user.id,
      },
    });

    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`);
    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`, "page");

    return {
      success: true,
      message: "Check out berhasil. Silakan input setoran di Office",
    };
  } catch (error) {
    console.error("Check out error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal check out" };
  }
}

export async function getActiveShift(
  gasStationId: string,
  stationId: string
): Promise<ActionResult> {
  try {
    // 1. Check permission
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "OPERATOR",
      "MANAGER",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 2. Get today's active shift for this user and station
    const { start, end } = getDateRangeUTC(nowUTC());

    const activeShift = await prisma.operatorShift.findFirst({
      where: {
        operatorId: user.id,
        stationId,
        gasStationId,
        date: {
          gte: start,
          lt: end,
        },
        status: {
          in: ["STARTED"],
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
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        station: {
          include: {
            nozzles: {
              include: {
                product: true,
              },
              orderBy: {
                code: "asc",
              },
            },
          },
        },
      },
    });

    if (!activeShift) {
      return {
        success: false,
        message: "Tidak ada shift aktif",
        data: null,
      };
    }

    return {
      success: true,
      message: "Active shift found",
      data: activeShift,
    };
  } catch (error) {
    console.error("Get active shift error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal get active shift" };
  }
}

/**
 * Get next shift untuk preview (sebelum check-in)
 * Digunakan untuk menampilkan shift yang akan digunakan di UI
 */
export async function getNextShiftForStation(
  stationId: string,
  date: Date
): Promise<ActionResult & { data?: "MORNING" | "AFTERNOON" | "NIGHT" }> {
  try {
    // Pastikan date sudah dinormalisasi ke start of day UTC
    const normalizedDate = startOfDayUTC(date);
    const shift = await autoDetectShift(stationId, normalizedDate);
    return {
      success: true,
      message: "Shift berhasil dideteksi",
      data: shift,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal detect shift",
    };
  }
}

/**
 * Delete operator shift (untuk rollback jika reading gagal)
 * Hanya bisa delete shift yang masih STARTED dan belum ada reading
 */
export async function deleteOperatorShift(
  shiftId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    // Get shift
    const operatorShift = await prisma.operatorShift.findUnique({
      where: { id: shiftId },
      include: {
        nozzleReadings: true,
      },
    });

    if (!operatorShift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Check ownership atau DEVELOPER/ADMINISTRATOR
    if (operatorShift.operatorId !== user.id) {
      if (
        !hasPermission(user.roleCode as any, ["DEVELOPER", "ADMINISTRATOR"])
      ) {
        return { success: false, message: "Ini bukan shift Anda" };
      }
    }

    // Hanya bisa delete shift yang masih STARTED dan belum ada reading
    if (operatorShift.status !== "STARTED") {
      return {
        success: false,
        message: "Hanya bisa menghapus shift yang masih aktif",
      };
    }

    if (operatorShift.nozzleReadings.length > 0) {
      return {
        success: false,
        message: "Tidak bisa menghapus shift yang sudah ada reading",
      };
    }

    // Delete shift
    await prisma.operatorShift.delete({
      where: { id: shiftId },
    });

    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`);
    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`, "page");

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
