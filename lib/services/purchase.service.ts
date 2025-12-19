import { prisma } from "@/lib/prisma";

export class PurchaseService {
  /**
   * Get purchase transactions untuk gas station tertentu
   * Filter berdasarkan productId dan remainingVolume > 0
   */
  static async getPurchaseTransactionsByGasStation(
    gasStationId: string,
    productId?: string
  ) {
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
        purchaseVolume: {
          not: null,
        },
        ...(productId && {
          productId: productId, // Filter langsung by productId
        }),
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
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return transactions.map((tx) => {
      const purchaseVolume = tx.purchaseVolume || 0;
      const deliveredVolume = tx.deliveredVolume || 0;

      // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
      // Pending unload tidak dikurangi karena belum pasti di-approve
      const remainingVolume = purchaseVolume - deliveredVolume;

      // Gunakan product name dari relasi product (harus selalu ada karena productId sudah di-set)
      if (!tx.product) {
        console.warn(`Transaction ${tx.id} tidak memiliki product relation. ProductId mungkin null.`);
      }
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

  /**
   * Get purchase transactions untuk owner (semua gas station milik owner)
   * Untuk OWNER_GROUP dashboard
   */
  static async getPurchaseTransactionsByOwner(ownerId: string) {
    // Get all gas stations owned by owner
    const gasStations = await prisma.gasStation.findMany({
      where: {
        ownerId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
    });

    const gasStationIds = gasStations.map((gs) => gs.id);

    if (gasStationIds.length === 0) {
      return [];
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId: { in: gasStationIds },
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED",
        purchaseVolume: {
          not: null,
        },
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
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return transactions.map((tx) => {
      const purchaseVolume = tx.purchaseVolume || 0;
      const deliveredVolume = tx.deliveredVolume || 0;

      // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
      // Pending unload tidak dikurangi karena belum pasti di-approve
      const remainingVolume = purchaseVolume - deliveredVolume;

      // Gunakan product name dari relasi product (harus selalu ada karena productId sudah di-set)
      if (!tx.product) {
        console.warn(`Transaction ${tx.id} tidak memiliki product relation. ProductId mungkin null.`);
      }
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
}
