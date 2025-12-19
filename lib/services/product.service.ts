import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export class ProductService {
  static async findAll(gasStationId?: string) {
    const products = await prisma.product.findMany({
      where: gasStationId ? { gasStationId } : undefined,
      orderBy: { name: "asc" },
    });

    // Custom sort order
    const order = ["pertalite", "pertamax", "turbo", "solar", "dexlite", "dex"];

    return products.sort((a, b) => {
      const findIndex = (productName: string) => {
        const lower = productName.toLowerCase();
        // Check turbo first to avoid matching with pertamax
        if (lower.includes("turbo")) return order.indexOf("turbo");
        return order.findIndex((name) => lower.includes(name));
      };

      const aIndex = findIndex(a.name);
      const bIndex = findIndex(b.name);

      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  static async findAllForClient(gasStationId?: string) {
    const products = await this.findAll(gasStationId);
    return products.map((p) => ({
      ...p,
      purchasePrice: p.purchasePrice, // Sudah Int
      sellingPrice: p.sellingPrice, // Sudah Int
    }));
  }

  static async findById(id: string) {
    return await prisma.product.findUnique({
      where: { id },
    });
  }
}

// Export inferred types
export type ProductList = Awaited<
  ReturnType<typeof ProductService.findAll>
>[number];
export type ProductDetail = Awaited<ReturnType<typeof ProductService.findById>>;
export type ProductForClient = Awaited<
  ReturnType<typeof ProductService.findAllForClient>
>[number];
