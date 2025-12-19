"use server";

import { prisma } from "@/lib/prisma";

/**
 * Helper untuk mendapatkan harga beli produk
 * @param productId - ID product
 * @returns Harga beli dalam Rupiah (bulat)
 */
export async function getPurchasePrice(
  productId: string
): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { purchasePrice: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  return product.purchasePrice;
}

