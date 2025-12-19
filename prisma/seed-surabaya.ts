import { prisma, seedOperationalData } from "./seed-operational";
import { createUTCDate } from "../lib/utils/datetime";

async function main() {
  // Date range: 14 Desember 2025 - 5 Januari 2026
  // Hanya 1 shift per hari (MORNING)
  await seedOperationalData("Surabaya", {
    startDate: createUTCDate(2025, 11, 14), // month is 0-indexed, so 11 = December
    endDate: createUTCDate(2026, 0, 5), // month is 0-indexed, so 0 = January
    shifts: ["MORNING"],
  });
}

main()
  .catch((e) => {
    console.error("❌ Error seeding Surabaya:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

