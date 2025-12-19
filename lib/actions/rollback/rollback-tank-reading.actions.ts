"use server";

import { prisma } from "@/lib/prisma";
import { getDateRangeUTC, nowUTC } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
};

/**
 * Rollback tank reading yang sudah di-approve
 * Hanya untuk DEVELOPER
 *
 * Proses:
 * 1. Reverse transaction yang dibuat saat approval (TANK_READING transaction)
 * 2. Update status tank reading menjadi REJECTED
 * 3. Validasi: cek apakah ada reading lain setelah reading ini
 */
export async function rollbackTankReadingApproval(
  tankReadingId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (DEVELOPER atau ADMINISTRATOR)
    const { authorized, user, message } = await checkPermission(["DEVELOPER", "ADMINISTRATOR"]);
    if (!authorized) {
      return {
        success: false,
        message: message || "Unauthorized: Hanya DEVELOPER atau ADMINISTRATOR yang bisa rollback",
      };
    }

    // 2. Get tank reading data dengan semua relasi
    const reading = await prisma.tankReading.findUnique({
      where: { id: tankReadingId },
      include: {
        tank: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
              },
            },
            gasStation: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!reading) {
      return { success: false, message: "Tank reading tidak ditemukan" };
    }

    // 3. Validasi: Tank reading harus sudah APPROVED
    if (reading.approvalStatus !== "APPROVED") {
      return {
        success: false,
        message: "Hanya bisa rollback tank reading yang sudah di-approve",
      };
    }

    // 4. Cari transaction yang dibuat saat tank reading di-approve
    const approvalDate = reading.updatedAt;
    const searchStartTime = new Date(approvalDate.getTime() - 60000); // 1 menit sebelum
    const searchEndTime = new Date(approvalDate.getTime() + 60000); // 1 menit setelah

    // Cari transaction berdasarkan:
    // 1. Waktu creation yang dekat dengan waktu approval
    // 2. Transaction type TANK_READING
    // 3. Notes mengandung "tank reading menunjukkan loss/profit"
    // 4. Description mengandung nama product
    let transactions = await prisma.transaction.findMany({
      where: {
        gasStationId: reading.tank.gasStationId,
        createdAt: {
          gte: searchStartTime,
          lte: searchEndTime,
        },
        transactionType: "TANK_READING",
        approvalStatus: "APPROVED",
        notes: {
          contains: "tank reading menunjukkan",
        },
      },
      include: {
        journalEntries: {
          include: {
            coa: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Jika tidak ditemukan dengan waktu ketat, coba dengan range waktu yang lebih luas
    if (transactions.length === 0) {
      const { start: startOfDay, end: endOfDay } = getDateRangeUTC(approvalDate);

      transactions = await prisma.transaction.findMany({
        where: {
          gasStationId: reading.tank.gasStationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          transactionType: "TANK_READING",
          approvalStatus: "APPROVED",
          notes: {
            contains: "tank reading menunjukkan",
          },
        },
        include: {
          journalEntries: {
            include: {
              coa: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    // Cari transaction yang sesuai dengan tank reading ini
    // Identifikasi berdasarkan description yang mengandung nama product
    const productName = reading.tank.product.name.trim();
    let tankReadingTransaction = transactions.find((tx) => {
      // Cek apakah description mengandung nama product
      if (tx.description && tx.description.includes(productName)) {
        return true;
      }
      // Cek apakah notes mengandung tank reading ID atau product name
      if (tx.notes && (tx.notes.includes(productName) || tx.notes.includes(tankReadingId))) {
        return true;
      }
      return false;
    });

    // Jika masih tidak ditemukan, ambil yang pertama dengan type TANK_READING di hari yang sama
    if (!tankReadingTransaction && transactions.length > 0) {
      // Cek apakah ada transaction yang dibuat pada waktu yang sama dengan approval
      tankReadingTransaction = transactions.find((tx) => {
        const txTime = new Date(tx.createdAt).getTime();
        const approvalTime = approvalDate.getTime();
        // Toleransi 5 menit
        return Math.abs(txTime - approvalTime) <= 5 * 60 * 1000;
      });

      // Jika masih tidak ditemukan, ambil yang pertama
      if (!tankReadingTransaction) {
        tankReadingTransaction = transactions[0];
      }
    }

    // 5. Validasi: Cek apakah ada tank reading lain yang di-approve setelah reading ini
    const readingsAfter = await prisma.tankReading.findMany({
      where: {
        tankId: reading.tankId,
        approvalStatus: "APPROVED",
        createdAt: {
          gt: reading.createdAt,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        literValue: true,
        createdAt: true,
      },
    });

    const warnings: string[] = [];
    if (readingsAfter.length > 0) {
      warnings.push(
        `Peringatan: Ada ${readingsAfter.length} tank reading yang sudah di-approve setelah reading ini. Rollback akan mempengaruhi perhitungan stock tank.`
      );
    }

    // 6. Validasi: Cek apakah ada sales setelah approval
    const salesAfterApproval = await prisma.operatorShift.findMany({
      where: {
        gasStationId: reading.tank.gasStationId,
        status: "COMPLETED",
        deposit: {
          status: "APPROVED",
        },
        createdAt: {
          gte: approvalDate,
        },
        nozzleReadings: {
          some: {
            nozzle: {
              tankId: reading.tankId,
            },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId: reading.tankId,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    const { calculateSalesFromNozzleReadings } = await import(
      "@/lib/utils/tank-calculations"
    );
    let totalSalesAfterApproval = 0;
    for (const shift of salesAfterApproval) {
      const shiftSales = calculateSalesFromNozzleReadings(
        shift.nozzleReadings.map((r) => ({
          nozzleId: r.nozzleId,
          readingType: r.readingType,
          literValue: r.totalizerReading,
          pumpTest: r.pumpTest,
        }))
      );
      totalSalesAfterApproval += shiftSales;
    }

    if (totalSalesAfterApproval > 0) {
      warnings.push(
        `Peringatan: Ada sales ${totalSalesAfterApproval.toLocaleString("id-ID")}L setelah tank reading ini di-approve. Stock tank akan dihitung ulang menggunakan reading sebelumnya.`
      );
    }

    // 7. Proses rollback dalam transaction
    await prisma.$transaction(
      async (tx) => {
        // 7.1. Reverse transaction yang dibuat saat approval (jika ada)
        if (tankReadingTransaction) {
          const reverseJournalEntries = tankReadingTransaction.journalEntries.map(
            (entry) => ({
              coaId: entry.coaId,
              debit: entry.credit,
              credit: entry.debit,
              description: `ROLLBACK: ${entry.description || ""}`,
            })
          );

          const { createAutoTransaction } = await import(
            "@/lib/actions/transaction.actions"
          );

          await createAutoTransaction({
            gasStationId: reading.tank.gasStationId,
            date: nowUTC(),
            description: `ROLLBACK: Tank Reading ${productName} - Membatalkan approval tank reading ID: ${tankReadingId}`,
            notes: `Rollback transaction untuk membatalkan approval tank reading ID: ${tankReadingId}. Liter value: ${reading.literValue}L`,
            journalEntries: reverseJournalEntries,
            createdById: user!.id,
            transactionType: "ADJUSTMENT",
            approvalStatus: "APPROVED",
            approverId: null,
            tx,
          });
        } else {
          console.warn(
            `Warning: Transaction untuk tank reading ${tankReadingId} tidak ditemukan. Mungkin tidak ada variance atau transaction sudah dihapus.`
          );
        }

        // 7.2. Update status tank reading menjadi REJECTED
        await tx.tankReading.update({
          where: { id: tankReadingId },
          data: {
            approvalStatus: "REJECTED",
            approverId: null, // Reset approver karena di-rollback
            updatedById: user!.id,
            updatedAt: nowUTC(),
          },
        });
      },
      {
        timeout: 30000,
      }
    );

    // 8. Cache invalidation
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}`);
    revalidatePath(`/gas-stations/${reading.tank.gasStationId}/tank-history`);

    // 9. Return dengan warning jika ada
    const warningMessage =
      warnings.length > 0 ? warnings.join(" ") : undefined;
    const successMessage = warningMessage
      ? `${warningMessage} Tank reading ${tankReadingId} berhasil di-rollback.`
      : `Tank reading ${tankReadingId} berhasil di-rollback (status diubah menjadi REJECTED dan transaksi di-reverse)`;

    return {
      success: true,
      message: successMessage,
      data: {
        tankReadingId,
        previousStatus: "APPROVED",
        newStatus: "REJECTED",
        reversedTransactionId: tankReadingTransaction?.id,
        warnings: warnings.length > 0 ? warnings : undefined,
        readingsAfter: readingsAfter.length,
        salesAfterApproval: totalSalesAfterApproval,
      },
    };
  } catch (error) {
    console.error("Rollback tank reading approval error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal melakukan rollback tank reading approval",
    };
  }
}

