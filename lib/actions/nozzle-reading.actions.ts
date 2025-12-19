"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";
import { hasPermission } from "@/lib/utils/permissions";
import {
  bulkCreateNozzleReadingSchema,
  type BulkCreateNozzleReadingInput,
  updateNozzleReadingSchema,
} from "@/lib/validations/operational.validation";
import { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: any;
};

export async function bulkCreateNozzleReading(
  input: BulkCreateNozzleReadingInput
): Promise<ActionResult> {
  try {
    // 1. Check permission - OPERATOR bisa input reading, DEVELOPER & ADMINISTRATOR otomatis bypass
    const { authorized, user } = await checkPermission(["OPERATOR"]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 2. Validation
    const validated = bulkCreateNozzleReadingSchema.parse(input);

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

    // 4. Check ownership - hanya operator yang punya shift atau DEVELOPER/ADMINISTRATOR yang bisa input reading
    if (operatorShift.operatorId !== user.id) {
      if (
        !hasPermission(user.roleCode as any, ["DEVELOPER", "ADMINISTRATOR"])
      ) {
        return { success: false, message: "Ini bukan shift Anda" };
      }
    }

    // 5. Check if shift is active
    if (operatorShift.status !== "STARTED") {
      return { success: false, message: "Shift tidak aktif" };
    }

    // 6. Check if readings for this type already exist
    const existingReadings = operatorShift.nozzleReadings.filter(
      (r) => r.readingType === validated.readingType
    );

    if (existingReadings.length > 0) {
      return {
        success: false,
        message: `Reading ${
          validated.readingType === "OPEN" ? "pembukaan" : "penutupan"
        } sudah diinput`,
      };
    }

    // 7. Validate CLOSE readings (must have OPEN first)
    if (validated.readingType === "CLOSE") {
      const openReadings = operatorShift.nozzleReadings.filter(
        (r) => r.readingType === "OPEN"
      );

      if (openReadings.length === 0) {
        return {
          success: false,
          message: "Harap input reading pembukaan terlebih dahulu",
        };
      }

      // Check all nozzles have OPEN reading
      const nozzleIds = validated.readings.map((r) => r.nozzleId);
      const missingOpen = nozzleIds.filter(
        (nozzleId) => !openReadings.some((r) => r.nozzleId === nozzleId)
      );

      if (missingOpen.length > 0) {
        return {
          success: false,
          message: "Semua nozzle harus memiliki reading pembukaan",
        };
      }

      // Validate CLOSE >= OPEN
      for (const reading of validated.readings) {
        const openReading = openReadings.find(
          (r) => r.nozzleId === reading.nozzleId
        );
        if (
          openReading &&
          reading.totalizerReading < Number(openReading.totalizerReading)
        ) {
          return {
            success: false,
            message: "Reading penutupan tidak boleh kurang dari pembukaan",
          };
        }
      }
    }

    // 8. Create readings
    await prisma.nozzleReading.createMany({
      data: validated.readings.map((reading) => {
        // Convert imageUrl array to comma-separated string if needed
        const imageUrlString = reading.imageUrl
          ? Array.isArray(reading.imageUrl)
            ? reading.imageUrl.join(",")
            : reading.imageUrl
          : undefined;

        return {
          operatorShiftId: validated.operatorShiftId,
          nozzleId: reading.nozzleId,
          readingType: validated.readingType,
          totalizerReading: reading.totalizerReading,
          pumpTest: reading.pumpTest || 0,
          priceSnapshot: reading.priceSnapshot,
          imageUrl: imageUrlString,
          notes: reading.notes,
          createdById: user.id,
        };
      }),
    });

    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`);
    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`, "page");

    return {
      success: true,
      message: `Reading ${
        validated.readingType === "OPEN" ? "pembukaan" : "penutupan"
      } berhasil disimpan`,
    };
  } catch (error) {
    console.error("Bulk create nozzle reading error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal menyimpan reading" };
  }
}

/**
 * Update nozzle reading - hanya untuk FINANCE untuk koreksi totalisator
 */
