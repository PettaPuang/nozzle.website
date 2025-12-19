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
 * Rollback deposit yang sudah di-approve
 * Hanya untuk DEVELOPER dan ADMINISTRATOR
 *
 * Proses:
 * 1. Validasi chain (cek shift berikutnya)
 * 2. Reverse REVENUE dan COGS transactions yang dibuat saat approval
 * 3. Update status deposit menjadi REJECTED
 * 4. Optional: Cascade unverify shift berikutnya
 */
export async function rollbackDepositApproval(
  depositId: string,
  options: {
    cascadeUnverify?: boolean; // Unverify shift ini dan shift berikutnya
    force?: boolean; // Bypass safety validation
  } = {}
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (DEVELOPER dan ADMINISTRATOR)
    const { authorized, user, message } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return {
        success: false,
        message:
          message ||
          "Unauthorized: Hanya DEVELOPER atau ADMINISTRATOR yang bisa rollback",
      };
    }

    // 2. Get deposit data dengan shift info lengkap
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        operatorShift: {
          include: {
            gasStation: {
              select: {
                id: true,
              },
            },
            station: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!deposit) {
      return { success: false, message: "Deposit tidak ditemukan" };
    }

    // 3. Validasi: Deposit harus sudah APPROVED
    if (deposit.status !== "APPROVED") {
      return {
        success: false,
        message: "Hanya bisa rollback deposit yang sudah di-approve",
      };
    }

    const gasStationId = deposit.operatorShift.gasStationId;

    // 4. VALIDASI CHAIN: Cek apakah ada shift setelah ini yang sudah verified
    if (!options.force) {
      const { format } = await import("date-fns");
      const { id: localeId } = await import("date-fns/locale");

      // Helper untuk mendapatkan shift yang lebih besar
      const getShiftOrder = (shift: string): number => {
        if (shift === "MORNING") return 1;
        if (shift === "AFTERNOON") return 2;
        if (shift === "NIGHT") return 3;
        return 0;
      };

      const currentShiftOrder = getShiftOrder(deposit.operatorShift.shift);

      const laterVerifiedShifts = await prisma.operatorShift.findMany({
        where: {
          stationId: deposit.operatorShift.stationId,
          OR: [
            { date: { gt: deposit.operatorShift.date } },
            {
              date: deposit.operatorShift.date,
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
        orderBy: [{ date: "asc" }, { shift: "asc" }],
        take: 5,
      });

      if (laterVerifiedShifts.length > 0 && !options.cascadeUnverify) {
        const firstLater = laterVerifiedShifts[0];
        return {
          success: false,
          message: `⚠️ PERINGATAN CHAIN DATA!

Ada ${laterVerifiedShifts.length} shift setelah ini yang sudah verified di station ${deposit.operatorShift.station.name}.

Shift pertama yang terpengaruh:
- Tanggal: ${format(new Date(firstLater.date), "dd MMM yyyy", { locale: localeId })}
- Shift: ${firstLater.shift}

Rollback deposit ini akan menyebabkan data chain tidak konsisten!

SOLUSI:
1. Gunakan opsi "Cascade Unverify" untuk otomatis unverify shift-shift setelahnya, ATAU
2. Unverify shift-shift setelahnya secara manual terlebih dahulu

Hubungi DEVELOPER jika memerlukan bantuan.`,
        };
      }
    }

    // 5. Find REVENUE dan COGS transactions yang dibuat saat deposit approval
    // Gunakan waktu yang lebih spesifik untuk mencari transaction yang terkait
    const depositApprovalDate = deposit.updatedAt;
    const searchStartTime = new Date(depositApprovalDate.getTime() - 60000); // 1 menit sebelum
    const searchEndTime = new Date(depositApprovalDate.getTime() + 60000); // 1 menit setelah

    // Cari transaction berdasarkan:
    // 1. Waktu creation yang dekat dengan waktu approval deposit
    // 2. Transaction type REVENUE atau COGS
    // 3. Notes mengandung "Otomatis dibuat saat approve deposit operator"
    // 4. Description mengandung "Setoran" atau "Deposit operator"
    let transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        createdAt: {
          gte: searchStartTime,
          lte: searchEndTime,
        },
        transactionType: {
          in: ["REVENUE", "COGS"],
        },
        AND: [
          {
            OR: [
              {
                notes: {
                  contains: "Otomatis dibuat saat approve deposit operator",
                },
              },
              {
                description: {
                  contains: "Setoran",
                },
              },
              {
                description: {
                  contains: "Deposit operator",
                },
              },
            ],
          },
        ],
      },
      include: {
        journalEntries: {
          include: {
            coa: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Validasi: Pastikan transaction yang ditemukan benar-benar terkait dengan deposit ini
    // Dengan membandingkan nilai totalAmount deposit dengan nilai di transaction
    const depositTotal = deposit.totalAmount;
    
    // Jika tidak ditemukan dengan waktu ketat, coba dengan range waktu yang lebih luas
    if (transactions.length === 0) {
      const { start: startOfDay, end: endOfDay } = getDateRangeUTC(depositApprovalDate);

      transactions = await prisma.transaction.findMany({
        where: {
          gasStationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          transactionType: {
            in: ["REVENUE", "COGS"],
          },
          AND: [
            {
              OR: [
                {
                  notes: {
                    contains: "Otomatis dibuat saat approve deposit operator",
                  },
                },
                {
                  description: {
                    contains: "Setoran",
                  },
                },
              ],
            },
          ],
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

    // Cari transaction yang nilai totalAmount-nya match dengan deposit
    let revenueTransaction = transactions.find((t) => {
      if (t.transactionType !== "REVENUE") return false;
      // Hitung total credit (pendapatan) dari journal entries
      const total = t.journalEntries
        .filter((entry) => entry.credit > 0)
        .reduce((sum, entry) => sum + entry.credit, 0);
      // Toleransi 1000 untuk rounding differences
      return Math.abs(total - depositTotal) <= 1000;
    });

    // Jika tidak match, ambil yang pertama dengan type REVENUE
    if (!revenueTransaction) {
      revenueTransaction = transactions.find(
        (t) => t.transactionType === "REVENUE"
      );
    }

    const cogsTransaction = transactions.find(
      (t) => t.transactionType === "COGS"
    );

    if (!revenueTransaction) {
      return {
        success: false,
        message: "REVENUE transaction tidak ditemukan untuk deposit ini",
      };
    }

    // Validasi tambahan: Pastikan transaction benar-benar terkait dengan deposit ini
    const revenueTotal = revenueTransaction.journalEntries
      .filter((entry) => entry.credit > 0)
      .reduce((sum, entry) => sum + entry.credit, 0);

    // Jika selisih terlalu besar, beri warning tapi tetap lanjutkan
    if (Math.abs(revenueTotal - depositTotal) > 1000) {
      console.warn(
        `Warning: REVENUE transaction total (${revenueTotal}) tidak match dengan deposit total (${depositTotal}) untuk deposit ${depositId}. Tetap lanjutkan rollback.`
      );
    }

    // 6. Proses rollback dalam transaction
    await prisma.$transaction(
      async (tx) => {
        // 6.1. Reverse REVENUE transaction
        const reverseRevenueEntries = revenueTransaction.journalEntries.map(
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
          gasStationId,
          date: nowUTC(),
          description: `ROLLBACK - ${revenueTransaction.description}`,
          notes: `Rollback transaction untuk membatalkan approval deposit. Deposit ID: ${depositId}`,
          journalEntries: reverseRevenueEntries,
          createdById: user!.id,
          transactionType: "REVENUE",
          tx,
        });

        // 6.2. Reverse COGS transaction jika ada
        if (cogsTransaction) {
          const reverseCogsEntries = cogsTransaction.journalEntries.map(
            (entry) => ({
              coaId: entry.coaId,
              debit: entry.credit,
              credit: entry.debit,
              description: `ROLLBACK: ${entry.description || ""}`,
            })
          );

          await createAutoTransaction({
            gasStationId,
            date: nowUTC(),
            description: `ROLLBACK - ${cogsTransaction.description}`,
            notes: `Rollback transaction untuk membatalkan approval deposit. Deposit ID: ${depositId}`,
            journalEntries: reverseCogsEntries,
            createdById: user!.id,
            transactionType: "COGS",
            tx,
          });
        }

        // 6.3. Update status deposit menjadi REJECTED
        await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: "REJECTED",
            updatedBy: { connect: { id: user!.id } },
            updatedAt: nowUTC(),
          },
        });

        // 6.4. CASCADE UNVERIFY: Unverify shift ini dan shift berikutnya jika diminta
        if (options.cascadeUnverify) {
          // Helper untuk mendapatkan shift yang lebih besar
          const getShiftOrder = (shift: string): number => {
            if (shift === "MORNING") return 1;
            if (shift === "AFTERNOON") return 2;
            if (shift === "NIGHT") return 3;
            return 0;
          };

          const currentShiftOrder = getShiftOrder(deposit.operatorShift.shift);

          // Unverify shift ini
          await tx.operatorShift.update({
            where: { id: deposit.operatorShiftId },
            data: {
              isVerified: false,
              updatedById: user!.id,
            },
          });

          // Unverify semua shift setelahnya
          await tx.operatorShift.updateMany({
            where: {
              stationId: deposit.operatorShift.stationId,
              OR: [
                { date: { gt: deposit.operatorShift.date } },
                {
                  date: deposit.operatorShift.date,
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
              updatedById: user!.id,
            },
          });
        }
      },
      {
        timeout: 30000,
      }
    );

    revalidatePath(`/gas-stations/${gasStationId}`);

    // Get count unverified shifts untuk message
    let unverifiedCount = 0;
    if (options.cascadeUnverify) {
      const getShiftOrder = (shift: string): number => {
        if (shift === "MORNING") return 1;
        if (shift === "AFTERNOON") return 2;
        if (shift === "NIGHT") return 3;
        return 0;
      };

      const currentShiftOrder = getShiftOrder(deposit.operatorShift.shift);

      unverifiedCount = await prisma.operatorShift.count({
        where: {
          stationId: deposit.operatorShift.stationId,
          OR: [
            { date: { gt: deposit.operatorShift.date } },
            {
              date: deposit.operatorShift.date,
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

    const successMessage = options.cascadeUnverify
      ? `Deposit berhasil di-rollback. Shift ini dan ${unverifiedCount} shift setelahnya telah di-unverify untuk menjaga konsistensi data.`
      : `Deposit ${depositId} berhasil di-rollback (status diubah menjadi REJECTED dan transaksi di-reverse)`;

    return {
      success: true,
      message: successMessage,
      data: {
        depositId,
        previousStatus: "APPROVED",
        newStatus: "REJECTED",
        reversedTransactions: {
          revenue: revenueTransaction.id,
          cogs: cogsTransaction?.id,
        },
        cascadeUnverify: options.cascadeUnverify,
        unverifiedShiftsCount: unverifiedCount,
      },
    };
  } catch (error) {
    console.error("Rollback deposit approval error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal melakukan rollback deposit approval",
    };
  }
}

