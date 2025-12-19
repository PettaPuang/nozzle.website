"use server";

import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/utils/permissions.server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Helper function untuk mapping paymentMethod lama ke paymentAccount + paymentMethod baru
function mapPaymentMethodToAccountAndMethod(
  paymentMethod: string
): { paymentAccount: "CASH" | "BANK"; paymentMethod: string | null } {
  switch (paymentMethod) {
    case "CASH":
      return { paymentAccount: "CASH", paymentMethod: null };
    case "COUPON":
      return { paymentAccount: "CASH", paymentMethod: "COUPON" };
    case "QRIS":
    case "TRANSFER":
    case "DEBIT_CARD":
    case "CREDIT_CARD":
    case "MY_PERTAMINA":
      return { paymentAccount: "BANK", paymentMethod: paymentMethod };
    case "ETC":
      // Default ETC ke CASH, bisa diubah jika perlu
      return { paymentAccount: "CASH", paymentMethod: "ETC" };
    default:
      return { paymentAccount: "CASH", paymentMethod: null };
  }
}

const createExpenseSchema = z.object({
  gasStationId: z.string(),
  coaId: z.string().min(1, "COA harus dipilih"),
  description: z.string().min(1, "Deskripsi harus diisi"),
  amount: z.number().positive("Jumlah harus lebih dari 0"),
  paymentAccount: z.enum(["CASH", "BANK"]),
  paymentMethod: z.enum([
    "QRIS",
    "TRANSFER",
    "DEBIT_CARD",
    "CREDIT_CARD",
    "MY_PERTAMINA",
    "COUPON",
    "ETC",
  ]).optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
  date: z.coerce.date().optional(), // Optional, default ke today
});

export async function createExpense(
  data: z.infer<typeof createExpenseSchema>
) {
  try {
    // Check permission (admin finance)
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "FINANCE",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // Validate input
    const validatedData = createExpenseSchema.parse(data);

    // Check if user has access to this gas station
    const userGasStation = await prisma.userGasStation.findFirst({
      where: {
        userId: user.id,
        gasStationId: validatedData.gasStationId,
        status: "ACTIVE",
      },
    });

    if (!userGasStation) {
      return {
        success: false,
        message: "Anda tidak memiliki akses ke SPBU ini",
      };
    }

    // Check balance for the payment account
    const depositDetails = await prisma.depositDetail.findMany({
      where: {
        deposit: {
          operatorShift: {
            gasStationId: validatedData.gasStationId,
          },
          status: "APPROVED",
        },
        paymentAccount: validatedData.paymentAccount,
      },
      select: {
        operatorAmount: true,
      },
    });

    // TODO: Update balance checking untuk menggunakan JournalEntry dari Transaction baru
    // Untuk sekarang, balance checking masih menggunakan depositDetails saja
    const totalIn = depositDetails.reduce(
      (sum, detail) => sum + Number(detail.operatorAmount),
      0
    );
    const balance = totalIn; // Temporary: hanya dari deposit, belum dikurangi expense

    if (balance < validatedData.amount) {
      return {
        success: false,
        message: `Saldo ${validatedData.paymentAccount} tidak mencukupi. Saldo tersedia: Rp ${balance.toLocaleString("id-ID")}`,
      };
    }

    // TODO: Create Transaction baru + JournalEntry untuk expense
    // Untuk sekarang, expense action belum diupdate ke Transaction baru
    // Akan dibuat terpisah nanti

    revalidatePath("/gas-stations");
    revalidatePath(`/gas-stations/[id]/office`, "page");

    return {
      success: true,
      message: "Pengeluaran berhasil dicatat",
    };
  } catch (error) {
    console.error("Error creating expense:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: "Gagal mencatat pengeluaran",
    };
  }
}

const approveExpenseSchema = z.object({
  expenseId: z.string(), // Transaction ID dengan type EXPENSE
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
});

export async function approveExpense(
  data: z.infer<typeof approveExpenseSchema>
) {
  try {
    // Check permission (manager, bukan owner)
    const { authorized, user } = await checkPermission([
      "ADMINISTRATOR",
      "MANAGER",
    ]);
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // Validate input
    const validatedData = approveExpenseSchema.parse(data);

    // TODO: Update untuk menggunakan Transaction baru + JournalEntry
    // Untuk sekarang, approveExpense belum diupdate ke Transaction baru
    // Akan dibuat terpisah nanti

    return {
      success: false,
      message: "Fitur approve expense belum tersedia. Akan dibuat terpisah nanti.",
    };
  } catch (error) {
    console.error("Error approving expense:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: "Gagal memproses pengeluaran",
    };
  }
}
