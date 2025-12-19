"use server";

import { prisma } from "@/lib/prisma";
import { nowUTC } from "@/lib/utils/datetime";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/infrastructure.validation";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/utils/permissions.server";
import { createStockAdjustmentTransaction } from "@/lib/utils/operational-transaction.utils";
import { startOfDay, endOfDay } from "date-fns";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

export async function createProduct(
  input: z.infer<typeof createProductSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createProductSchema.parse(input);

    // 3. Database + Audit trail
    const product = await prisma.product.create({
      data: {
        gasStation: { connect: { id: validated.gasStationId } },
        name: validated.name,
        ron: validated.ron || null,
        purchasePrice: validated.purchasePrice,
        sellingPrice: validated.sellingPrice,
        createdBy: { connect: { id: user!.id } },
      },
      select: {
        id: true,
      },
    });

    // 4. Cache invalidation
    revalidatePath("/admin");
    return {
      success: true,
      message: "Product created successfully",
      data: product,
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
    return { success: false, message: "Failed to create product" };
  }
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = updateProductSchema.parse(input);

    // 3. Get product sebelum update untuk cek perubahan harga
    const oldProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        sellingPrice: true,
        gasStationId: true,
      },
    });

    if (!oldProduct) {
      return { success: false, message: "Product not found" };
    }

    // 4. Database + Audit trail
    await prisma.product.update({
      where: { id },
      data: {
        ...validated,
        updatedBy: { connect: { id: user!.id } },
        updatedAt: nowUTC(),
      },
    });

    // 5. Cek apakah ada perubahan harga (purchasePrice atau sellingPrice)
    const purchasePriceChanged =
      validated.purchasePrice !== undefined &&
      validated.purchasePrice !== oldProduct.purchasePrice;
    const sellingPriceChanged =
      validated.sellingPrice !== undefined &&
      validated.sellingPrice !== oldProduct.sellingPrice;

    // 5a. Jika ada perubahan harga, catat ke ProductPriceHistory
    if (purchasePriceChanged || sellingPriceChanged) {
      try {
        await prisma.productPriceHistory.create({
          data: {
            productId: id,
            gasStationId: oldProduct.gasStationId,
            oldPurchasePrice: oldProduct.purchasePrice,
            newPurchasePrice:
              validated.purchasePrice ?? oldProduct.purchasePrice,
            oldSellingPrice: oldProduct.sellingPrice,
            newSellingPrice: validated.sellingPrice ?? oldProduct.sellingPrice,
            changeDate: nowUTC(),
            createdById: user!.id,
          },
        });
      } catch (error) {
        console.error(`Error creating price history for product ${id}:`, error);
        // Jangan block update jika history gagal, hanya log error
      }
    }

    // 5b. Jika purchasePrice berubah, trigger stock adjustment untuk gas station ini
    if (purchasePriceChanged) {
      // Cari semua tank yang menggunakan product ini di gas station ini
      const tanks = await prisma.tank.findMany({
        where: {
          productId: id,
          gasStationId: oldProduct.gasStationId,
        },
        select: {
          id: true,
        },
      });

      const tankIds = tanks.map((t) => t.id);

      // Hitung total stock dan buat stock adjustment
      if (tankIds.length > 0) {
        try {
          // Hitung total stock untuk semua tank produk ini di gas station ini
          const today = new Date();
          const startToday = startOfDay(today);
          const endToday = endOfDay(today);

          let totalStock = 0;

          for (const tankId of tankIds) {
            // Get today's readings
            const todayReadings = await prisma.tankReading.findMany({
              where: {
                tankId,
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

            const todayCloseReading =
              todayReadings.length > 0
                ? todayReadings[todayReadings.length - 1]
                : null;
            const todayOpenReading =
              todayReadings.length > 0 ? todayReadings[0] : null;

            let tankStock = 0;

            // Priority 1: Use today's latest reading
            if (todayCloseReading) {
              tankStock = todayCloseReading.literValue;
            }
            // Priority 2: Calculate realtime if open reading exists
            else if (todayOpenReading) {
              const openReadingTime = todayOpenReading.createdAt;

              // Get unloads since open reading
              const unloadsSinceOpen = await prisma.unload.aggregate({
                where: {
                  tankId,
                  status: "APPROVED",
                  createdAt: {
                    gte: openReadingTime,
                  },
                },
                _sum: {
                  literAmount: true,
                },
              });

              // Get completed shifts today for this tank (hanya yang deposit-nya sudah APPROVED)
              const completedShiftsToday = await prisma.operatorShift.findMany({
                where: {
                  station: {
                    nozzles: {
                      some: {
                        tankId,
                      },
                    },
                  },
                  status: "COMPLETED",
                  date: {
                    gte: startToday,
                    lte: endToday,
                  },
                  deposit: {
                    status: "APPROVED", // Hanya shifts yang deposit-nya sudah APPROVED
                  },
                },
                include: {
                  nozzleReadings: {
                    where: {
                      nozzle: {
                        tankId,
                      },
                    },
                    orderBy: {
                      createdAt: "asc",
                    },
                    include: {
                      nozzle: {
                        include: {
                          product: true,
                        },
                      },
                    },
                  },
                },
              });

              // Calculate sales from completed shifts (hanya yang deposit-nya sudah APPROVED)
              let sales = 0;
              for (const shift of completedShiftsToday) {
                const openReadings = shift.nozzleReadings.filter(
                  (r) => r.readingType === "OPEN"
                );
                const closeReadings = shift.nozzleReadings.filter(
                  (r) => r.readingType === "CLOSE"
                );

                closeReadings.forEach((closeReading) => {
                  const openReading = openReadings.find(
                    (r) => r.nozzleId === closeReading.nozzleId
                  );
                  if (openReading) {
                    const volume =
                      closeReading.totalizerReading -
                      openReading.totalizerReading -
                      closeReading.pumpTest;
                    if (volume > 0) {
                      sales += volume;
                    }
                  }
                });
              }

              const openStock = todayOpenReading.literValue;
              const unloads = unloadsSinceOpen._sum.literAmount || 0;
              tankStock = openStock + unloads - sales;
            }
            // Priority 3: Fallback to latest reading (any day) or get from tank
            else {
              const latestReading = await prisma.tankReading.findFirst({
                where: {
                  tankId,
                  approvalStatus: "APPROVED",
                },
                orderBy: {
                  createdAt: "desc",
                },
                select: {
                  literValue: true,
                },
              });

              if (latestReading) {
                tankStock = latestReading.literValue;
              } else {
                // Get initial stock from tank
                const tank = await prisma.tank.findUnique({
                  where: { id: tankId },
                  select: {
                    initialStock: true,
                  },
                });
                tankStock = tank?.initialStock || 0;
              }
            }

            totalStock += tankStock;
          }

          // Create stock adjustment transaction
          if (totalStock > 0 && validated.purchasePrice !== undefined) {
            await createStockAdjustmentTransaction({
              productId: id,
              productName: oldProduct.name,
              gasStationId: oldProduct.gasStationId,
              oldPurchasePrice: oldProduct.purchasePrice,
              newPurchasePrice: validated.purchasePrice,
              availableVolume: totalStock,
              createdById: user!.id,
            });
          }
        } catch (error) {
          console.error(
            `Error creating stock adjustment for product ${id}:`,
            error
          );
        }
      }

      // NEW: Get all purchase transactions dengan remainingVolume > 0 untuk LO adjustment
      try {
        const purchaseTransactions = await prisma.transaction.findMany({
          where: {
            gasStationId: oldProduct.gasStationId,
            productId: id,
            transactionType: "PURCHASE_BBM",
            approvalStatus: "APPROVED",
            purchaseVolume: { not: null },
          },
          select: {
            id: true,
            purchaseVolume: true,
            deliveredVolume: true,
          },
        });

        // Calculate total remaining LO volume
        let totalRemainingLO = 0;
        for (const tx of purchaseTransactions) {
          const remainingVolume =
            (tx.purchaseVolume || 0) - (tx.deliveredVolume || 0);
          if (remainingVolume > 0) {
            totalRemainingLO += remainingVolume;
          }
        }

        // Create LO adjustment transaction
        if (totalRemainingLO > 0 && validated.purchasePrice !== undefined) {
          const { createLOAdjustmentTransaction } = await import(
            "@/lib/utils/operational-transaction.utils"
          );
          await createLOAdjustmentTransaction({
            productId: id,
            productName: oldProduct.name,
            gasStationId: oldProduct.gasStationId,
            oldPurchasePrice: oldProduct.purchasePrice,
            newPurchasePrice: validated.purchasePrice,
            remainingLOVolume: totalRemainingLO,
            createdById: user!.id,
          });
        }
      } catch (error) {
        console.error(`Error creating LO adjustment for product ${id}:`, error);
      }
    }

    // 5c. Jika sellingPrice berubah, trigger titipan adjustment
    // Hanya untuk titipan yang berasal dari unload BBM
    if (sellingPriceChanged) {
      try {
        const { createTitipanAdjustmentTransaction } = await import(
          "@/lib/utils/transaction/transaction-titipan-adjustment"
        );
        await createTitipanAdjustmentTransaction({
          productId: id,
          productName: oldProduct.name,
          gasStationId: oldProduct.gasStationId,
          oldSellingPrice: oldProduct.sellingPrice,
          newSellingPrice: validated.sellingPrice!,
          createdById: user!.id,
        });
      } catch (error) {
        console.error(
          `Error creating titipan adjustment for product ${id}:`,
          error
        );
        // Jangan block update jika adjustment gagal, hanya log error
      }
    }

    // 6. Cache invalidation
    revalidatePath("/admin");
    return { success: true, message: "Product updated successfully" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, message: "Failed to update product" };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
    ]);
    if (!authorized) {
      return { success: false, message };
    }

    // 2. VALIDASI PREVENTIF: Cek data terkait sebelum delete
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        tanks: {
          select: {
            id: true,
            name: true,
            code: true,
            nozzles: {
              select: {
                id: true,
                name: true,
                code: true,
                nozzleReadings: {
                  select: { id: true },
                  take: 1, // Hanya perlu cek apakah ada
                },
              },
            },
            unloads: {
              select: { id: true },
              take: 1, // Hanya perlu cek apakah ada
            },
            tankReadings: {
              select: { id: true },
              take: 1, // Hanya perlu cek apakah ada
            },
          },
        },
        nozzles: {
          select: {
            id: true,
            name: true,
            code: true,
            nozzleReadings: {
              select: { id: true },
              take: 1, // Hanya perlu cek apakah ada
            },
          },
        },
        purchaseTransactions: {
          select: { id: true },
          take: 1, // Hanya perlu cek apakah ada
        },
        gasStation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return { success: false, message: "Product tidak ditemukan" };
    }

    // 3. VALIDASI: Cek apakah ada data terkait yang akan ikut terhapus
    const tankCount = product.tanks.length;
    const nozzleCount = product.nozzles.length;
    const purchaseTransactionCount = product.purchaseTransactions.length;

    // Hitung total data yang akan terhapus
    let totalNozzleReadings = 0;
    let totalUnloads = 0;
    let totalTankReadings = 0;

    for (const tank of product.tanks) {
      totalNozzleReadings += tank.nozzles.reduce(
        (sum, nozzle) => sum + (nozzle.nozzleReadings.length > 0 ? 1 : 0),
        0
      );
      totalUnloads += tank.unloads.length > 0 ? 1 : 0;
      totalTankReadings += tank.tankReadings.length > 0 ? 1 : 0;
    }

    for (const nozzle of product.nozzles) {
      if (nozzle.nozzleReadings.length > 0) {
        totalNozzleReadings += 1;
      }
    }

    // 4. BLOCK DELETE jika ada data terkait yang penting
    const hasImportantData =
      tankCount > 0 ||
      nozzleCount > 0 ||
      purchaseTransactionCount > 0 ||
      totalNozzleReadings > 0 ||
      totalUnloads > 0 ||
      totalTankReadings > 0;

    if (hasImportantData) {
      // Log warning dengan detail lengkap
      console.error(
        `[DELETE PRODUCT BLOCKED] Product "${product.name}" (ID: ${id}) TIDAK BISA DIHAPUS karena memiliki data terkait:\n` +
          `  - ${tankCount} Tank(s)\n` +
          `  - ${nozzleCount} Nozzle(s)\n` +
          `  - ${purchaseTransactionCount} Purchase Transaction(s)\n` +
          `  - ${totalNozzleReadings} NozzleReading(s)\n` +
          `  - ${totalUnloads} Unload(s)\n` +
          `  - ${totalTankReadings} TankReading(s)\n` +
          `  User: ${user?.username || "Unknown"} (ID: ${
            user?.id || "Unknown"
          })\n` +
          `  GasStation: ${product.gasStation.name} (ID: ${product.gasStation.id})\n` +
          `\n⚠️  PENGHAPUSAN DIBLOKIR untuk mencegah cascade delete yang tidak disengaja.\n` +
          `   Jika benar-benar perlu menghapus, hapus data terkait terlebih dahulu atau hubungi developer.`
      );

      return {
        success: false,
        message:
          `Product "${product.name}" tidak dapat dihapus karena memiliki data terkait yang akan ikut terhapus:\n` +
          `- ${tankCount} Tank\n` +
          `- ${nozzleCount} Nozzle\n` +
          `- ${purchaseTransactionCount} Purchase Transaction\n` +
          `- ${totalNozzleReadings} NozzleReading\n` +
          `- ${totalUnloads} Unload\n` +
          `- ${totalTankReadings} TankReading\n\n` +
          `⚠️ Penghapusan diblokir untuk mencegah kehilangan data. Hapus data terkait terlebih dahulu jika benar-benar perlu menghapus Product ini.`,
        data: {
          productId: id,
          productName: product.name,
          relatedData: {
            tanks: tankCount,
            nozzles: nozzleCount,
            purchaseTransactions: purchaseTransactionCount,
            nozzleReadings: totalNozzleReadings,
            unloads: totalUnloads,
            tankReadings: totalTankReadings,
          },
        },
      };
    }

    // 5. Jika tidak ada data terkait, baru boleh delete
    await prisma.product.delete({
      where: { id },
    });

    console.log(
      `[DELETE PRODUCT] Product "${
        product.name
      }" (ID: ${id}) berhasil dihapus oleh ${user?.username || "Unknown"}`
    );

    // 6. Cache invalidation
    revalidatePath("/admin");
    return {
      success: true,
      message: `Product "${product.name}" berhasil dihapus`,
    };
  } catch (error) {
    console.error(`[DELETE PRODUCT] Error deleting product ${id}:`, error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menghapus product. Pastikan tidak ada data terkait.",
    };
  }
}
