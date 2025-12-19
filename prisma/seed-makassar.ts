import { prisma, seedOperationalData } from "./seed-operational";

async function main() {
  await seedOperationalData("Makassar");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding Makassar:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

