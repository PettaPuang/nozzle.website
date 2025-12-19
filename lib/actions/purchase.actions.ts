"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkPermission,
  checkPermissionWithGasStation,
} from "@/lib/utils/permissions.server";
import type { RoleCode } from "@/lib/utils/permissions";
import {
  createPurchaseSchema,
  type CreatePurchaseInput,
} from "@/lib/validations/purchase.validation";
import {
  findOrCreateLOProductCOA,
  findOrCreatePaymentCOA,
} from "@/lib/utils/coa.utils";
import type { z } from "zod";

type ActionResult = {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Record<string, string[]>;
};

/**
 * Create Purchase Transaction (PURCHASE_BBM)
 * OWNER_GROUP bisa create purchase transaction
 * FINANCE tidak bisa lagi
 * Purchase transaction langsung APPROVED untuk OWNER_GROUP
 */
export async function createPurchaseTransaction(
  input: CreatePurchaseInput
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // ADMIN bisa create PURCHASE_BBM (di semua SPBU ownernya)
    // OWNER_GROUP bisa create PURCHASE_BBM (di SPBU ownernya)
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "OWNER_GROUP", // OWNER_GROUP bisa create PURCHASE_BBM
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    // 2. Validation
    const validated = createPurchaseSchema.parse(input);

    // 3. Check gas station access untuk OWNER_GROUP dan ADMIN
    if (user.roleCode === "OWNER_GROUP" || user.roleCode === "ADMINISTRATOR") {
      const { authorized: hasAccess } = await checkPermissionWithGasStation(
        [user.roleCode],
        validated.gasStationId
      );
      if (!hasAccess) {
        return {
          success: false,
          message: "Forbidden: No access to this gas station",
        };
      }
    }

    // 4. Get product info dengan purchasePrice
    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
      select: { id: true, name: true, purchasePrice: true },
    });

    if (!product) {
      return { success: false, message: "Product tidak ditemukan" };
    }

    // 5. Normalize product name untuk konsistensi (trim whitespace)
    const normalizedProductName = product.name.trim();

    // 6. Langsung gunakan purchasePrice dari Product (sudah sesuai dengan gasStationId)
    const purchasePrice = product.purchasePrice;
    const totalValue = validated.purchaseVolume * purchasePrice;

    // 7. Database + Audit trail - Create transaction and journal entries in transaction
    await prisma.$transaction(async (tx) => {
      // Get COAs - gunakan normalized product name
      const loProductCOA = await findOrCreateLOProductCOA(
        validated.gasStationId,
        normalizedProductName,
        user.id
      );

      // Validasi: Pastikan COA name konsisten dengan product name
      const expectedCOAName = `LO ${normalizedProductName}`;
      if (loProductCOA.name !== expectedCOAName) {
        throw new Error(
          `COA name tidak konsisten: expected "${expectedCOAName}", got "${loProductCOA.name}". Product name mungkin berubah setelah COA dibuat.`
        );
      }

      // Validasi: Pastikan productId sudah di-set sebelum create transaction
      if (!validated.productId || validated.productId !== product.id) {
        throw new Error(
          `ProductId tidak konsisten: expected "${product.id}", got "${validated.productId}"`
        );
      }

      const bankCOA = await findOrCreatePaymentCOA(
        validated.gasStationId,
        "BANK",
        user.id,
        validated.bankName || undefined
      );

      // Auto-generate journal entries: Debit LO Produk, Credit Bank
      const journalEntries = [
        {
          coaId: loProductCOA.id,
          debit: totalValue,
          credit: 0,
          description: `LO ${normalizedProductName} ${validated.purchaseVolume.toLocaleString(
            "id-ID"
          )} L`,
        },
        {
          coaId: bankCOA.id,
          debit: 0,
          credit: totalValue,
          description: `Pembayaran pembelian ${normalizedProductName}`,
        },
      ];

      // Validate balance
      const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);
      if (totalDebit !== totalCredit) {
        throw new Error(
          `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
            "id-ID"
          )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
        );
      }

      // Auto-generate description jika tidak ada
      const description =
        validated.description ||
        `Pembelian BBM ${normalizedProductName} - ${validated.purchaseVolume.toLocaleString(
          "id-ID"
        )} L`;

      // OWNER_GROUP & ADMIN: PURCHASE_BBM langsung APPROVED (tidak perlu manager approval)
      const approvalStatus = "APPROVED";
      const approverId = user.id; // OWNER_GROUP/ADMIN yang create = approver

      // Create transaction header
      const transaction = await tx.transaction.create({
        data: {
          gasStation: {
            connect: { id: validated.gasStationId },
          },
          product: {
            connect: { id: validated.productId },
          },
          date: validated.date,
          description,
          referenceNumber: validated.referenceNumber || null,
          notes: validated.notes || null,
          transactionType: "PURCHASE_BBM",
          approvalStatus,
          approver: { connect: { id: approverId } },
          // Purchase tracking
          purchaseVolume: validated.purchaseVolume,
          deliveredVolume: 0,
          createdBy: { connect: { id: user.id } },
        },
      });

      // Create journal entries
      await tx.journalEntry.createMany({
        data: journalEntries.map((entry) => ({
          transactionId: transaction.id,
          coaId: entry.coaId,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          description: entry.description || null,
          createdById: user.id,
        })),
      });
    });

    // 7. Cache invalidation
    revalidatePath("/admin");
    revalidatePath(`/gas-stations/${validated.gasStationId}`);
    return { success: true, message: "Transaksi pembelian berhasil dibuat" };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return {
        success: false,
        message: "Validation failed",
        errors: zodError.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    console.error("Create purchase transaction error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create purchase transaction",
    };
  }
}

/**
 * Get purchase transactions untuk tank tertentu
 * Digunakan untuk unload form agar bisa link ke purchase yang sudah ada
 */
export async function getPurchaseTransactions(
  gasStationId: string,
  tankId: string
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    // OWNER_GROUP juga bisa query purchase transactions
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
      select: {
        productId: true,
      },
    });

    if (!tank) {
      return { success: false, message: "Tank not found", data: [] };
    }

    // 3. Get purchase transactions yang masih ada sisa (remainingVolume > 0)
    // Filter berdasarkan productId dari tank dan sisa volume
    const transactions = await prisma.transaction.findMany({
      where: {
        gasStationId,
        transactionType: "PURCHASE_BBM",
        approvalStatus: "APPROVED", // Hanya yang sudah di-approve
        productId: tank.productId, // Filter langsung by productId
        purchaseVolume: {
          not: null, // Harus ada purchaseVolume
        },
      },
      select: {
        id: true,
        date: true,
        description: true,
        referenceNumber: true,
        purchaseVolume: true,
        deliveredVolume: true,
        notes: true,
        purchaseUnloads: {
          where: {
            status: {
              in: ["PENDING", "APPROVED"],
            },
          },
          select: {
            id: true,
            status: true,
            deliveredVolume: true,
            literAmount: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // 4. Filter transactions yang masih ada sisa (purchaseVolume > deliveredVolume)
    const purchaseTransactions = transactions
      .filter((tx) => {
        // Filter berdasarkan remainingVolume > 0
        if (tx.purchaseVolume === null) return false;

        // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
        const remainingVolume = tx.purchaseVolume - (tx.deliveredVolume || 0);
        return remainingVolume > 0;
      })
      .map((tx) => {
        const purchaseVolume = tx.purchaseVolume || 0;
        const deliveredVolume = tx.deliveredVolume || 0;

        // Remaining volume = purchaseVolume - deliveredVolume (approved saja)
        // Pending unload tidak dikurangi karena belum pasti di-approve
        const remainingVolume = purchaseVolume - deliveredVolume;

        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          referenceNumber: tx.referenceNumber,
          purchaseVolume,
          deliveredVolume,
          remainingVolume,
          literAmount: purchaseVolume, // Legacy compatibility
          initialOrderVolume: purchaseVolume, // Untuk unload form
        };
      });

    return {
      success: true,
      message: "Purchase transactions retrieved successfully",
      data: purchaseTransactions,
    };
  } catch (error) {
    console.error("Get purchase transactions error:", error);
    return { success: false, message: "Gagal mengambil data", data: [] };
  }
}

/**
 * Execute multiple purchase transactions sekaligus
 * Digunakan untuk eksekusi draft purchases dari dashboard ownergroup
 */
export async function executePurchaseTransactions(
  purchases: Array<{
    gasStationId: string;
    productId: string;
    purchaseVolume: number;
    date: Date;
    bankName?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }>
): Promise<ActionResult> {
  try {
    // 1. Auth & Permission check
    const { authorized, user, message } = await checkPermission([
      "ADMINISTRATOR",
      "OWNER_GROUP",
      "OWNER",
      "MANAGER",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message };
    }

    if (!purchases || purchases.length === 0) {
      return { success: false, message: "Tidak ada purchase untuk dieksekusi" };
    }

    // 2. Validate semua purchases
    const validatedPurchases: z.infer<typeof createPurchaseSchema>[] = [];
    for (const purchase of purchases) {
      try {
        const validated = createPurchaseSchema.parse({
          gasStationId: purchase.gasStationId,
          productId: purchase.productId,
          purchaseVolume: purchase.purchaseVolume,
          date: purchase.date,
          bankName: purchase.bankName || null,
          referenceNumber: purchase.referenceNumber || null,
          notes: purchase.notes || null,
        });
        validatedPurchases.push(validated);
      } catch (error) {
        return {
          success: false,
          message: `Validation error: ${
            error instanceof Error ? error.message : "Invalid purchase data"
          }`,
        };
      }
    }

    // 3. Check gas station access dan toggle untuk semua purchases
    for (const purchase of validatedPurchases) {
      // Check gas station access
      const { authorized: hasAccess } = await checkPermissionWithGasStation(
        [user.roleCode as RoleCode],
        purchase.gasStationId
      );
      if (!hasAccess) {
        return {
          success: false,
          message: `Forbidden: No access to gas station ${purchase.gasStationId}`,
        };
      }

      // Check toggle untuk MANAGER dan FINANCE
      if (user.roleCode === "MANAGER" || user.roleCode === "FINANCE") {
        const gasStation = await prisma.gasStation.findUnique({
          where: { id: purchase.gasStationId },
          select: { managerCanPurchase: true, financeCanPurchase: true },
        });

        if (!gasStation) {
          return {
            success: false,
            message: `Gas station ${purchase.gasStationId} not found`,
          };
        }

        if (
          (user.roleCode === "MANAGER" && !gasStation.managerCanPurchase) ||
          (user.roleCode === "FINANCE" && !gasStation.financeCanPurchase)
        ) {
          return {
            success: false,
            message: `Forbidden: Purchase access not enabled for ${user.roleCode} in this gas station`,
          };
        }
      }
    }

    // 4. Get semua products sekaligus dengan purchasePrice
    const productIds = [...new Set(validatedPurchases.map((p) => p.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, purchasePrice: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 5. Execute semua purchases dalam transaction
    const results: Array<{
      gasStationId: string;
      productId: string;
      purchaseVolume: number;
    }> = [];
    await prisma.$transaction(async (tx) => {
      for (const validated of validatedPurchases) {
        const product = productMap.get(validated.productId);
        if (!product) {
          throw new Error(`Product ${validated.productId} tidak ditemukan`);
        }

        // Langsung gunakan purchasePrice dari Product (sudah sesuai dengan gasStationId)
        const purchasePrice = product.purchasePrice;
        const totalValue = validated.purchaseVolume * purchasePrice;

        // Normalize product name untuk konsistensi (trim whitespace)
        const normalizedProductName = product.name.trim();

        // Get COAs - gunakan normalized product name
        const loProductCOA = await findOrCreateLOProductCOA(
          validated.gasStationId,
          normalizedProductName,
          user.id
        );

        // Validasi: Pastikan COA name konsisten dengan product name
        const expectedCOAName = `LO ${normalizedProductName}`;
        if (loProductCOA.name !== expectedCOAName) {
          throw new Error(
            `COA name tidak konsisten: expected "${expectedCOAName}", got "${loProductCOA.name}". Product name mungkin berubah setelah COA dibuat.`
          );
        }

        // Validasi: Pastikan productId sudah di-set sebelum create transaction
        if (!validated.productId || validated.productId !== product.id) {
          throw new Error(
            `ProductId tidak konsisten: expected "${product.id}", got "${validated.productId}"`
          );
        }

        const bankCOA = await findOrCreatePaymentCOA(
          validated.gasStationId,
          "BANK",
          user.id,
          validated.bankName || undefined
        );

        // Auto-generate journal entries
        const journalEntries = [
          {
            coaId: loProductCOA.id,
            debit: totalValue,
            credit: 0,
            description: `LO ${normalizedProductName} ${validated.purchaseVolume.toLocaleString(
              "id-ID"
            )} L`,
          },
          {
            coaId: bankCOA.id,
            debit: 0,
            credit: totalValue,
            description: `Pembayaran pembelian ${normalizedProductName}`,
          },
        ];

        // Validate balance
        const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = journalEntries.reduce(
          (sum, e) => sum + e.credit,
          0
        );
        if (totalDebit !== totalCredit) {
          throw new Error(
            `Jurnal tidak balance! Total Debit: Rp ${totalDebit.toLocaleString(
              "id-ID"
            )}, Total Kredit: Rp ${totalCredit.toLocaleString("id-ID")}`
          );
        }

        // Auto-generate description
        const description =
          validated.description ||
          `Pembelian BBM ${normalizedProductName} - ${validated.purchaseVolume.toLocaleString(
            "id-ID"
          )} L`;

        // Create transaction header
        const transaction = await tx.transaction.create({
          data: {
            gasStation: {
              connect: { id: validated.gasStationId },
            },
            product: {
              connect: { id: validated.productId },
            },
            date: validated.date,
            description,
            referenceNumber: validated.referenceNumber || null,
            notes: validated.notes || null,
            transactionType: "PURCHASE_BBM",
            approvalStatus: "APPROVED",
            approver: { connect: { id: user.id } },
            purchaseVolume: validated.purchaseVolume,
            deliveredVolume: 0,
            createdBy: { connect: { id: user.id } },
          },
        });

        // Create journal entries
        await tx.journalEntry.createMany({
          data: journalEntries.map((entry) => ({
            transactionId: transaction.id,
            coaId: entry.coaId,
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            description: entry.description || null,
            createdById: user.id,
          })),
        });

        results.push({
          gasStationId: validated.gasStationId,
          productId: validated.productId,
          purchaseVolume: validated.purchaseVolume,
        });
      }
    });

    // 6. Cache invalidation
    const gasStationIds = [
      ...new Set(validatedPurchases.map((p) => p.gasStationId)),
    ];
    revalidatePath("/admin");
    revalidatePath("/ownergroup");
    for (const gasStationId of gasStationIds) {
      revalidatePath(`/gas-stations/${gasStationId}`);
    }

    return {
      success: true,
      message: `Berhasil membuat ${results.length} transaksi pembelian`,
      data: results,
    };
  } catch (error) {
    console.error("Execute purchase transactions error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to execute purchase transactions",
    };
  }
}
