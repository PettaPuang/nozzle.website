"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import {
  createUnloadSchema,
  updateUnloadSchema,
} from "@/lib/validations/operational.validation";
import { z } from "zod";
import { OperationalService } from "@/lib/services/operational.service";
import {
  calculateTankStockByCalculation,
  calculateSalesFromNozzleReadings,
} from "@/lib/utils/tank-calculations";
import { todayRangeUTC, nowUTC, startOfDayUTC } from "@/lib/utils/datetime";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Get LO sisa per product untuk tank tertentu
 * Mengembalikan total remainingVolume untuk product tank tersebut
 */
export async function getLORemainingByTank(
  gasStationId: string,
  tankId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermissionWithGasStation(
      ["OWNER_GROUP", "FINANCE", "MANAGER", "UNLOADER"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Get tank untuk mendapatkan productId
    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tank) {
      return {
        success: false,
        message: "Tank not found",
        data: { remainingLO: 0 },
      };
    }

    // 3. Get semua purchase transactions untuk gas station dengan productId yang sama dan remaining volume > 0
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
        productId: tank.productId, // Filter langsung by productId
        purchaseVolume: {
          not: null,
        },
      },
      orderBy: {
        date: "asc", // FIFO: yang paling lama dulu
      },
    });

    // 4. Calculate total remaining LO untuk product ini
    let totalRemainingLO = 0;
    let totalPurchaseVolume = 0;
    let totalDeliveredVolume = 0;
    const purchaseTransactionsWithLO: Array<{
      id: string;
      purchaseVolume: number;
      deliveredVolume: number;
      remainingVolume: number;
    }> = [];

    for (const tx of transactions) {
      const purchaseVolume = tx.purchaseVolume || 0;
      const deliveredVolume = tx.deliveredVolume || 0; // Sudah termasuk approved unloads

      // Calculate totals from all transactions
      totalPurchaseVolume += purchaseVolume;
      totalDeliveredVolume += deliveredVolume;

      // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
      // Pending unload tidak dikurangi karena belum pasti di-approve
      const remainingVolume = purchaseVolume - deliveredVolume;

      if (remainingVolume > 0) {
        totalRemainingLO += remainingVolume;
        purchaseTransactionsWithLO.push({
          id: tx.id,
          purchaseVolume,
          deliveredVolume,
          remainingVolume,
        });
      }
    }

    return {
      success: true,
      message: "LO remaining retrieved successfully",
      data: {
        remainingLO: totalRemainingLO,
        totalPurchaseVolume,
        totalDeliveredVolume,
        productName: tank.product.name,
        productId: tank.product.id,
        purchaseTransactions: purchaseTransactionsWithLO, // Untuk reference saat approve
      },
    };
  } catch (error) {
    console.error("Get LO remaining error:", error);
    return {
      success: false,
      message: "Gagal mengambil data LO sisa",
      data: { remainingLO: 0 },
    };
  }
}

