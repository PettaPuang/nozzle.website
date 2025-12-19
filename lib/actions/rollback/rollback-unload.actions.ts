"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
};

/**
 * Rollback unload yang sudah di-approve
 * Hanya untuk DEVELOPER
 *
 * Proses:
 * 1. Reverse transaction yang dibuat saat approval
 * 2. Rollback deliveredVolume di purchase transaction
 * 3. Update status unload menjadi REJECTED
 */
export async function rollbackUnloadApproval(
  unloadId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (DEVELOPER only)
    const { authorized, user, message } = await checkPermission(["DEVELOPER"]);
    if (!authorized) {
      return {
        success: false,
        message: message || "Unauthorized: Hanya DEVELOPER yang bisa rollback",
      };
    }

    // 2. Get unload data dengan semua relasi
    const unload = await prisma.unload.findUnique({
      where: { id: unloadId },
      include: {
        tank: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
                sellingPrice: true,
              },
            },
            gasStation: {
              select: {
                id: true,
              },
            },
          },
        },
        purchaseTransaction: {
          select: {
            id: true,
            purchaseVolume: true,
            deliveredVolume: true,
          },
        },
      },
    });

    if (!unload) {
      return { success: false, message: "Unload tidak ditemukan" };
    }

    // 3. Validasi: Unload harus sudah APPROVED
    if (unload.status !== "APPROVED") {
      return {
        success: false,
        message: "Hanya bisa rollback unload yang sudah di-approve",
      };
    }

    // 4. Cari transaction yang dibuat saat unload di-approve
    // Check apakah ini unload titipan atau unload biasa
    const isTitipanUnload = unload.notes?.includes("Isi titipan dari") || false;
    
    const unloadTransactions = await prisma.transaction.findMany({
      where: {
        gasStationId: unload.tank.gasStationId,
        transactionType: "UNLOAD",
        approvalStatus: "APPROVED",
        notes: isTitipanUnload
          ? {
              contains: "isi titipan dari",
            }
          : {
          contains: `Unload ${unload.tank.product.name}`,
        },
        createdAt: {
          gte: new Date(unload.updatedAt.getTime() - 60000),
          lte: new Date(unload.updatedAt.getTime() + 60000),
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

    // Cari transaction yang sesuai dengan unload ini
    // Simple: cari berdasarkan notes atau invoice number atau timestamp
    const currentDeliveredVolume = unload.deliveredVolume || unload.literAmount;
    
    let unloadTransaction = unloadTransactions.find((tx) => {
      // Match by invoice number (paling reliable)
      if (unload.invoiceNumber && tx.referenceNumber === unload.invoiceNumber) {
        return true;
      }
      
      // Match by notes content
      if (isTitipanUnload && tx.notes?.includes("isi titipan dari")) {
        return true;
      }
      
      // Match by product name in description
      if (tx.description?.includes(unload.tank.product.name)) {
        return true;
      }
      
      return false;
    });

    // Fallback: ambil yang pertama jika hanya ada 1 transaction
    if (!unloadTransaction && unloadTransactions.length === 1) {
      unloadTransaction = unloadTransactions[0];
    }

    if (!unloadTransaction) {
      return {
        success: false,
        message: "Transaction yang terkait dengan unload ini tidak ditemukan",
      };
    }

    // 4.5. Validasi: Cek apakah ada sales setelah unload di-approve
    const approvalDate = unload.updatedAt;
    const salesAfterApproval = await prisma.operatorShift.findMany({
      where: {
        gasStationId: unload.tank.gasStationId,
        status: "COMPLETED",
        createdAt: {
          gte: approvalDate,
        },
        nozzleReadings: {
          some: {
            nozzle: {
              tankId: unload.tankId,
            },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId: unload.tankId,
            },
          },
          include: {
            nozzle: {
              select: {
                tankId: true,
              },
            },
          },
        },
      },
    });

    // Hitung total sales setelah approval
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

    // Hitung stock saat ini (sebelum rollback)
    // Menggunakan logika yang sama dengan OperationalService
    const today = new Date();
    const startToday = new Date(today);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(today);
    endToday.setHours(23, 59, 59, 999);

    const todayReadings = await prisma.tankReading.findMany({
      where: {
        tankId: unload.tankId,
        approvalStatus: "APPROVED",
        createdAt: {
          gte: startToday,
          lte: endToday,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        literValue: true,
        createdAt: true,
      },
    });

    const latestReading = await prisma.tankReading.findFirst({
      where: {
        tankId: unload.tankId,
        approvalStatus: "APPROVED",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        literValue: true,
        createdAt: true,
      },
    });

    const approvedUnloads = await prisma.unload.findMany({
      where: {
        tankId: unload.tankId,
        status: "APPROVED",
      },
      select: {
        literAmount: true,
        createdAt: true,
      },
    });

    const completedShifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId: unload.tank.gasStationId,
        status: "COMPLETED",
        nozzleReadings: {
          some: {
            nozzle: {
              tankId: unload.tankId,
            },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId: unload.tankId,
            },
          },
          include: {
            nozzle: {
              select: {
                tankId: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    const { calculateTankStockByCalculation } = await import(
      "@/lib/utils/tank-calculations"
    );

    let currentStock = 0;
    const todayOpenReading = todayReadings.length > 0 ? todayReadings[0] : null;
    const todayCloseReading =
      todayReadings.length > 0 ? todayReadings[todayReadings.length - 1] : null;

    // Priority 1: Use today's latest reading
    if (todayCloseReading) {
      currentStock = todayCloseReading.literValue;
    }
    // Priority 2: Calculate realtime if reading exists TODAY
    else if (todayOpenReading) {
      const unloadsSinceOpen = approvedUnloads.filter(
        (u) => u.createdAt >= todayOpenReading.createdAt
      );
      const completedShiftsToday = completedShifts.filter((shift) => {
        const shiftDate = new Date(shift.date);
        return shiftDate >= startToday && shiftDate <= endToday;
      });

      let sales = 0;
      for (const shift of completedShiftsToday) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        sales += shiftSales;
      }

      const openStock = todayOpenReading.literValue;
      const unloads = unloadsSinceOpen.reduce(
        (sum, u) => sum + u.literAmount,
        0
      );

      currentStock = calculateTankStockByCalculation({
        stockOpen: openStock,
        unloads,
        sales,
      });
    }
    // Priority 3: Calculate from latest reading
    else if (latestReading) {
      const unloadsSinceReading = approvedUnloads.filter(
        (u) => u.createdAt >= latestReading.createdAt
      );
      const completedShiftsSinceReading = completedShifts.filter(
        (shift) => shift.createdAt >= latestReading.createdAt
      );

      let sales = 0;
      for (const shift of completedShiftsSinceReading) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        sales += shiftSales;
      }

      const lastStock = latestReading.literValue;
      const unloads = unloadsSinceReading.reduce(
        (sum, u) => sum + u.literAmount,
        0
      );

      currentStock = calculateTankStockByCalculation({
        stockOpen: lastStock,
        unloads,
        sales,
      });
    }
    // Priority 4: Calculate from initial stock
    else {
      const tank = await prisma.tank.findUnique({
        where: { id: unload.tankId },
        select: {
          initialStock: true,
        },
      });

      let sales = 0;
      for (const shift of completedShifts) {
        const shiftSales = calculateSalesFromNozzleReadings(
          shift.nozzleReadings.map((r) => ({
            nozzleId: r.nozzleId,
            readingType: r.readingType,
            literValue: r.totalizerReading,
            pumpTest: r.pumpTest,
          }))
        );
        sales += shiftSales;
      }

      const unloads = approvedUnloads.reduce(
        (sum, u) => sum + u.literAmount,
        0
      );
      const initialStock = tank?.initialStock || 0;

      currentStock = calculateTankStockByCalculation({
        stockOpen: initialStock,
        unloads,
        sales,
      });
    }

    // Stock setelah rollback = currentStock - unload.literAmount
    const stockAfterRollback = currentStock - unload.literAmount;

    // Warning jika ada sales setelah approval atau stock akan negatif
    const warnings: string[] = [];
    if (totalSalesAfterApproval > 0) {
      warnings.push(
        `Peringatan: Ada sales ${totalSalesAfterApproval.toLocaleString("id-ID")}L setelah unload ini di-approve. Rollback akan mengurangi stock tank.`
      );
    }
    if (stockAfterRollback < 0) {
      warnings.push(
        `Peringatan: Stock tank akan menjadi negatif (${stockAfterRollback.toLocaleString("id-ID")}L) setelah rollback. Pastikan ini sesuai dengan kondisi fisik tank.`
      );
    }

    // 5. Proses rollback dalam transaction
    await prisma.$transaction(
      async (tx) => {
        // 5.1. Reverse transaction yang dibuat saat approval
        // SIMPLE: Tinggal balik debit jadi credit, credit jadi debit
        const reverseJournalEntries = unloadTransaction!.journalEntries.map(
          (entry) => ({
            coaId: entry.coaId,
            debit: entry.credit,  // Balik: credit jadi debit
            credit: entry.debit,  // Balik: debit jadi credit
            description: `ROLLBACK: ${entry.description || ""}`,
          })
        );

        const { createAutoTransaction } = await import(
          "@/lib/actions/transaction.actions"
        );

        await createAutoTransaction({
          gasStationId: unload.tank.gasStationId,
          date: nowUTC(),
          description: `ROLLBACK: Unload ${unload.tank.product.name} - Membatalkan approval unload ID: ${unloadId}`,
          referenceNumber: unload.invoiceNumber || null,
          notes: `Rollback transaction untuk membatalkan approval unload ID: ${unloadId}. Delivered volume: ${currentDeliveredVolume}L`,
          journalEntries: reverseJournalEntries,
          createdById: user!.id,
          transactionType: "ADJUSTMENT",
          approvalStatus: "APPROVED",
          approverId: null,
          tx,
        });

        // 5.2. Rollback deliveredVolume di purchase transaction(s)
        // Saat approval, deliveredVolume bisa di-increment ke multiple purchase transactions (FIFO)
        // Kita perlu rollback dengan cara LIFO reverse (dari yang terakhir di-increment)
        if (unload.purchaseTransactionId && currentDeliveredVolume > 0) {
          // Get purchase transaction untuk mendapatkan productId
          const purchaseTx = await tx.transaction.findUnique({
            where: { id: unload.purchaseTransactionId },
            select: {
              id: true,
              productId: true,
              purchaseVolume: true,
              deliveredVolume: true,
            },
          });

          if (purchaseTx && purchaseTx.productId) {
            // Cari semua purchase transactions untuk product yang sama yang memiliki unload ini
            // Menggunakan relasi purchaseUnloads untuk mencari purchase transactions yang terkait
            const purchaseTransactionsWithUnload = await tx.transaction.findMany({
              where: {
                gasStationId: unload.tank.gasStationId,
                transactionType: "PURCHASE_BBM",
                approvalStatus: "APPROVED",
                productId: purchaseTx.productId,
                purchaseUnloads: {
                  some: {
                    id: unloadId,
                  },
                },
              },
              select: {
                id: true,
                date: true,
                purchaseVolume: true,
                deliveredVolume: true,
              },
              orderBy: {
                date: "desc", // LIFO reverse: newest first untuk rollback
                createdAt: "desc",
              },
            });

            // Jika ditemukan purchase transactions yang terkait dengan unload ini
            if (purchaseTransactionsWithUnload.length > 0) {
              // Rollback dengan LIFO reverse (dari yang terakhir di-increment)
              let remainingToRollback = currentDeliveredVolume;

              for (const pt of purchaseTransactionsWithUnload) {
                if (remainingToRollback <= 0) break;

                // Cek apakah purchase transaction ini memiliki deliveredVolume yang cukup
                // Kita rollback maksimal sesuai dengan deliveredVolume yang ada
                const volumeToRollback = Math.min(remainingToRollback, pt.deliveredVolume);

                if (volumeToRollback > 0) {
                  await tx.transaction.update({
                    where: { id: pt.id },
                    data: {
                      deliveredVolume: {
                        decrement: volumeToRollback,
                      },
                    },
                  });
                  remainingToRollback -= volumeToRollback;
                }
              }

              // Jika masih ada sisa, rollback di purchaseTransactionId utama
              if (remainingToRollback > 0 && purchaseTx.deliveredVolume >= remainingToRollback) {
                await tx.transaction.update({
                  where: { id: purchaseTx.id },
                  data: {
                    deliveredVolume: {
                      decrement: remainingToRollback,
                    },
                  },
                });
              } else if (remainingToRollback > 0) {
                // Jika purchaseTransactionId utama tidak memiliki deliveredVolume yang cukup
                // Rollback semua yang ada di purchaseTransactionId utama
                if (purchaseTx.deliveredVolume > 0) {
                  await tx.transaction.update({
                    where: { id: purchaseTx.id },
                    data: {
                      deliveredVolume: {
                        decrement: purchaseTx.deliveredVolume,
                      },
                    },
                  });
                }
                console.warn(
                  `Warning: Tidak semua deliveredVolume bisa di-rollback untuk unload ${unloadId}. Sisa: ${remainingToRollback}L. Mungkin ada purchase transactions lain yang juga di-increment.`
                );
              }
            } else {
              // Fallback: Jika tidak ditemukan purchase transactions yang terkait
              // Rollback di purchaseTransactionId yang disimpan saja
              if (purchaseTx.deliveredVolume >= currentDeliveredVolume) {
                await tx.transaction.update({
                  where: { id: purchaseTx.id },
                  data: {
                    deliveredVolume: {
                      decrement: currentDeliveredVolume,
                    },
                  },
                });
              } else {
                // Rollback semua deliveredVolume yang ada
                await tx.transaction.update({
                  where: { id: purchaseTx.id },
                  data: {
                    deliveredVolume: {
                      decrement: purchaseTx.deliveredVolume,
                    },
                  },
                });
                console.warn(
                  `Warning: deliveredVolume di purchase transaction ${purchaseTx.id} (${purchaseTx.deliveredVolume}L) kurang dari deliveredVolume unload (${currentDeliveredVolume}L). Mungkin ada purchase transactions lain yang juga di-increment.`
                );
              }
            }
          } else {
            // Fallback: Jika tidak ada productId, rollback di purchaseTransactionId saja
            await tx.transaction.update({
              where: { id: unload.purchaseTransactionId },
              data: {
                deliveredVolume: {
                  decrement: currentDeliveredVolume,
                },
              },
            });
          }
        }

        // 5.3. Update status unload menjadi REJECTED
        await tx.unload.update({
          where: { id: unloadId },
          data: {
            status: "REJECTED",
            updatedBy: { connect: { id: user!.id } },
            updatedAt: nowUTC(),
          },
        });
      },
      {
        timeout: 30000,
      }
    );

    // 6. Cache invalidation
    revalidatePath(`/gas-stations/${unload.tank.gasStationId}`);

    // 7. Return dengan warning jika ada
    const warningMessage =
      warnings.length > 0 ? warnings.join(" ") : undefined;
    const successMessage = warningMessage
      ? `${warningMessage} Unload ${unloadId} berhasil di-rollback.`
      : `Unload ${unloadId} berhasil di-rollback (status diubah menjadi REJECTED dan transaksi di-reverse)`;

    return {
      success: true,
      message: successMessage,
      data: {
        unloadId,
        previousStatus: "APPROVED",
        newStatus: "REJECTED",
        reversedTransactionId: unloadTransaction.id,
        warnings: warnings.length > 0 ? warnings : undefined,
        stockAfterRollback,
        salesAfterApproval: totalSalesAfterApproval,
        currentStock,
      },
    };
  } catch (error) {
    console.error("Rollback unload approval error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal melakukan rollback unload approval",
    };
  }
}