export async function updateNozzleReading(
  readingId: string,
  input: z.infer<typeof updateNozzleReadingSchema>
): Promise<ActionResult> {
  try {
    // 1. Check permission - hanya FINANCE yang bisa update reading
    const { authorized, user } = await checkPermission(["FINANCE"]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 2. Validation
    const validated = updateNozzleReadingSchema.parse(input);

    // 3. Get nozzle reading dengan shift dan deposit
    const nozzleReading = await prisma.nozzleReading.findUnique({
      where: { id: readingId },
      include: {
        operatorShift: {
          include: {
            nozzleReadings: true,
            deposit: true, // Include deposit untuk cek status
          },
        },
        nozzle: true,
      },
    });

    if (!nozzleReading) {
      return { success: false, message: "Reading tidak ditemukan" };
    }

    // 4. Check if shift is COMPLETED (hanya bisa edit setelah shift selesai)
    if (nozzleReading.operatorShift.status !== "COMPLETED") {
      return {
        success: false,
        message: "Hanya bisa mengedit reading untuk shift yang sudah selesai",
      };
    }

    // 4.5. Check if deposit sudah APPROVED (tidak boleh edit jika sudah approved)
    // Jika deposit sudah APPROVED, transaksi sudah dibuat dan tank stock sudah dikurangi
    // Edit reading setelah approval akan menyebabkan inkonsistensi data
    if (nozzleReading.operatorShift.deposit?.status === "APPROVED") {
      return {
        success: false,
        message: "Tidak bisa mengedit reading karena deposit sudah di-approve. Silakan rollback deposit terlebih dahulu jika perlu perubahan.",
      };
    }

    // 5. Validasi jika update totalizerReading
    if (validated.totalizerReading !== undefined) {
      // Jika OPEN reading, validasi tidak boleh lebih besar dari CLOSE reading
      if (nozzleReading.readingType === "OPEN") {
        const closeReading = nozzleReading.operatorShift.nozzleReadings.find(
          (r) =>
            r.nozzleId === nozzleReading.nozzleId &&
            r.readingType === "CLOSE"
        );
        if (
          closeReading &&
          validated.totalizerReading > Number(closeReading.totalizerReading)
        ) {
          return {
            success: false,
            message:
              "Reading pembukaan tidak boleh lebih besar dari reading penutupan",
          };
        }
      }

      // Jika CLOSE reading, validasi tidak boleh lebih kecil dari OPEN reading
      if (nozzleReading.readingType === "CLOSE") {
        const openReading = nozzleReading.operatorShift.nozzleReadings.find(
          (r) =>
            r.nozzleId === nozzleReading.nozzleId &&
            r.readingType === "OPEN"
        );
        if (
          openReading &&
          validated.totalizerReading < Number(openReading.totalizerReading)
        ) {
          return {
            success: false,
            message:
              "Reading penutupan tidak boleh lebih kecil dari reading pembukaan",
          };
        }

        // CHAIN VALIDATION: Cek konsistensi dengan shift berikutnya
        // Jika edit CLOSE reading, cek apakah shift berikutnya punya OPEN reading yang match
        const { format } = await import("date-fns");
        const { id: localeId } = await import("date-fns/locale");

        const getShiftOrder = (shift: string): number => {
          if (shift === "MORNING") return 1;
          if (shift === "AFTERNOON") return 2;
          if (shift === "NIGHT") return 3;
          return 0;
        };

        const currentShiftOrder = getShiftOrder(
          nozzleReading.operatorShift.shift
        );

        const nextShift = await prisma.operatorShift.findFirst({
          where: {
            stationId: nozzleReading.operatorShift.stationId,
            OR: [
              { date: { gt: nozzleReading.operatorShift.date } },
              {
                date: nozzleReading.operatorShift.date,
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
            status: "COMPLETED",
          },
          include: {
            nozzleReadings: {
              where: {
                nozzleId: nozzleReading.nozzleId,
                readingType: "OPEN",
              },
            },
          },
          orderBy: [{ date: "asc" }, { shift: "asc" }],
        });

        if (nextShift && nextShift.nozzleReadings.length > 0) {
          const nextOpenReading = nextShift.nozzleReadings[0];
          const nextOpenValue = Number(nextOpenReading.totalizerReading);

          // Jika next shift OPEN reading tidak match dengan new CLOSE reading
          if (nextOpenValue !== validated.totalizerReading) {
            console.warn(
              `Warning: Chain inconsistency detected. Next shift OPEN reading (${nextOpenValue}) tidak match dengan new CLOSE reading (${validated.totalizerReading})`
            );

            // Return warning tapi tidak block (biarkan finance yang decide)
            return {
              success: false,
              message: `⚠️ CHAIN DATA INCONSISTENCY!

Shift berikutnya memiliki OPEN reading yang berbeda:
- Current CLOSE (yang akan disimpan): ${validated.totalizerReading}
- Next OPEN (shift berikutnya): ${nextOpenValue}
- Selisih: ${Math.abs(nextOpenValue - validated.totalizerReading)}L

Shift berikutnya:
- Tanggal: ${format(new Date(nextShift.date), "dd MMM yyyy", { locale: localeId })}
- Shift: ${nextShift.shift}

⚡ Edit ini akan menyebabkan gap data chain!

REKOMENDASI:
1. Pastikan nilai CLOSE sudah benar
2. Edit juga OPEN reading shift berikutnya jika perlu
3. Atau unverify shift berikutnya terlebih dahulu

Tetap lanjutkan edit?`,
            };
          }
        }
      }
    }

    // 6. Update reading
    const updateData: any = {
      updatedById: user.id,
    };

    if (validated.totalizerReading !== undefined) {
      updateData.totalizerReading = validated.totalizerReading;
    }
    if (validated.pumpTest !== undefined) {
      updateData.pumpTest = validated.pumpTest;
    }
    if (validated.priceSnapshot !== undefined) {
      updateData.priceSnapshot = validated.priceSnapshot;
    }
    if (validated.imageUrl !== undefined) {
      // Convert imageUrl array to comma-separated string if needed
      updateData.imageUrl = Array.isArray(validated.imageUrl)
        ? validated.imageUrl.join(",")
        : validated.imageUrl;
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }

    await prisma.nozzleReading.update({
      where: { id: readingId },
      data: updateData,
    });

    revalidatePath(
      `/gas-stations/${nozzleReading.operatorShift.gasStationId}`
    );
    revalidatePath(
      `/gas-stations/${nozzleReading.operatorShift.gasStationId}`,
      "page"
    );

    return {
      success: true,
      message: "Reading berhasil diupdate",
    };
  } catch (error) {
    console.error("Update nozzle reading error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal mengupdate reading" };
  }
}
