import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// PRIORITAS: Gunakan DATABASE_URL untuk direct connection (lebih reliable)
// Hanya gunakan PRISMA_DATABASE_URL jika DATABASE_URL tidak ada
// Ini untuk mencegah koneksi ke database yang salah
const databaseUrl = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or PRISMA_DATABASE_URL environment variable is not set. Please check your .env file or environment configuration."
  );
}

// Logging untuk debugging (hanya di development)
if (process.env.NODE_ENV === "development") {
  const urlSource = process.env.DATABASE_URL
    ? "DATABASE_URL"
    : "PRISMA_DATABASE_URL";
  const maskedUrl = databaseUrl
    .replace(/(:\/\/)([^:]+):([^@]+)@/, "$1***:***@") // Mask username:password
    .substring(0, 100); // Limit length
  console.log(`[Prisma] Using ${urlSource}: ${maskedUrl}...`);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Handle connection errors
prisma.$connect().catch((error) => {
  console.error("Failed to connect to database:", error);
  if (error.message?.includes("db.prisma.io")) {
    console.error(
      "Troubleshooting: Pastikan DATABASE_URL menggunakan format yang benar:\n" +
        "- Direct connection: postgresql://user:password@host:5432/database\n" +
        "- Prisma Accelerate: prisma+postgres://accelerate.prisma-data.net/..."
    );
  }
});

globalForPrisma.prisma = prisma;
