"use server";

import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/utils/permissions.server";
import { OperationalService } from "@/lib/services/operational.service";
import { PurchaseService } from "@/lib/services/purchase.service";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Get LO data per SPBU untuk OwnerGroup dashboard
 *
 * IMPORTANT: Route tidak perlu ID karena menggunakan session-based filtering
 * - Setiap OWNER_GROUP user memiliki ownerId di database (relasi ke User dengan role OWNER)
 * - Data difilter berdasarkan ownerId dari user yang sedang login
 * - Setiap user OWNER_GROUP hanya melihat data SPBU milik ownernya
 * - Data tidak akan tergabung antar owner karena sudah difilter di database query
 * - Jika ownerId diberikan (untuk DEVELOPER), gunakan ownerId tersebut
 *
 * Contoh:
 * - OWNER_GROUP user A (ownerId = "owner1") → hanya lihat SPBU milik owner1
 * - OWNER_GROUP user B (ownerId = "owner2") → hanya lihat SPBU milik owner2
 * - DEVELOPER dengan ownerId parameter → lihat SPBU milik ownerId tersebut
 *
 * Return: List SPBU dengan data tank (stock, volume), purchase, dan LO
 */
export async function getLODataByOwner(ownerIdParam?: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // DEVELOPER selalu pass semuanya
    // ADMINISTRATOR selalu pass semua di kepemilikan ownernya
    // OWNER bisa akses dashboard miliknya sendiri
    // OWNER_GROUP bisa akses dashboard ownernya
    // MANAGER dan FINANCE bisa akses jika toggle on di gas station mereka
    const { authorized, user, message } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
      "OWNER",
      "OWNER_GROUP",
      "MANAGER",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Get user dengan ownerId dan gasStationId dari database
    // OWNER: user.id adalah ownerId itu sendiri
    // OWNER_GROUP: memiliki ownerId yang menghubungkan ke User dengan role OWNER
    // MANAGER dan FINANCE: memiliki gasStationId yang digunakan untuk filter
    // ownerId ini digunakan untuk filter data SPBU yang akan ditampilkan
    const userWithOwner = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: {
          select: {
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        gasStations: {
          where: {
            status: "ACTIVE",
          },
          select: {
            gasStationId: true,
          },
          take: 1,
        },
      },
    });

    if (!userWithOwner) {
      return { success: false, message: "User tidak ditemukan" };
    }

    // 3. Determine ownerId berdasarkan role atau parameter
    // Jika ownerIdParam diberikan (untuk DEVELOPER), gunakan itu
    // DEVELOPER: bisa akses semua (tidak perlu filter ownerId) atau ownerId spesifik
    // ADMINISTRATOR: pakai ownerId dari relasi (hanya bisa akses ownernya)
    // OWNER: pakai user.id sebagai ownerId (OWNER adalah owner itu sendiri)
    // OWNER_GROUP: pakai ownerId dari relasi (hanya bisa akses ownernya)
    //
    // CRITICAL: Filtering berdasarkan ownerId memastikan data tidak tergabung antar owner
    let targetOwnerId: string | null = null;
    let ownerName: string | null = null;
    let targetGasStationId: string | null = null;

    // Jika ownerIdParam diberikan, gunakan itu (untuk DEVELOPER)
    if (ownerIdParam) {
      // Validasi bahwa user adalah DEVELOPER atau ownerIdParam adalah ownernya
      if (userWithOwner.role === "DEVELOPER") {
        targetOwnerId = ownerIdParam;
        // Ambil nama owner dari database
        const ownerUser = await prisma.user.findUnique({
          where: { id: ownerIdParam },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else if (userWithOwner.role === "OWNER" && userWithOwner.id === ownerIdParam) {
        // OWNER hanya bisa akses miliknya sendiri
        targetOwnerId = ownerIdParam;
        ownerName = userWithOwner.profile?.name || null;
      } else if ((userWithOwner.role === "ADMINISTRATOR" || userWithOwner.role === "OWNER_GROUP") && userWithOwner.ownerId === ownerIdParam) {
        // ADMINISTRATOR & OWNER_GROUP hanya bisa akses ownernya
        targetOwnerId = ownerIdParam;
        ownerName = userWithOwner.owner?.profile?.name || null;
      } else if (userWithOwner.role === "MANAGER" || userWithOwner.role === "FINANCE") {
        // MANAGER dan FINANCE: validasi bahwa ownerIdParam sesuai dengan owner dari gas station mereka
        const userGasStation = userWithOwner.gasStations?.[0];
        if (!userGasStation?.gasStationId) {
          return { success: false, message: "User tidak memiliki gasStationId" };
        }
        
        // Get gas station untuk check toggle dan ownerId
        const gasStation = await prisma.gasStation.findUnique({
          where: { id: userGasStation.gasStationId },
          select: { 
            ownerId: true,
            managerCanPurchase: true,
            financeCanPurchase: true,
          },
        });
        
        if (!gasStation) {
          return { success: false, message: "Gas station tidak ditemukan" };
        }
        
        // Check toggle
        if (
          (userWithOwner.role === "MANAGER" && !gasStation.managerCanPurchase) ||
          (userWithOwner.role === "FINANCE" && !gasStation.financeCanPurchase)
        ) {
          return { success: false, message: "Purchase access tidak diaktifkan untuk role ini" };
        }
        
        // Validasi bahwa ownerIdParam sesuai dengan owner dari gas station mereka
        if (ownerIdParam !== gasStation.ownerId) {
          return { success: false, message: "Forbidden: Anda hanya bisa mengakses owner dari gas station Anda" };
        }
        
        targetOwnerId = gasStation.ownerId;
        targetGasStationId = userGasStation.gasStationId;
        const ownerUser = await prisma.user.findUnique({
          where: { id: gasStation.ownerId },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else {
        return { success: false, message: "Forbidden: Tidak memiliki akses ke owner ini" };
      }
    } else {
      // Logika lama jika tidak ada ownerIdParam
      if (userWithOwner.role === "DEVELOPER") {
        // DEVELOPER bisa akses semua, tidak perlu filter ownerId
        // Return semua gas stations dari semua owner
        targetOwnerId = null; // null berarti tidak filter by ownerId
        ownerName = null; // DEVELOPER tidak punya owner spesifik
      } else if (userWithOwner.role === "OWNER") {
        // OWNER: pakai user.id sebagai ownerId (OWNER adalah owner itu sendiri)
        targetOwnerId = userWithOwner.id;
        ownerName = userWithOwner.profile?.name || null;
      } else if (userWithOwner.role === "MANAGER" || userWithOwner.role === "FINANCE") {
        // MANAGER dan FINANCE: pakai gasStationId mereka, lalu ambil ownerId dari gas station
        const userGasStation = userWithOwner.gasStations?.[0];
        if (!userGasStation?.gasStationId) {
          return { success: false, message: "User tidak memiliki gasStationId" };
        }
        targetGasStationId = userGasStation.gasStationId;
        
        // Check toggle
        const gasStation = await prisma.gasStation.findUnique({
          where: { id: targetGasStationId },
          select: { 
            ownerId: true,
            managerCanPurchase: true,
            financeCanPurchase: true,
          },
        });
        
        if (!gasStation) {
          return { success: false, message: "Gas station tidak ditemukan" };
        }
        
        if (
          (userWithOwner.role === "MANAGER" && !gasStation.managerCanPurchase) ||
          (userWithOwner.role === "FINANCE" && !gasStation.financeCanPurchase)
        ) {
          return { success: false, message: "Purchase access tidak diaktifkan untuk role ini" };
        }
        
        targetOwnerId = gasStation.ownerId;
        const ownerUser = await prisma.user.findUnique({
          where: { id: gasStation.ownerId },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else {
        // ADMINISTRATOR & OWNER_GROUP: pakai ownerId dari relasi (hanya ownernya)
        // Setiap user hanya bisa melihat data SPBU milik ownernya
        if (!userWithOwner.ownerId) {
          return { success: false, message: "User tidak memiliki ownerId" };
        }
        targetOwnerId = userWithOwner.ownerId;
        ownerName = userWithOwner.owner?.profile?.name || null;
      }
    }

    // 4. Get all gas stations owned by owner (atau semua jika DEVELOPER)
    // Filter by ownerId memastikan setiap OWNER_GROUP hanya melihat SPBU milik ownernya
    // MANAGER dan FINANCE hanya melihat gas station mereka saja
    // Data tidak akan tergabung karena query sudah difilter di database level
    const gasStations = await prisma.gasStation.findMany({
      where: {
        ...(targetGasStationId ? { id: targetGasStationId } : {}), // Filter by gasStationId untuk MANAGER/FINANCE
        ...(targetOwnerId && !targetGasStationId ? { ownerId: targetOwnerId } : {}), // Filter by ownerId jika bukan MANAGER/FINANCE
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        address: true,
        ownerId: true, // Tambahkan ownerId untuk DEVELOPER
      },
      orderBy: {
        name: "asc",
      },
    });

    // 4. Get data untuk setiap gas station
    const loDataPromises = gasStations.map(async (gs) => {
      // Get cash dan bank balance untuk SPBU ini
      const { FinanceService } = await import("@/lib/services/finance.service");
      const paymentBalances = await FinanceService.getPaymentMethodBalance(
        gs.id
      );
      const cashBalance =
        paymentBalances.find((b) => b.paymentMethod === "CASH")?.balance || 0;
      const bankBalance =
        paymentBalances.find((b) => b.paymentMethod === "BANK")?.balance || 0;
      // Get tanks with stock
      const tanksWithStock = await OperationalService.getTanksWithStock(gs.id);

      // Get purchase transactions dengan remaining volume > 0
      const purchaseTransactions =
        await PurchaseService.getPurchaseTransactionsByGasStation(gs.id);

      // Group tanks by productId (lebih reliable daripada product name)
      const tanksByProductId = new Map<string, typeof tanksWithStock>();
      tanksWithStock.forEach((tank) => {
        const productId = tank.product.id;
        if (!tanksByProductId.has(productId)) {
          tanksByProductId.set(productId, []);
        }
        tanksByProductId.get(productId)!.push(tank);
      });

      // Calculate total LO per productId
      const loByProductId = new Map<string, number>();
      purchaseTransactions.forEach((purchase) => {
        // Gunakan productId langsung dari purchase transaction
        if (purchase.remainingVolume > 0 && purchase.productId) {
          const currentLO = loByProductId.get(purchase.productId) || 0;
          loByProductId.set(
            purchase.productId,
            currentLO + purchase.remainingVolume
          );
        }
      });

      // Calculate summary per product
      const productSummariesPromises = Array.from(tanksByProductId.keys()).map(
        async (productId) => {
          const tanks = tanksByProductId.get(productId) || [];
          const productName = tanks[0]?.product?.name;
          if (!productName) {
            throw new Error(`Product name tidak ditemukan untuk productId ${productId}`);
          }

          // Get purchase price langsung dari Product yang sudah di-include (sudah sesuai dengan gasStationId)
          const purchasePrice = tanks[0]?.product?.purchasePrice || 0;

          const totalStock = tanks.reduce(
            (sum, tank) => sum + (tank.currentStock || 0),
            0
          );
          const totalVolume = tanks.reduce(
            (sum, tank) => sum + (tank.capacity || 0),
            0
          );
          // Filter purchase transactions by productId (lebih reliable daripada productName)
          const productPurchases = purchaseTransactions.filter(
            (p) => p.productId === productId
          );
          const totalPurchase = productPurchases.reduce(
            (sum, p) => sum + (p.purchaseVolume || 0),
            0
          );
          const totalDelivered = productPurchases.reduce(
            (sum, p) => sum + (p.deliveredVolume || 0),
            0
          );
          const totalLO = loByProductId.get(productId) || 0;

          // Get latest purchase volume untuk product ini
          const latestPurchase = productPurchases.length > 0
            ? productPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            : null;
          const latestPurchaseVolume = latestPurchase?.purchaseVolume || 0;

          return {
            productId,
            productName,
            purchasePrice,
            tanks: tanks.map((tank) => ({
              code: tank.code,
              name: tank.name,
              stock: tank.currentStock || 0,
              volume: tank.capacity || 0,
            })),
            totalStock,
            totalVolume,
            totalPurchase,
            totalDelivered,
            totalLO,
            latestPurchaseVolume,
          };
        }
      );

      const productSummaries = await Promise.all(productSummariesPromises);

      return {
        gasStationId: gs.id,
        gasStationName: gs.name,
        address: gs.address,
        products: productSummaries,
        cashBalance,
        bankBalance,
      };
    });

    const loData = await Promise.all(loDataPromises);

    // CRITICAL: finalOwnerId harus sesuai dengan targetOwnerId yang digunakan untuk query
    // Jangan ambil dari gas station pertama karena bisa berbeda owner
    // Jika ownerIdParam diberikan, gunakan itu (sudah di-set di targetOwnerId)
    // Jika tidak ada ownerIdParam, gunakan targetOwnerId yang sudah ditentukan berdasarkan role
    let finalOwnerId = targetOwnerId;
    
    // Hanya untuk DEVELOPER yang tidak memberikan ownerIdParam, ambil dari gas station pertama
    // Tapi ini seharusnya tidak terjadi karena DEVELOPER harus memberikan ownerIdParam
    if (!finalOwnerId && userWithOwner.role === "DEVELOPER" && !ownerIdParam && gasStations.length > 0) {
      // Fallback: ambil ownerId dari gas station pertama jika DEVELOPER tidak memberikan ownerIdParam
      finalOwnerId = gasStations[0].ownerId;
      // Update ownerName juga jika belum di-set
      if (!ownerName && finalOwnerId) {
        const ownerUser = await prisma.user.findUnique({
          where: { id: finalOwnerId },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      }
    }

    // CRITICAL: Pastikan ownerName sesuai dengan finalOwnerId
    // Jika ownerName belum di-set tapi finalOwnerId ada, query dari database
    if (!ownerName && finalOwnerId) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: finalOwnerId },
        select: {
          profile: {
            select: {
              name: true,
            },
          },
        },
      });
      ownerName = ownerUser?.profile?.name || null;
    }

    return {
      success: true,
      message: "Data LO berhasil diambil",
      data: {
        loData,
        ownerName,
        ownerId: finalOwnerId, // CRITICAL: ownerId harus sesuai dengan ownerId yang digunakan untuk query
      },
    };
  } catch (error: any) {
    console.error("Get LO data error:", error);
    return {
      success: false,
      message: error.message || "Gagal mengambil data LO",
    };
  }
}

/**
 * Get purchase transactions untuk OwnerGroup dashboard
 *
 * IMPORTANT: Route tidak perlu ID karena menggunakan session-based filtering
 * - Setiap OWNER_GROUP user memiliki ownerId di database (relasi ke User dengan role OWNER)
 * - Data difilter berdasarkan ownerId dari user yang sedang login
 * - Setiap user OWNER_GROUP hanya melihat purchase transactions dari SPBU milik ownernya
 * - Data tidak akan tergabung antar owner karena sudah difilter di database query
 * - Jika ownerId diberikan (untuk DEVELOPER), gunakan ownerId tersebut
 *
 * Contoh:
 * - OWNER_GROUP user A (ownerId = "owner1") → hanya lihat purchase dari SPBU milik owner1
 * - OWNER_GROUP user B (ownerId = "owner2") → hanya lihat purchase dari SPBU milik owner2
 * - DEVELOPER dengan ownerId parameter → lihat purchase dari SPBU milik ownerId tersebut
 */
export async function getPurchaseTransactionsForOwnerGroup(ownerIdParam?: string): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // DEVELOPER selalu pass semuanya
    // ADMINISTRATOR selalu pass semua di kepemilikan ownernya
    // OWNER bisa akses dashboard miliknya sendiri
    // OWNER_GROUP bisa akses dashboard ownernya
    // MANAGER dan FINANCE bisa akses jika toggle on di gas station mereka
    const { authorized, user, message } = await checkPermission([
      "DEVELOPER",
      "ADMINISTRATOR",
      "OWNER",
      "OWNER_GROUP",
      "MANAGER",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Get user dengan ownerId dan gasStationId dari database
    // OWNER: user.id adalah ownerId itu sendiri
    // OWNER_GROUP: memiliki ownerId yang menghubungkan ke User dengan role OWNER
    // MANAGER dan FINANCE: memiliki gasStationId yang digunakan untuk filter
    // ownerId ini digunakan untuk filter purchase transactions yang akan ditampilkan
    const userWithOwner = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: {
          select: {
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        gasStations: {
          where: {
            status: "ACTIVE",
          },
          select: {
            gasStationId: true,
          },
          take: 1,
        },
      },
    });

    if (!userWithOwner) {
      return { success: false, message: "User tidak ditemukan" };
    }

    // 3. Determine ownerId berdasarkan role atau parameter
    // Jika ownerIdParam diberikan (untuk DEVELOPER), gunakan itu
    // DEVELOPER: bisa akses semua (tidak perlu filter ownerId) atau ownerId spesifik
    // ADMINISTRATOR: pakai ownerId dari relasi (hanya bisa akses ownernya)
    // OWNER: pakai user.id sebagai ownerId (OWNER adalah owner itu sendiri)
    // OWNER_GROUP: pakai ownerId dari relasi (hanya bisa akses ownernya)
    //
    // CRITICAL: Filtering berdasarkan ownerId memastikan data tidak tergabung antar owner
    let targetOwnerId: string | null = null;
    let ownerName: string | null = null;
    let targetGasStationId: string | null = null;

    // Jika ownerIdParam diberikan, gunakan itu (untuk DEVELOPER)
    if (ownerIdParam) {
      // Validasi bahwa user adalah DEVELOPER atau ownerIdParam adalah ownernya
      if (userWithOwner.role === "DEVELOPER") {
        targetOwnerId = ownerIdParam;
        // Ambil nama owner dari database
        const ownerUser = await prisma.user.findUnique({
          where: { id: ownerIdParam },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else if (userWithOwner.role === "OWNER" && userWithOwner.id === ownerIdParam) {
        // OWNER hanya bisa akses miliknya sendiri
        targetOwnerId = ownerIdParam;
        ownerName = userWithOwner.profile?.name || null;
      } else if ((userWithOwner.role === "ADMINISTRATOR" || userWithOwner.role === "OWNER_GROUP") && userWithOwner.ownerId === ownerIdParam) {
        // ADMINISTRATOR & OWNER_GROUP hanya bisa akses ownernya
        targetOwnerId = ownerIdParam;
        ownerName = userWithOwner.owner?.profile?.name || null;
      } else if (userWithOwner.role === "MANAGER" || userWithOwner.role === "FINANCE") {
        // MANAGER dan FINANCE: validasi bahwa ownerIdParam sesuai dengan owner dari gas station mereka
        const userGasStation = userWithOwner.gasStations?.[0];
        if (!userGasStation?.gasStationId) {
          return { success: false, message: "User tidak memiliki gasStationId" };
        }
        
        // Get gas station untuk check toggle dan ownerId
        const gasStation = await prisma.gasStation.findUnique({
          where: { id: userGasStation.gasStationId },
          select: { 
            ownerId: true,
            managerCanPurchase: true,
            financeCanPurchase: true,
          },
        });
        
        if (!gasStation) {
          return { success: false, message: "Gas station tidak ditemukan" };
        }
        
        // Check toggle
        if (
          (userWithOwner.role === "MANAGER" && !gasStation.managerCanPurchase) ||
          (userWithOwner.role === "FINANCE" && !gasStation.financeCanPurchase)
        ) {
          return { success: false, message: "Purchase access tidak diaktifkan untuk role ini" };
        }
        
        // Validasi bahwa ownerIdParam sesuai dengan owner dari gas station mereka
        if (ownerIdParam !== gasStation.ownerId) {
          return { success: false, message: "Forbidden: Anda hanya bisa mengakses owner dari gas station Anda" };
        }
        
        targetOwnerId = gasStation.ownerId;
        const ownerUser = await prisma.user.findUnique({
          where: { id: gasStation.ownerId },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else {
        return { success: false, message: "Forbidden: Tidak memiliki akses ke owner ini" };
      }
    } else {
      // Logika lama jika tidak ada ownerIdParam
      if (userWithOwner.role === "DEVELOPER") {
        // DEVELOPER bisa akses semua, tidak perlu filter ownerId
        // Untuk getPurchaseTransactionsByOwner, jika null berarti semua owner
        targetOwnerId = null; // null berarti tidak filter by ownerId
        ownerName = null; // DEVELOPER tidak punya owner spesifik
      } else if (userWithOwner.role === "OWNER") {
        // OWNER: pakai user.id sebagai ownerId (OWNER adalah owner itu sendiri)
        targetOwnerId = userWithOwner.id;
        ownerName = userWithOwner.profile?.name || null;
      } else if (userWithOwner.role === "MANAGER" || userWithOwner.role === "FINANCE") {
        // MANAGER dan FINANCE: pakai gasStationId mereka, lalu ambil ownerId dari gas station
        const userGasStation = userWithOwner.gasStations?.[0];
        if (!userGasStation?.gasStationId) {
          return { success: false, message: "User tidak memiliki gasStationId" };
        }
        
        // Check toggle
        const gasStation = await prisma.gasStation.findUnique({
          where: { id: userGasStation.gasStationId },
          select: { 
            ownerId: true,
            managerCanPurchase: true,
            financeCanPurchase: true,
          },
        });
        
        if (!gasStation) {
          return { success: false, message: "Gas station tidak ditemukan" };
        }
        
        if (
          (userWithOwner.role === "MANAGER" && !gasStation.managerCanPurchase) ||
          (userWithOwner.role === "FINANCE" && !gasStation.financeCanPurchase)
        ) {
          return { success: false, message: "Purchase access tidak diaktifkan untuk role ini" };
        }
        
        targetOwnerId = gasStation.ownerId;
        const ownerUser = await prisma.user.findUnique({
          where: { id: gasStation.ownerId },
          select: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        });
        ownerName = ownerUser?.profile?.name || null;
      } else {
        // ADMINISTRATOR & OWNER_GROUP: pakai ownerId dari relasi (hanya ownernya)
        if (!userWithOwner.ownerId) {
          return { success: false, message: "User tidak memiliki ownerId" };
        }
        targetOwnerId = userWithOwner.ownerId;
        ownerName = userWithOwner.owner?.profile?.name || null;
      }
    }

    // 4. Get purchase transactions
    // Jika targetOwnerId null (DEVELOPER), perlu handle khusus
    // MANAGER dan FINANCE: filter berdasarkan gasStationId mereka
    type PurchaseTransaction = {
      id: string;
      date: Date;
      description: string;
      referenceNumber: string | null;
      gasStationId: string;
      gasStationName: string;
      productName: string | null;
      purchaseVolume: number;
      deliveredVolume: number;
      remainingVolume: number;
      totalValue: number;
    };
    let purchases: PurchaseTransaction[];
    if (targetOwnerId === null) {
      // DEVELOPER: get semua purchase transactions dari semua owner
      // Get all gas stations dulu
      const allGasStations = await prisma.gasStation.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      const allGasStationIds = allGasStations.map((gs) => gs.id);

      if (allGasStationIds.length === 0) {
        purchases = [];
      } else {
        // Get transactions dari semua gas stations
        const transactions = await prisma.transaction.findMany({
          where: {
            gasStationId: { in: allGasStationIds },
            transactionType: "PURCHASE_BBM",
            approvalStatus: "APPROVED",
            purchaseVolume: { not: null },
          },
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
            gasStation: {
              select: { id: true, name: true },
            },
          },
          orderBy: { date: "desc" },
        });

        purchases = transactions.map((tx) => {
          const purchaseVolume = tx.purchaseVolume || 0;
          const deliveredVolume = tx.deliveredVolume || 0;
          const remainingVolume = purchaseVolume - deliveredVolume;
          
          // Gunakan product name dari relasi product (harus selalu ada karena productId sudah di-set)
          const productName = tx.product?.name || null;
          
          // Calculate totalValue dari LO journal entry (debit amount)
          const loProductCOAEntry = tx.journalEntries.find(
            (entry) => entry.coa.name.startsWith("LO ") && entry.debit > 0
          );
          const totalValue = loProductCOAEntry ? loProductCOAEntry.debit : 0;

          return {
            id: tx.id,
            date: tx.date,
            description: tx.description,
            referenceNumber: tx.referenceNumber,
            gasStationId: tx.gasStationId,
            gasStationName: tx.gasStation.name,
            productId: tx.productId, // Tambahkan productId untuk konsistensi
            productName,
            purchaseVolume,
            deliveredVolume,
            remainingVolume,
            totalValue,
          };
        });
      }
    } else {
      // OWNER, ADMINISTRATOR & OWNER_GROUP: get purchase transactions untuk ownernya
      // MANAGER dan FINANCE: get purchase transactions untuk ownernya, lalu filter berdasarkan gasStationId
      purchases = await PurchaseService.getPurchaseTransactionsByOwner(
        targetOwnerId
      );
      
      // Filter berdasarkan gasStationId untuk MANAGER dan FINANCE
      if (userWithOwner && (userWithOwner.role === "MANAGER" || userWithOwner.role === "FINANCE")) {
        const userGasStation = userWithOwner.gasStations?.[0];
        if (userGasStation?.gasStationId) {
          purchases = purchases.filter((p) => p.gasStationId === userGasStation.gasStationId);
        }
      }
    }

    return {
      success: true,
      message: "Data pembelian berhasil diambil",
      data: {
        purchases,
        ownerName,
      },
    };
  } catch (error: any) {
    console.error("Get purchase transactions error:", error);
    return {
      success: false,
      message: error.message || "Gagal mengambil data pembelian",
    };
  }
}
