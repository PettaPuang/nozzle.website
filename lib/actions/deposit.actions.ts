"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createOperatorDepositSchema,
  type CreateOperatorDepositInput,
} from "@/lib/validations/financial.validation";
import { createDepositApprovalTransaction } from "@/lib/utils/operational-transaction.utils";
import { checkPermissionWithGasStation } from "@/lib/utils/permissions.server";

type ActionResult = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Create Operator Deposit
 * ADMINISTRATOR, FINANCE, dan DEVELOPER bisa input deposit
 * Deposit selalu dibuat dengan status PENDING, menunggu approval MANAGER
 * Tidak ada auto approve, walaupun admin/developer yang input
 */
export async function createOperatorDeposit(
  input: CreateOperatorDepositInput
): Promise<ActionResult> {
  try {
    // 2. Validation
    const validated = createOperatorDepositSchema.parse(input);

    // 3. Get operator shift untuk mendapatkan gasStationId
    const operatorShift = await prisma.operatorShift.findUnique({
      where: { id: validated.operatorShiftId },
      include: {
        nozzleReadings: {
          include: {
            nozzle: {
              include: {
                product: true,
              },
            },
          },
        },
        deposit: {
          include: {
            depositDetails: true,
          },
        },
      },
    });

    if (!operatorShift) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // 1. Check permission dengan gas station access - ADMINISTRATOR, FINANCE, dan DEVELOPER bisa input deposit
    const { authorized, user } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "FINANCE", "DEVELOPER"],
      operatorShift.gasStationId
    );
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 4. Check if shift is COMPLETED
    if (operatorShift.status !== "COMPLETED") {
      return {
        success: false,
        message: "Shift belum selesai, harap checkout terlebih dahulu",
      };
    }

    // 5. Check if shift is verified
    // Hanya shift yang sudah diverifikasi yang bisa diinput deposit
    const isVerified = (operatorShift as any).isVerified ?? false;
    if (!isVerified) {
      return {
        success: false,
        message: "Shift belum diverifikasi, harap verifikasi terlebih dahulu",
      };
    }

    // 5a. SEQUENTIAL DEPOSIT INPUT: Cek apakah ada shift sebelumnya yang belum diinput deposit
    // Get station info untuk error message
    const shiftWithStation = await prisma.operatorShift.findUnique({
      where: { id: validated.operatorShiftId },
      include: {
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!shiftWithStation) {
      return { success: false, message: "Shift tidak ditemukan" };
    }

    // Helper untuk mendapatkan shift order
    const getShiftOrder = (shift: string): number => {
      if (shift === "MORNING") return 1;
      if (shift === "AFTERNOON") return 2;
      if (shift === "NIGHT") return 3;
      return 0;
    };

    const currentShiftOrder = getShiftOrder(operatorShift.shift);

    // Cari shift sebelumnya yang belum diinput deposit (belum verified atau belum ada deposit)
    const previousShiftWithoutDeposit = await prisma.operatorShift.findFirst({
      where: {
        stationId: operatorShift.stationId,
        AND: [
          {
            OR: [
              { date: { lt: operatorShift.date } },
              {
                date: operatorShift.date,
                shift: {
                  in:
                    currentShiftOrder === 3
                      ? ["MORNING", "AFTERNOON"]
                      : currentShiftOrder === 2
                      ? ["MORNING"]
                      : [],
                },
              },
            ],
          },
          {
            status: "COMPLETED",
          },
          {
            OR: [
              { isVerified: false },
              {
                isVerified: true,
                deposit: null, // Belum ada deposit
              },
              {
                isVerified: true,
                deposit: {
                  status: {
                    notIn: ["APPROVED", "PENDING"], // Deposit ditolak atau belum dibuat
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        station: {
          select: {
            code: true,
            name: true,
          },
        },
        deposit: {
          select: {
            status: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { shift: "desc" }],
    });

    if (previousShiftWithoutDeposit) {
      const { format } = await import("date-fns");
      const { id: localeId } = await import("date-fns/locale");

      const shiftLabel =
        previousShiftWithoutDeposit.shift === "MORNING"
          ? "Shift 1"
          : previousShiftWithoutDeposit.shift === "AFTERNOON"
          ? "Shift 2"
          : "Shift 3";

      let reason = "";
      if (!previousShiftWithoutDeposit.isVerified) {
        reason = "belum diverifikasi";
      } else if (!previousShiftWithoutDeposit.deposit) {
        reason = "belum diinput deposit";
      } else if (previousShiftWithoutDeposit.deposit.status === "REJECTED") {
        reason = "deposit ditolak";
      }

      return {
        success: false,
        message: `Tidak bisa input deposit shift ini. Shift sebelumnya ${reason}: ${format(new Date(previousShiftWithoutDeposit.date), "dd MMM yyyy", {
          locale: localeId,
        })} - ${shiftLabel}`,
      };
    }

    // 6. Check if deposit already exists
    // Jika deposit sudah ada dan status bukan REJECTED, tidak bisa input ulang
    const existingDeposit = operatorShift.deposit;

    if (
      existingDeposit &&
      existingDeposit.status !== "REJECTED" &&
      existingDeposit.status !== "PENDING"
    ) {
      return {
        success: false,
        message: "Setoran untuk shift ini sudah pernah diinput",
      };
    }

    // PREVENT RE-APPROVAL DOUBLE COUNTING:
    // Jika deposit pernah APPROVED dan sekarang REJECTED (hasil rollback),
    // beri warning keras untuk cegah double counting
    if (existingDeposit?.status === "REJECTED") {
      // Cek history deposit untuk shift ini
      const depositHistory = await prisma.deposit.findMany({
        where: { operatorShiftId: validated.operatorShiftId },
        orderBy: { createdAt: "desc" },
      });

      // Jika ada lebih dari 1 deposit record, berarti pernah rollback
      if (depositHistory.length > 1) {
        const hasApprovedBefore = depositHistory.some(
          (d) => d.status === "APPROVED" || d.updatedAt > d.createdAt // Pernah diupdate setelah create (kemungkinan pernah APPROVED)
        );

        if (hasApprovedBefore) {
          const { format } = await import("date-fns");
          const { id: localeId } = await import("date-fns/locale");

          return {
            success: false,
            message: `⚠️ ROLLBACK DEPOSIT DETECTED!

Shift ini pernah di-rollback setelah APPROVED.

History Deposit:
${depositHistory
  .map(
    (d, i) =>
      `${i + 1}. ${d.status} - ${format(new Date(d.createdAt), "dd MMM yyyy HH:mm", { locale: localeId })}`
  )
  .join("\n")}

⚡ BAHAYA: Re-input deposit bisa menyebabkan DOUBLE COUNTING di tank stock!

CHECKLIST SEBELUM LANJUT:
✓ Nozzle reading sudah dikoreksi dengan benar
✓ Tidak ada shift berikutnya yang depend pada shift ini
✓ Tank stock calculation masih konsisten
✓ Transaksi rollback sudah di-reverse dengan benar

Jika ragu, hubungi DEVELOPER untuk validasi data chain.

Tetap lanjutkan input deposit?`,
          };
        }
      }
    }

    // Jika deposit status REJECTED atau PENDING, kita akan update deposit yang sudah ada
    const isRejectedDeposit = existingDeposit?.status === "REJECTED";
    const isPendingDeposit = existingDeposit?.status === "PENDING";

    // 8. Calculate total sales from readings dan group by product
    const openReadings = operatorShift.nozzleReadings.filter(
      (r) => r.readingType === "OPEN"
    );
    const closeReadings = operatorShift.nozzleReadings.filter(
      (r) => r.readingType === "CLOSE"
    );

    let totalSales = 0;
    const productSalesMap: Record<
      string,
      {
        productId: string;
        volume: number;
        sellingPrice: number;
        purchasePrice: number;
      }
    > = {};

    closeReadings.forEach((closeReading) => {
      const openReading = openReadings.find(
        (r) => r.nozzleId === closeReading.nozzleId
      );

      if (openReading && closeReading.nozzle.product) {
        const salesVolume =
          Number(closeReading.totalizerReading) -
          Number(openReading.totalizerReading) -
          Number(closeReading.pumpTest);

        if (salesVolume >= 0) {
          const productName = closeReading.nozzle.product.name;
          const productId = closeReading.nozzle.product.id;
          const sellingPrice = Number(closeReading.priceSnapshot);
          const purchasePrice = Number(
            closeReading.nozzle.product.purchasePrice
          );
          const salesValue = salesVolume * sellingPrice;

          totalSales += salesValue;

          if (!productSalesMap[productName]) {
            productSalesMap[productName] = {
              productId,
              volume: 0,
              sellingPrice,
              purchasePrice,
            };
          }
          productSalesMap[productName].volume += salesVolume;
        }
      }
    });

    // Convert to array format untuk createDepositOperatorTransaction
    // Langsung gunakan purchasePrice yang sudah diambil dari product
    const productSales = Object.entries(productSalesMap).map(
      ([productName, data]) => ({
      productName,
      salesVolume: data.volume,
      sellingPrice: data.sellingPrice,
      purchasePrice: data.purchasePrice,
      })
    );

    // 7. Calculate total declared amount
    const totalDeclared = validated.paymentDetails.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    
    // 7a. Gabungkan notes dengan free fuel dan titipan products jika ada
    let finalNotes = validated.notes || "";
    if (
      validated.isFreeFuel &&
      validated.freeFuelAmount &&
      validated.freeFuelReason
    ) {
      finalNotes = finalNotes
        ? `${finalNotes}\n\nFree Fuel (Rp ${validated.freeFuelAmount.toLocaleString(
            "id-ID"
          )}): ${validated.freeFuelReason}`
        : `Free Fuel (Rp ${validated.freeFuelAmount.toLocaleString(
            "id-ID"
          )}): ${validated.freeFuelReason}`;
    }
    
    // Simpan titipanProducts sebagai JSON di notes untuk parsing nanti
    if (validated.titipanProducts && validated.titipanProducts.length > 0) {
      const titipanProductsJson = JSON.stringify(validated.titipanProducts);
      finalNotes = finalNotes
        ? `${finalNotes}\n\nTITIPAN_PRODUCTS_JSON:${titipanProductsJson}`
        : `TITIPAN_PRODUCTS_JSON:${titipanProductsJson}`;
    }

    // 8. Create or Update Deposit and DepositDetails in transaction + Auto transaction
    const result = await prisma.$transaction(async (tx) => {
      let deposit: Awaited<
        ReturnType<typeof tx.deposit.create | typeof tx.deposit.update>
      >;

      if ((isRejectedDeposit || isPendingDeposit) && existingDeposit) {
        // Update deposit yang sudah ada (status REJECTED -> PENDING atau PENDING -> PENDING dengan payment details baru)
        deposit = await tx.deposit.update({
          where: { id: existingDeposit.id },
          data: {
            totalAmount: totalSales,
            operatorDeclaredAmount: totalDeclared,
            status: "PENDING", // Status PENDING, menunggu approval Manager
            notes: finalNotes,
            adminFinanceId: null, // Reset admin finance karena di-reject atau update
            adminReceivedAmount: null, // Reset admin received amount
            updatedById: user.id,
          },
        });

        // Hapus deposit details lama
        await tx.depositDetail.deleteMany({
          where: { depositId: deposit.id },
        });

        // Buat deposit details baru
        await tx.depositDetail.createMany({
          data: validated.paymentDetails.map((detail) => ({
            depositId: deposit.id,
            paymentAccount: detail.paymentAccount,
            paymentMethod: detail.paymentMethod || null,
            operatorAmount: detail.amount,
            createdById: user.id,
          })),
        });

        // Tidak ada transaksi yang dibuat saat Finance input deposit ulang
        // Semua transaksi akan dibuat saat Manager approve deposit
      } else {
        // Create Deposit baru - status PENDING, menunggu approval Manager
        deposit = await tx.deposit.create({
          data: {
            operatorShiftId: validated.operatorShiftId,
            totalAmount: totalSales,
            operatorDeclaredAmount: totalDeclared,
            status: "PENDING", // Status PENDING, menunggu approval Manager
            notes: finalNotes,
            createdById: user.id,
          },
        });

        // Create DepositDetails
        await tx.depositDetail.createMany({
          data: validated.paymentDetails.map((detail) => ({
            depositId: deposit.id,
            paymentAccount: detail.paymentAccount,
            paymentMethod: detail.paymentMethod || null,
            operatorAmount: detail.amount,
            createdById: user.id,
          })),
        });

        // Tidak ada transaksi yang dibuat saat Finance input deposit
        // Semua transaksi akan dibuat saat Manager approve deposit
      }

      return deposit;
    });

    revalidatePath(`/gas-stations/${operatorShift.gasStationId}`);

    return {
      success: true,
      message: isRejectedDeposit
        ? "Setoran berhasil diinput ulang, menunggu verifikasi Manager"
        : "Setoran berhasil diinput, menunggu verifikasi Manager",
      data: {
        id: result.id,
        operatorShiftId: result.operatorShiftId,
        adminFinanceId: result.adminFinanceId,
        totalAmount: result.totalAmount, // Sudah Int, tidak perlu konversi
        operatorDeclaredAmount: result.operatorDeclaredAmount, // Sudah Int
        adminReceivedAmount: result.adminReceivedAmount, // Sudah Int atau null
        status: result.status,
        notes: result.notes,
        createdById: result.createdById,
        createdAt: result.createdAt,
        updatedById: result.updatedById,
        updatedAt: result.updatedAt,
      },
    };
  } catch (error) {
    console.error("Create operator deposit error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal input setoran" };
  }
}

type VerifyDepositInput = {
  depositId: string;
  status: "APPROVED" | "REJECTED";
  adminReceivedAmount?: number;
  notes?: string;
};

export async function verifyDeposit(
  input: VerifyDepositInput
): Promise<ActionResult> {
  try {
    // 2. Get deposit dengan depositDetails untuk mendapatkan gasStationId
    const deposit = await prisma.deposit.findUnique({
      where: { id: input.depositId },
      include: {
        operatorShift: {
          include: {
            gasStation: true,
            operator: {
              select: {
                profile: {
                  select: {
                    name: true,
                  },
                },
                username: true,
              },
            },
            station: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        depositDetails: true,
      },
    });

    if (!deposit) {
      return { success: false, message: "Deposit tidak ditemukan" };
    }

    // 1. Check permission dengan gas station access
    const { authorized, user } = await checkPermissionWithGasStation(
      ["ADMINISTRATOR", "MANAGER", "DEVELOPER"],
      deposit.operatorShift.gasStationId
    );
    if (!authorized || !user) {
      return { success: false, message: "Unauthorized" };
    }

    // 3. Check if already approved
    if (deposit.status !== "PENDING") {
      return {
        success: false,
        message: `Deposit sudah ${
          deposit.status === "APPROVED" ? "diapprove" : "ditolak"
        }`,
      };
    }

    // 4. Update deposit status + Auto transaction untuk approval
    await prisma.$transaction(
      async (tx) => {
        await tx.deposit.update({
          where: { id: input.depositId },
          data: {
            status: input.status,
            adminFinanceId: user.id,
            adminReceivedAmount: input.adminReceivedAmount,
            notes: input.notes || deposit.notes,
            updatedById: user.id,
          },
        });

        // Trigger deposit approval transaction jika APPROVED
        if (input.status === "APPROVED") {
          // Get createdById dari deposit (user yang input deposit - finance)
          // Jika deposit tidak punya createdById, gunakan createdById dari depositDetails pertama
          const depositCreatedById =
            deposit.createdById || deposit.depositDetails[0]?.createdById;
          if (!depositCreatedById) {
            throw new Error("Deposit tidak memiliki createdById");
          }
          // Get operator shift dengan nozzle readings untuk menghitung productSales
          const operatorShiftWithReadings = await tx.operatorShift.findUnique({
            where: { id: deposit.operatorShiftId },
            include: {
              nozzleReadings: {
                include: {
                  nozzle: {
                    include: {
                      product: true, // Pastikan product di-include untuk mendapatkan purchasePrice dari gas station
                    },
                  },
                },
              },
              operator: {
                select: {
                  profile: {
                    select: {
                      name: true,
                    },
                  },
                  username: true,
                },
              },
              station: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          });

          if (!operatorShiftWithReadings) {
            throw new Error("Operator shift tidak ditemukan");
          }

          // Calculate productSales dari nozzle readings
          const openReadings = operatorShiftWithReadings.nozzleReadings.filter(
            (r) => r.readingType === "OPEN"
          );
          const closeReadings = operatorShiftWithReadings.nozzleReadings.filter(
            (r) => r.readingType === "CLOSE"
          );

          const productSalesMap: Record<
            string,
            {
              productId: string;
              volume: number;
              sellingPrice: number;
              purchasePrice: number;
            }
          > = {};

          const pumpTestMap: Record<
            string,
            { volume: number; purchasePrice: number }
          > = {};

          closeReadings.forEach((closeReading) => {
            const openReading = openReadings.find(
              (r) => r.nozzleId === closeReading.nozzleId
            );

            if (openReading && closeReading.nozzle.product) {
              const pumpTestVolume = Number(closeReading.pumpTest) || 0;
              const salesVolume =
                Number(closeReading.totalizerReading) -
                Number(openReading.totalizerReading) -
                pumpTestVolume;

              const productName = closeReading.nozzle.product.name;
              const productId = closeReading.nozzle.product.id;
              const sellingPrice = Number(closeReading.priceSnapshot);
              const purchasePrice = Number(
                closeReading.nozzle.product.purchasePrice
              );

              // Calculate sales volume
              if (salesVolume >= 0) {
                if (!productSalesMap[productName]) {
                  productSalesMap[productName] = {
                    productId,
                    volume: 0,
                    sellingPrice,
                    purchasePrice,
                  };
                }
                productSalesMap[productName].volume += salesVolume;
              }

              // Calculate pump test volume
              if (pumpTestVolume > 0) {
                if (!pumpTestMap[productName]) {
                  pumpTestMap[productName] = {
                    volume: 0,
                    purchasePrice,
                  };
                }
                pumpTestMap[productName].volume += pumpTestVolume;
              }
            }
          });

          // Convert to array format
          const productSales = Object.entries(productSalesMap).map(
            ([productName, data]) => ({
            productName,
            salesVolume: data.volume,
            sellingPrice: data.sellingPrice,
            purchasePrice: data.purchasePrice,
            })
          );

          const pumpTestByProduct = Object.entries(pumpTestMap).map(
            ([productName, data]) => ({
            productName,
            pumpTestVolume: data.volume,
            purchasePrice: data.purchasePrice,
            })
          );

          // Calculate salesValue dari productSales yang sudah menggunakan nilai verified
          // Ini memastikan nilai yang digunakan adalah nilai yang sudah diverifikasi/diedit
          const salesValue = productSales.reduce((sum, product) => {
            return sum + product.salesVolume * product.sellingPrice;
          }, 0);
          const depositDetails = deposit.depositDetails.map((detail) => ({
            paymentAccount: detail.paymentAccount as "CASH" | "BANK",
            paymentMethod: detail.paymentMethod as
              | "QRIS"
              | "TRANSFER"
              | "DEBIT_CARD"
              | "CREDIT_CARD"
              | "COUPON"
              | "ETC"
              | undefined,
            amount: Number(detail.operatorAmount),
            bankName: detail.bankName || undefined,
          }));

          // Get free fuel dan titipan products info dari deposit notes
          let freeFuelAmount = 0;
          let freeFuelReason: string | undefined = undefined;
          let titipanProducts: Array<{ coaId: string; amount: number }> = [];
          
          const freeFuelMatch = deposit.notes?.match(
            /Free Fuel \(Rp ([\d.,]+)\): (.+)/
          );
          if (freeFuelMatch) {
            freeFuelAmount = parseFloat(
              freeFuelMatch[1].replace(/\./g, "").replace(",", ".")
            );
            freeFuelReason = freeFuelMatch[2];
          }

          // Parse titipanProducts dari notes (format: TITIPAN_PRODUCTS_JSON:...)
          const titipanProductsMatch = deposit.notes?.match(
            /TITIPAN_PRODUCTS_JSON:(.+?)(?:\n\n|$)/
          );
          if (titipanProductsMatch) {
            try {
              titipanProducts = JSON.parse(titipanProductsMatch[1]);
            } catch (error) {
              console.error("Error parsing titipanProducts from notes:", error);
            }
          }

          await createDepositApprovalTransaction({
            depositId: deposit.id,
            gasStationId: deposit.operatorShift.gasStationId,
            salesValue,
            depositDetails,
            productSales,
            pumpTestByProduct:
              pumpTestByProduct.length > 0 ? pumpTestByProduct : undefined,
            freeFuelAmount: freeFuelAmount > 0 ? freeFuelAmount : undefined,
            freeFuelReason: freeFuelReason,
            titipanProducts: titipanProducts.length > 0 ? titipanProducts : undefined,
            createdById: depositCreatedById, // User yang input deposit (finance)
            approverId: user.id, // User yang approve deposit (manager)
            shift: operatorShiftWithReadings.shift || undefined,
            stationName:
              operatorShiftWithReadings.station?.name ||
              operatorShiftWithReadings.station?.code ||
              undefined,
            shiftDate: operatorShiftWithReadings.date || undefined,
            operatorName:
              operatorShiftWithReadings.operator?.profile?.name ||
              operatorShiftWithReadings.operator?.username ||
              undefined,
            tx,
          });
        }
      },
      {
        maxWait: 10000, // 10 detik untuk menunggu lock
        timeout: 30000, // 30 detik untuk timeout transaction
      }
    );

    revalidatePath(`/gas-stations/${deposit.operatorShift.gasStationId}`);

    return {
      success: true,
      message:
        input.status === "APPROVED"
          ? "Deposit berhasil diapprove"
          : "Deposit ditolak",
    };
  } catch (error) {
    console.error("Verify deposit error:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Gagal verifikasi deposit" };
  }
}