export async function createUnload(
  input: z.infer<typeof createUnloadSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (unloader role)
    const { authorized, user, message } = await checkPermission([
      "UNLOADER",
      "ADMINISTRATOR",
      "DEVELOPER",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createUnloadSchema.parse(input);

    // 2.3. Normalize imageUrl: convert array to string (join with comma)
    const imageUrl = Array.isArray(validated.imageUrl)
      ? validated.imageUrl.join(",")
      : validated.imageUrl;

    // 2.5. Semua unload harus PENDING dan perlu approval manager
    // Tidak ada auto approve untuk administrator atau developer
    const approvalStatus = "PENDING";
    const managerId = null;

    // 3. Get tank dengan product
    const tank = await prisma.tank.findUnique({
      where: { id: validated.tankId },
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
    });

    if (!tank) {
      return { success: false, message: "Tank tidak ditemukan" };
    }

    // 4. Validasi LO sisa untuk product ini (jika ada deliveredVolume)
    if (validated.deliveredVolume && validated.deliveredVolume > 0) {
      const loResult = await getLORemainingByTank(
        tank.gasStation.id,
        validated.tankId
      );

      if (!loResult.success || !loResult.data) {
        return {
          success: false,
          message: "Gagal mengambil data LO sisa",
        };
      }

      const loData = loResult.data as {
        remainingLO: number;
        productName: string;
        productId: string;
      };

      // Validasi: deliveredVolume tidak boleh melebihi LO sisa
      if (validated.deliveredVolume > loData.remainingLO) {
        return {
          success: false,
          message: `Volume delivered (${validated.deliveredVolume.toLocaleString(
            "id-ID"
          )}L) melebihi LO sisa (${loData.remainingLO.toLocaleString(
            "id-ID"
          )}L) untuk produk ${loData.productName}.`,
        };
      }

      // Validasi: Pastikan productId match (lebih reliable daripada product name)
      if (loData.productId !== tank.productId) {
        return {
          success: false,
          message: `Product tidak konsisten: tank productId "${tank.productId}" vs LO productId "${loData.productId}"`,
        };
      }
    }

    // 5. Check tank capacity menggunakan perhitungan yang sama dengan OperationalService
    // Gunakan UTC untuk konsistensi
    const { start: startToday, end: endToday } = todayRangeUTC();

    // Fetch today readings
    const todayReadings = await prisma.tankReading.findMany({
      where: {
        tankId: validated.tankId,
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

    // Fetch latest reading
    const latestReading = await prisma.tankReading.findFirst({
      where: {
        tankId: validated.tankId,
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

    // Fetch approved unloads
    const approvedUnloads = await prisma.unload.findMany({
      where: {
        tankId: validated.tankId,
        status: "APPROVED",
      },
      select: {
        literAmount: true,
        createdAt: true,
      },
    });

    // Fetch completed shifts untuk menghitung sales
    const completedShifts = await prisma.operatorShift.findMany({
      where: {
        gasStationId: tank.gasStation.id,
        status: "COMPLETED",
        nozzleReadings: {
          some: {
            nozzle: {
              tankId: validated.tankId,
            },
          },
        },
      },
      include: {
        nozzleReadings: {
          where: {
            nozzle: {
              tankId: validated.tankId,
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

    // Calculate current stock menggunakan logika yang sama dengan OperationalService
    let currentStock = 0;
    const todayOpenReading = todayReadings.length > 0 ? todayReadings[0] : null;
    const todayCloseReading =
      todayReadings.length > 0 ? todayReadings[todayReadings.length - 1] : null;

    // Priority 1: Use today's latest reading (most accurate)
    if (todayCloseReading) {
      currentStock = todayCloseReading.literValue;
    }
    // Priority 2: Calculate realtime if reading exists TODAY
    else if (todayOpenReading) {
      const {
        calculateTankStockByCalculation,
        calculateSalesFromNozzleReadings,
      } = await import("@/lib/utils/tank-calculations");

      const unloadsSinceOpen = approvedUnloads.filter(
        (u) => u.createdAt >= todayOpenReading.createdAt
      );
      const completedShiftsToday = completedShifts.filter((shift) => {
        const shiftDateUTC = startOfDayUTC(shift.date);
        return shiftDateUTC >= startToday && shiftDateUTC <= endToday;
      });

      // Calculate sales from completed shifts
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
    // Priority 3: No reading today, calculate from latest reading + all unloads since then
    else if (latestReading) {
      const {
        calculateTankStockByCalculation,
        calculateSalesFromNozzleReadings,
      } = await import("@/lib/utils/tank-calculations");

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
    // Priority 4: No reading at all, calculate from initial stock + all unloads - all sales
    else {
      const {
        calculateTankStockByCalculation,
        calculateSalesFromNozzleReadings,
      } = await import("@/lib/utils/tank-calculations");

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
      const initialStock = tank.initialStock || 0;

      currentStock = calculateTankStockByCalculation({
        stockOpen: initialStock,
        unloads,
        sales,
      });
    }

    const newTotal = currentStock + validated.literAmount;

    if (newTotal > Number(tank.capacity)) {
      const availableSpace = tank.capacity - currentStock;
      return {
        success: false,
        message: `Kapasitas tank tidak cukup! Sisa ruang: ${availableSpace.toLocaleString(
          "id-ID"
        )} L`,
      };
    }

    // 5.5. Jika ada purchaseTransactionId dan initialOrderVolume belum diisi, ambil dari purchase transaction
    let initialOrderVolume = validated.initialOrderVolume;
    if (validated.purchaseTransactionId && !initialOrderVolume) {
      const purchaseTransaction = await prisma.transaction.findUnique({
        where: { id: validated.purchaseTransactionId },
        select: { purchaseVolume: true },
      });
      if (purchaseTransaction?.purchaseVolume) {
        initialOrderVolume = purchaseTransaction.purchaseVolume;
      }
    }

    // 6. Database + Audit trail - Create unload
    // VALIDASI: Pastikan tankId yang akan disimpan sesuai dengan tank yang di-fetch
    if (validated.tankId !== tank.id) {
      return {
        success: false,
        message: "Error: Tank ID tidak sesuai. Silakan coba lagi.",
      };
    }

    const unload = await prisma.unload.create({
      data: {
        tankId: validated.tankId, // Explicit set tankId untuk memastikan konsistensi
        unloaderId: user!.id, // Explicit set unloaderId
        ...(managerId ? { managerId } : {}), // Explicit set managerId jika ada
        ...(validated.purchaseTransactionId
          ? {
              purchaseTransactionId: validated.purchaseTransactionId,
            }
          : {}),
        initialOrderVolume: initialOrderVolume,
        deliveredVolume: validated.deliveredVolume,
        literAmount: validated.literAmount,
        invoiceNumber: validated.invoiceNumber || null,
        imageUrl,
        status: approvalStatus,
        notes: validated.notes || null,
        createdById: user!.id, // Explicit set createdById
      },
      select: {
        id: true,
        tankId: true,
        tank: {
          select: {
            id: true,
            name: true,
            code: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // VALIDASI: Pastikan tankId yang disimpan sesuai dengan tank yang di-return
    if (unload.tankId !== unload.tank.id) {
      console.error(
        `CRITICAL: tankId mismatch after create - unloadId: ${unload.id}, tankId: ${unload.tankId}, tank.id: ${unload.tank.id}`
      );
      return {
        success: false,
        message: "Error: Data tidak konsisten. Silakan coba lagi.",
      };
    }

    // 7. Cache invalidation
    revalidatePath(`/gas-stations/${tank.gasStation.id}`);
    return {
      success: true,
      message:
        "Unload request created successfully. Waiting for manager approval.",
      data: unload,
    };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create unload error:", error);
    return { success: false, message: "Failed to create unload request" };
  }
}

export async function approveUnload(
  id: string,
  approved: boolean
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check (manager role)
    const { authorized, user, message } = await checkPermission([
      "MANAGER",
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Get unload data dengan tank dan product
    const unload = await prisma.unload.findUnique({
      where: { id },
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
                hasTitipan: true,
                titipanNames: true,
              },
            },
          },
        },
      },
    });

    if (!unload) {
      return { success: false, message: "Unload not found" };
    }

    // Check apakah ini unload titipan atau unload biasa
    const isTitipanUnload = unload.notes?.includes("Isi titipan dari") || false;
    // Extract nama titipan dari notes jika ada
    const titipanNameMatch = unload.notes?.match(/Isi titipan dari ([^.]+)/);
    const titipanName = titipanNameMatch ? titipanNameMatch[1].trim() : null;

    // 3. Validasi: Cek apakah sudah pernah diproses
    if (unload.status !== "PENDING") {
      return {
        success: false,
        message: `Unload sudah ${
          unload.status === "APPROVED" ? "approved" : "rejected"
        } sebelumnya`,
      };
    }

    // Simpan productId saat unload dibuat untuk referensi
    const unloadProductId = unload.tank.productId;
    const unloadProductName = unload.tank.product.name;
    const unloadTankId = unload.tankId;

    // Get unloaderId untuk createdById (user yang melakukan unload)
    const unloaderId = unload.unloaderId;
    if (!unloaderId) {
      return {
        success: false,
        message: "Unload tidak memiliki unloaderId",
      };
    }

    // 4. Pre-fetch purchase transaction data untuk unload biasa (jika needed)
    // Ini dilakukan sebelum transaction untuk menghindari timeout
    let preFetchedPurchaseTransaction: any = null;
    if (approved && !isTitipanUnload && unload.deliveredVolume && unload.deliveredVolume > 0) {
      // Pre-calculate purchase transactions yang akan digunakan
      const transactions = await prisma.transaction.findMany({
        where: {
          gasStationId: unload.tank.gasStation.id,
          transactionType: "PURCHASE_BBM",
          approvalStatus: "APPROVED",
          productId: unloadProductId,
          purchaseVolume: {
            not: null,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      let totalRemainingLO = 0;
      const purchaseTransactionsWithLO: Array<{
        id: string;
        purchaseVolume: number;
        deliveredVolume: number;
        remainingVolume: number;
      }> = [];

      for (const tx_data of transactions) {
        const purchaseVolume = tx_data.purchaseVolume || 0;
        const deliveredVolume = tx_data.deliveredVolume || 0;
        const remainingVolume = purchaseVolume - deliveredVolume;

        if (remainingVolume > 0) {
          totalRemainingLO += remainingVolume;
          purchaseTransactionsWithLO.push({
            id: tx_data.id,
            purchaseVolume,
            deliveredVolume,
            remainingVolume,
          });
        }
      }

      const deliveredVolume = unload.deliveredVolume;
      if (deliveredVolume <= totalRemainingLO && purchaseTransactionsWithLO.length > 0) {
        // Calculate which purchase transaction will be used first
        let remainingToDeduct = deliveredVolume;
        const firstPurchaseTxId = purchaseTransactionsWithLO.find((pt) => {
          if (remainingToDeduct <= 0) return false;
          const volumeToDeduct = Math.min(remainingToDeduct, pt.remainingVolume);
          if (volumeToDeduct > 0) {
            remainingToDeduct -= volumeToDeduct;
            return true;
          }
          return false;
        })?.id;

        if (firstPurchaseTxId) {
          // Pre-fetch purchase transaction dengan semua data yang dibutuhkan
          preFetchedPurchaseTransaction = await prisma.transaction.findUnique({
            where: { id: firstPurchaseTxId },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              journalEntries: {
                where: {
                  coa: {
                    name: {
                      startsWith: "LO ",
                    },
                  },
                  debit: {
                    gt: 0,
                  },
                },
                include: {
                  coa: true,
                },
              },
            },
          });
        }
      }
    }

    // 5. Update status dan trigger transaction jika approved
    // Increase timeout to 15 seconds untuk handle complex operations (default: 5 seconds)
    await prisma.$transaction(
      async (tx) => {
      // Update status (untuk reject, hanya status yang diubah, tidak ada perubahan lain)
      await tx.unload.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          manager: { connect: { id: user!.id } },
          updatedBy: { connect: { id: user!.id } },
          updatedAt: nowUTC(),
        },
      });

      // Hanya jika approved: kurangi LO sisa, tambah tank stock, buat journal entries
      // Jika rejected: tidak ada perubahan apapun (tidak ada penambahan tank, tidak ada pengurangan LO)
      if (approved) {
        // UNTUK TITIPAN: tidak perlu validasi deliveredVolume dan tidak kurangi LO
        if (isTitipanUnload) {
          // Titipan: hanya create transaction (tidak perlu update tank stock karena currentStock adalah calculated field)
          const literAmount = unload.literAmount;

          // Create transaction titipan (Debit Persediaan, Credit Titipan)
          if (titipanName) {
            const { createTitipanFillTransaction } = await import(
              "@/lib/utils/transaction/transaction-titipan"
            );
            await createTitipanFillTransaction({
              tankId: unloadTankId,
              gasStationId: unload.tank.gasStation.id,
              titipanName: titipanName,
              productName: unloadProductName,
              literAmount: literAmount,
              purchasePrice: unload.tank.product.purchasePrice,
              sellingPrice: unload.tank.product.sellingPrice,
              createdById: unloaderId,
              tx,
            });
          }
        } 
        // UNTUK UNLOAD BIASA: validasi deliveredVolume dan kurangi LO
        else {
          // Validasi: deliveredVolume wajib untuk mengurangi LO
          if (!unload.deliveredVolume || unload.deliveredVolume <= 0) {
          // Legacy: Jika ada initialOrderVolume, gunakan shrinkage transaction
          if (
            unload.initialOrderVolume &&
            Number(unload.initialOrderVolume) > 0
          ) {
            const initialOrderVolume = Number(unload.initialOrderVolume);
            const literAmount = Number(unload.literAmount);
            const purchasePrice = unload.tank.product.purchasePrice;

            // Trigger susut perjalanan transaction (legacy)
            const { createUnloadShrinkageTransaction } = await import(
              "@/lib/utils/operational-transaction.utils"
            );
            await createUnloadShrinkageTransaction({
              unloadId: id,
              gasStationId: unload.tank.gasStation.id,
              tankId: unloadTankId,
              productName: unloadProductName.trim(),
              initialOrderVolume,
              literAmount,
              purchasePrice,
              invoiceNumber: unload.invoiceNumber || null,
              createdById: unloaderId, // User yang melakukan unload
              approverId: user!.id, // User yang approve (manager)
              tx,
            });
          } else {
            throw new Error(
              "Delivered volume wajib diisi untuk mengurangi LO sisa"
            );
          }
        } else {
          const deliveredVolume = unload.deliveredVolume;
          const realVolume = unload.literAmount;

          // 5. Kurangi LO sisa secara FIFO dari purchase transactions
          // Gunakan productId saat unload dibuat, bukan productId tank saat ini
          const transactions = await tx.transaction.findMany({
            where: {
              gasStationId: unload.tank.gasStation.id,
              transactionType: "PURCHASE_BBM",
              approvalStatus: "APPROVED",
              productId: unloadProductId, // Gunakan productId saat unload dibuat
              purchaseVolume: {
                not: null,
              },
            },
            orderBy: {
              date: "asc", // FIFO: yang paling lama dulu
            },
          });

          // Calculate total remaining LO untuk product ini
          let totalRemainingLO = 0;
          const purchaseTransactionsWithLO: Array<{
            id: string;
            purchaseVolume: number;
            deliveredVolume: number;
            remainingVolume: number;
          }> = [];

          for (const tx_data of transactions) {
            const purchaseVolume = tx_data.purchaseVolume || 0;
            const deliveredVolume = tx_data.deliveredVolume || 0;
            const remainingVolume = purchaseVolume - deliveredVolume;

            if (remainingVolume > 0) {
              totalRemainingLO += remainingVolume;
              purchaseTransactionsWithLO.push({
                id: tx_data.id,
                purchaseVolume,
                deliveredVolume,
                remainingVolume,
              });
            }
          }

          const loData = {
            remainingLO: totalRemainingLO,
            productName: unloadProductName,
            productId: unloadProductId,
            purchaseTransactions: purchaseTransactionsWithLO,
          };

          // Validasi: Pastikan ada cukup LO sisa
          if (deliveredVolume > loData.remainingLO) {
            throw new Error(
              `Volume delivered (${deliveredVolume}L) melebihi LO sisa (${loData.remainingLO}L) untuk produk ${loData.productName}`
            );
          }

          // Kurangi LO secara FIFO dari purchase transactions
          let remainingToDeduct = deliveredVolume;
          const purchaseTransactionsToUpdate: Array<{
            id: string;
            volumeToDeduct: number;
          }> = [];

          for (const purchaseTx of loData.purchaseTransactions) {
            if (remainingToDeduct <= 0) break;

            const availableVolume = purchaseTx.remainingVolume;
            const volumeToDeduct = Math.min(remainingToDeduct, availableVolume);

            if (volumeToDeduct > 0) {
              purchaseTransactionsToUpdate.push({
                id: purchaseTx.id,
                volumeToDeduct,
              });
              remainingToDeduct -= volumeToDeduct;
            }
          }

          // Update deliveredVolume di purchase transactions
          for (const {
            id: purchaseTxId,
            volumeToDeduct,
          } of purchaseTransactionsToUpdate) {
            await tx.transaction.update({
              where: { id: purchaseTxId },
              data: {
                deliveredVolume: {
                  increment: volumeToDeduct,
                },
              },
            });
          }

          // Update unload dengan purchaseTransactionId dan initialOrderVolume (gunakan yang pertama untuk tracking)
          if (purchaseTransactionsToUpdate.length > 0) {
            const firstPurchaseTxId = purchaseTransactionsToUpdate[0].id;
            const firstPurchaseTx = loData.purchaseTransactions.find(
              (pt) => pt.id === firstPurchaseTxId
            );

            const updateData: {
              purchaseTransactionId: string;
              initialOrderVolume?: number;
            } = {
              purchaseTransactionId: firstPurchaseTxId,
            };

            // Set initialOrderVolume dari purchase transaction jika belum diisi
            if (firstPurchaseTx && !unload.initialOrderVolume) {
              updateData.initialOrderVolume = firstPurchaseTx.purchaseVolume;
            }

            await tx.unload.update({
              where: { id },
              data: updateData,
            });
          }

          // Import helper untuk delivery transaction
          const { createUnloadDeliveryTransaction } = await import(
            "@/lib/utils/operational-transaction.utils"
          );

          // Create unload delivery transaction menggunakan purchase transaction pertama
          if (purchaseTransactionsToUpdate.length > 0) {
            const firstPurchaseTxId = purchaseTransactionsToUpdate[0].id;

            // Use pre-fetched purchase transaction jika ada, jika tidak fetch lagi
            const purchaseTransaction = preFetchedPurchaseTransaction || await tx.transaction.findUnique({
              where: { id: firstPurchaseTxId },
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                journalEntries: {
                  where: {
                    coa: {
                      name: {
                        startsWith: "LO ",
                      },
                    },
                    debit: {
                      gt: 0,
                    },
                  },
                  include: {
                    coa: true,
                  },
                },
              },
            });

            if (purchaseTransaction) {
              await createUnloadDeliveryTransaction({
                unloadId: id,
                gasStationId: unload.tank.gasStation.id,
                tankId: unloadTankId,
                productId: unloadProductId,
                productName: unloadProductName.trim(),
                purchasePrice: unload.tank.product.purchasePrice,
                deliveredVolume,
                realVolume,
                purchaseTransactionId: firstPurchaseTxId,
                invoiceNumber: unload.invoiceNumber || null,
                createdById: unloaderId, // User yang melakukan unload
                approverId: user!.id, // User yang approve (manager)
                tx,
              });
            }
          }
        } // End of else (deliveredVolume validation)
        } // End of else (UNLOAD BIASA)
      } // End of if (approved)
      },
      {
        timeout: 15000, // 15 seconds timeout
      }
    ); // End of transaction

    // 6. Cache invalidation
    revalidatePath(`/gas-stations/${unload.tank.gasStation.id}`);
    return {
      success: true,
      message: approved
        ? "Unload approved successfully"
        : "Unload rejected successfully",
    };
  } catch (error) {
    console.error("Approve unload error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to process unload approval",
    };
  }
}

export async function updateUnload(
  id: string,
  input: z.infer<typeof updateUnloadSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "UNLOADER",
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = updateUnloadSchema.parse(input);

    // 3. Check if unload exists and is still PENDING
    const existingUnload = await prisma.unload.findUnique({
      where: { id },
      select: {
        status: true,
        tankId: true,
      },
    });

    if (!existingUnload) {
      return { success: false, message: "Unload not found" };
    }

    if (existingUnload.status !== "PENDING") {
      return {
        success: false,
        message: "Unload sudah diproses, tidak dapat diubah",
      };
    }

    // 4. Get tank untuk validasi capacity
    const tank = await prisma.tank.findUnique({
      where: { id: existingUnload.tankId },
      select: {
        capacity: true,
      },
    });

    if (!tank) {
      return { success: false, message: "Tank not found" };
    }

    // 5. Validasi capacity jika literAmount diubah (menggunakan perhitungan yang sama dengan createUnload)
    if (validated.literAmount !== undefined) {
      // Get tank dengan gasStation untuk menghitung currentStock
      const tankWithGasStation = await prisma.tank.findUnique({
        where: { id: existingUnload.tankId },
        include: {
          gasStation: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!tankWithGasStation) {
        return { success: false, message: "Tank not found" };
      }

      // Gunakan UTC untuk konsistensi
      const { start: startToday, end: endToday } = todayRangeUTC();

      // Fetch today readings
      const todayReadings = await prisma.tankReading.findMany({
        where: {
          tankId: existingUnload.tankId,
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

      // Fetch latest reading
      const latestReading = await prisma.tankReading.findFirst({
        where: {
          tankId: existingUnload.tankId,
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

      // Fetch approved unloads (exclude current unload yang sedang di-edit)
      const approvedUnloads = await prisma.unload.findMany({
        where: {
          tankId: existingUnload.tankId,
          status: "APPROVED",
          id: {
            not: id, // Exclude current unload
          },
        },
        select: {
          literAmount: true,
          createdAt: true,
        },
      });

      // Fetch completed shifts untuk menghitung sales
      const completedShifts = await prisma.operatorShift.findMany({
        where: {
          gasStationId: tankWithGasStation.gasStation.id,
          status: "COMPLETED",
          nozzleReadings: {
            some: {
              nozzle: {
                tankId: existingUnload.tankId,
              },
            },
          },
        },
        include: {
          nozzleReadings: {
            where: {
              nozzle: {
                tankId: existingUnload.tankId,
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

      // Calculate current stock menggunakan logika yang sama dengan createUnload
      let currentStock = 0;
      const todayOpenReading =
        todayReadings.length > 0 ? todayReadings[0] : null;
      const todayCloseReading =
        todayReadings.length > 0
          ? todayReadings[todayReadings.length - 1]
          : null;

      // Priority 1: Use today's latest reading (most accurate)
      if (todayCloseReading) {
        currentStock = todayCloseReading.literValue;
      }
      // Priority 2: Calculate realtime if reading exists TODAY
      else if (todayOpenReading) {
        const unloadsSinceOpen = approvedUnloads.filter(
          (u) => u.createdAt >= todayOpenReading.createdAt
        );
        const completedShiftsToday = completedShifts.filter((shift) => {
          const shiftDateUTC = startOfDayUTC(shift.date);
          return shiftDateUTC >= startToday && shiftDateUTC <= endToday;
        });

        // Calculate sales from completed shifts
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
      // Priority 3: No reading today, calculate from latest reading + all unloads since then
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
      // Priority 4: No reading at all, calculate from initial stock + all unloads - all sales
      else {
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
        const initialStock = tankWithGasStation.initialStock || 0;

        currentStock = calculateTankStockByCalculation({
          stockOpen: initialStock,
          unloads,
          sales,
        });
      }

      const newTotal = currentStock + validated.literAmount;

      if (newTotal > Number(tank.capacity)) {
        const availableSpace = tank.capacity - currentStock;
        return {
          success: false,
          message: `Kapasitas tank tidak cukup! Sisa ruang: ${availableSpace.toLocaleString(
            "id-ID"
          )} L`,
        };
      }
    }

    // 6. Database + Audit trail
    await prisma.unload.update({
      where: { id },
      data: {
        ...validated,
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 7. Cache invalidation
    const unload = await prisma.unload.findUnique({
      where: { id },
      select: {
        tank: {
          select: {
            gasStationId: true,
          },
        },
      },
    });

    if (unload) {
      revalidatePath(`/gas-stations/${unload.tank.gasStationId}`);
    }

    return { success: true, message: "Unload berhasil diupdate" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Update unload error:", error);
    return { success: false, message: "Failed to update unload" };
  }
}

export async function getPendingUnloads(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized, message } = await checkPermissionWithGasStation(
      ["MANAGER", "ADMINISTRATOR"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message };
    }

    const { UnloadService } = await import("@/lib/services/unload.service");
    const unloads = await UnloadService.findPendingByGasStation(gasStationId);

    return {
      success: true,
      message: "Pending unloads retrieved successfully",
      data: unloads,
    };
  } catch (error) {
    console.error("Get pending unloads error:", error);
    return { success: false, message: "Failed to retrieve pending unloads" };
  }
}

export async function getUnloadHistory(
  gasStationId: string
): Promise<ActionResult> {
  try {
    const { authorized, message } = await checkPermissionWithGasStation(
      ["MANAGER", "ADMINISTRATOR"],
      gasStationId
    );
    if (!authorized) {
      return { success: false, message };
    }

    const { UnloadService } = await import("@/lib/services/unload.service");
    const unloads = await UnloadService.findHistoryByGasStation(gasStationId);

    return {
      success: true,
      message: "Unload history retrieved successfully",
      data: unloads,
    };
  } catch (error) {
    console.error("Get unload history error:", error);
    return { success: false, message: "Failed to retrieve unload history" };
  }
}

export async function hasApprovedPurchaseForTanks(
  tankIds: string[],
  gasStationId: string
): Promise<Record<string, boolean>> {
  try {
    const tanks = await prisma.tank.findMany({
      where: {
        id: { in: tankIds },
        gasStationId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group tanks by productId
    const tanksByProduct = new Map<string, string[]>();
    tanks.forEach((tank) => {
      const productId = tank.productId;
      if (!tanksByProduct.has(productId)) {
        tanksByProduct.set(productId, []);
      }
      tanksByProduct.get(productId)!.push(tank.id);
    });

    // Get products untuk mapping
    const products = await prisma.product.findMany({
      where: {
        id: { in: Array.from(tanksByProduct.keys()) },
        gasStationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    // Get unique productIds dari tanks
    const productIds = Array.from(new Set(tanks.map((t) => t.productId)));

    // Fetch all approved purchase transactions dengan sisa volume untuk productIds tersebut
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
        productId: { in: productIds }, // Filter langsung by productId
        purchaseVolume: {
          not: null,
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // Group transactions by productId
    const transactionsByProductId = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      if (!tx.productId) continue;
      if (!transactionsByProductId.has(tx.productId)) {
        transactionsByProductId.set(tx.productId, []);
      }
      transactionsByProductId.get(tx.productId)!.push(tx);
    }

    // Process transactions untuk setiap tank berdasarkan productId
    const result: Record<string, boolean> = {};
    for (const tank of tanks) {
      result[tank.id] = false;

      // Get transactions untuk productId tank ini
      const productTransactions =
        transactionsByProductId.get(tank.productId) || [];
      let totalRemainingLO = 0;

      for (const tx of productTransactions) {
        const purchaseVolume = tx.purchaseVolume || 0;
        const deliveredVolume = tx.deliveredVolume || 0;

        // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
        // Pending unload tidak dikurangi karena belum pasti di-approve
        const remainingVolume = purchaseVolume - deliveredVolume;

        if (remainingVolume > 0) {
          totalRemainingLO += remainingVolume;
        }
      }

      result[tank.id] = totalRemainingLO > 0;
    }

    return result;
  } catch (error) {
    console.error("Has approved purchase for tanks error:", error);
    return {};
  }
}
