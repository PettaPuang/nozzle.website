import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  startOfDayUTC,
  addDaysUTC,
  createUTCDate,
} from "../lib/utils/datetime";
import {
  createStandardCOAs,
  findOrCreateInventoryCOA,
  findOrCreateRevenueCOAForProduct,
  findOrCreateCOGSCOA,
  findOrCreateShrinkageCOA,
} from "../lib/utils/coa.utils";
import { prisma, retryDatabaseOperation, hashPassword } from "./seed-helpers";

// Rentang tanggal: 2025-11-15 s/d 2026-01-15
const START_DATE = createUTCDate(2025, 10, 15); // month is 0-indexed

async function main() {
  console.log("🌱 Starting infrastructure seed data generation...");

  // 1. Buat Developer user untuk audit trail
  const developerPassword = await hashPassword("developer123");
  const developer = await prisma.user.upsert({
    where: { username: "developer" },
    update: {},
    create: {
      username: "developer",
      email: "developer@nozzl.app",
      password: developerPassword,
      role: "DEVELOPER",
      profile: {
        create: {
          name: "Developer System",
          phone: "081234567890",
        },
      },
    },
  });

  console.log("✅ Developer user created");

  // 2. Buat 3 SPBU dengan owner masing-masing
  const gasStations = [
    {
      name: "SPBU Makassar",
      address: "Jl. Ahmad Yani No. 123, Makassar, Sulawesi Selatan",
      latitude: -5.1477,
      longitude: 119.4327,
      owner: {
        username: "owner_makassar",
        email: "owner.makassar@nozzl.app",
        name: "Ahmad Makassar",
        phone: "081111111111",
      },
      products: [
        {
          name: "Pertalite",
          ron: "90",
          purchasePrice: 8500,
          sellingPrice: 10000,
        },
        {
          name: "Pertamax",
          ron: "92",
          purchasePrice: 11000,
          sellingPrice: 13000,
        },
        {
          name: "Dexlite",
          ron: null,
          purchasePrice: 9500,
          sellingPrice: 11000,
        },
        {
          name: "Biosolar",
          ron: null,
          purchasePrice: 7000,
          sellingPrice: 8500,
        },
        {
          name: "Pertamax Turbo",
          ron: "95",
          purchasePrice: 12000,
          sellingPrice: 14000,
        },
      ],
    },
    {
      name: "SPBU Surabaya",
      address: "Jl. Diponegoro No. 456, Surabaya, Jawa Timur",
      latitude: -7.2575,
      longitude: 112.7521,
      owner: {
        username: "owner_surabaya",
        email: "owner.surabaya@nozzl.app",
        name: "Budi Surabaya",
        phone: "082222222222",
      },
      products: [
        {
          name: "Pertalite",
          ron: "90",
          purchasePrice: 8500,
          sellingPrice: 10000,
        },
        {
          name: "Pertamax",
          ron: "92",
          purchasePrice: 11000,
          sellingPrice: 13000,
        },
        {
          name: "Dexlite",
          ron: null,
          purchasePrice: 9500,
          sellingPrice: 11000,
        },
        {
          name: "Biosolar",
          ron: null,
          purchasePrice: 7000,
          sellingPrice: 8500,
        },
        {
          name: "Pertamax Turbo",
          ron: "95",
          purchasePrice: 12000,
          sellingPrice: 14000,
        },
      ],
    },
    {
      name: "SPBU Pangkep",
      address: "Jl. Poros Makassar-Pangkep KM 45, Pangkep, Sulawesi Selatan",
      latitude: -4.8333,
      longitude: 119.5667,
      owner: {
        username: "owner_pangkep",
        email: "owner.pangkep@nozzl.app",
        name: "Citra Pangkep",
        phone: "083333333333",
      },
      products: [
        {
          name: "Pertalite",
          ron: "90",
          purchasePrice: 8500,
          sellingPrice: 10000,
        },
        {
          name: "Pertamax",
          ron: "92",
          purchasePrice: 11000,
          sellingPrice: 13000,
        },
        {
          name: "Dexlite",
          ron: null,
          purchasePrice: 9500,
          sellingPrice: 11000,
        },
        {
          name: "Biosolar",
          ron: null,
          purchasePrice: 7000,
          sellingPrice: 8500,
        },
      ],
    },
  ];

  const createdGasStations = [];

  for (const gsData of gasStations) {
    // Buat owner user
    const ownerPassword = await hashPassword("owner123");
    const owner = await retryDatabaseOperation(() =>
      prisma.user.upsert({
        where: { username: gsData.owner.username },
        update: {},
        create: {
          username: gsData.owner.username,
          email: gsData.owner.email,
          password: ownerPassword,
          role: "OWNER",
          profile: {
            create: {
              name: gsData.owner.name,
              phone: gsData.owner.phone,
              createdBy: { connect: { id: developer.id } },
            },
          },
          createdBy: { connect: { id: developer.id } },
        },
      })
    );

    // Buat gas station
    const gasStation = await retryDatabaseOperation(() =>
      prisma.gasStation.create({
        data: {
          name: gsData.name,
          address: gsData.address,
          latitude: gsData.latitude,
          longitude: gsData.longitude,
          ownerId: owner.id,
          openTime: "06:00",
          closeTime: "22:00",
          status: "ACTIVE",
          subscriptionType: "TRIAL",
          subscriptionStartDate: START_DATE,
          subscriptionEndDate: addDaysUTC(START_DATE, 15),
          isTrial: true,
          createdById: developer.id,
        },
      })
    );

    // Buat standard COAs dengan retry
    await retryDatabaseOperation(() =>
      createStandardCOAs(gasStation.id, developer.id)
    );

    // Buat products dan COA untuk setiap produk
    const createdProducts = [];
    for (const productData of gsData.products) {
      const product = await retryDatabaseOperation(() =>
        prisma.product.create({
          data: {
            gasStationId: gasStation.id,
            name: productData.name,
            ron: productData.ron,
            purchasePrice: productData.purchasePrice,
            sellingPrice: productData.sellingPrice,
            createdById: developer.id,
          },
        })
      );

      // Buat COA untuk produk ini
      await findOrCreateInventoryCOA(gasStation.id, product.name, developer.id);
      await findOrCreateRevenueCOAForProduct(
        gasStation.id,
        product.name,
        developer.id
      );
      await findOrCreateCOGSCOA(gasStation.id, product.name, developer.id);
      await findOrCreateShrinkageCOA(gasStation.id, product.name, developer.id);

      createdProducts.push(product);
    }

    // Buat tanks
    const tanks = [];

    // Pertalite: 2 tank (Motor & Mobil)
    const pertalite = createdProducts.find((p) => p.name === "Pertalite")!;
    tanks.push(
      await retryDatabaseOperation(() =>
        prisma.tank.create({
          data: {
            gasStationId: gasStation.id,
            productId: pertalite.id,
            code: "T-PLT-MTR",
            name: "Tank Pertalite Motor",
            capacity: 24000,
            initialStock: 12000,
            createdById: developer.id,
          },
        })
      )
    );
    tanks.push(
      await retryDatabaseOperation(() =>
        prisma.tank.create({
          data: {
            gasStationId: gasStation.id,
            productId: pertalite.id,
            code: "T-PLT-MBL",
            name: "Tank Pertalite Mobil",
            capacity: 30000,
            initialStock: 15000,
            createdById: developer.id,
          },
        })
      )
    );

    // Pertamax: 1 tank
    const pertamax = createdProducts.find((p) => p.name === "Pertamax")!;
    tanks.push(
      await retryDatabaseOperation(() =>
        prisma.tank.create({
          data: {
            gasStationId: gasStation.id,
            productId: pertamax.id,
            code: "T-PMX-01",
            name: "Tank Pertamax",
            capacity: 20000,
            initialStock: 10000,
            createdById: developer.id,
          },
        })
      )
    );

    // Biosolar: 1 tank
    const biosolar = createdProducts.find((p) => p.name === "Biosolar")!;
    tanks.push(
      await retryDatabaseOperation(() =>
        prisma.tank.create({
          data: {
            gasStationId: gasStation.id,
            productId: biosolar.id,
            code: "T-BSL-01",
            name: "Tank Biosolar",
            capacity: 40000,
            initialStock: 20000,
            createdById: developer.id,
          },
        })
      )
    );

    // Dexlite: 1 tank
    const dexlite = createdProducts.find((p) => p.name === "Dexlite")!;
    tanks.push(
      await retryDatabaseOperation(() =>
        prisma.tank.create({
          data: {
            gasStationId: gasStation.id,
            productId: dexlite.id,
            code: "T-DXL-01",
            name: "Tank Dexlite",
            capacity: 35000,
            initialStock: 17500,
            createdById: developer.id,
          },
        })
      )
    );

    // Pertamax Turbo (hanya Makassar & Surabaya)
    const turbo = createdProducts.find((p) => p.name === "Pertamax Turbo");
    if (turbo) {
      tanks.push(
        await retryDatabaseOperation(() =>
          prisma.tank.create({
            data: {
              gasStationId: gasStation.id,
              productId: turbo.id,
              code: "T-TUR-01",
              name: "Tank Pertamax Turbo",
              capacity: 15000,
              initialStock: 7500,
              createdById: developer.id,
            },
          })
        )
      );
    }

    // Buat stations
    const stations = [];
    const station01 = await retryDatabaseOperation(() =>
      prisma.station.create({
        data: {
          gasStationId: gasStation.id,
          code: "01",
          name: "Pulau 01 - Motor",
          createdById: developer.id,
        },
      })
    );
    stations.push(station01);

    const station02 = await retryDatabaseOperation(() =>
      prisma.station.create({
        data: {
          gasStationId: gasStation.id,
          code: "02",
          name: "Pulau 02 - Mobil",
          createdById: developer.id,
        },
      })
    );
    stations.push(station02);

    const station03 = await retryDatabaseOperation(() =>
      prisma.station.create({
        data: {
          gasStationId: gasStation.id,
          code: "03",
          name: "Pulau 03 - Solar/Dex",
          createdById: developer.id,
        },
      })
    );
    stations.push(station03);

    // Station 04 hanya untuk Makassar & Surabaya
    if (turbo) {
      const station04 = await retryDatabaseOperation(() =>
        prisma.station.create({
          data: {
            gasStationId: gasStation.id,
            code: "04",
            name: "Pulau 04 - Pertamax/Turbo",
            createdById: developer.id,
          },
        })
      );
      stations.push(station04);
    }

    // Buat TankStation connections
    const pertaliteMotorTank = tanks.find((t) => t.code === "T-PLT-MTR")!;
    const pertaliteMobilTank = tanks.find((t) => t.code === "T-PLT-MBL")!;
    const pertamaxTank = tanks.find((t) => t.code === "T-PMX-01")!;
    const biosolarTank = tanks.find((t) => t.code === "T-BSL-01")!;
    const dexliteTank = tanks.find((t) => t.code === "T-DXL-01")!;
    const turboTank = tanks.find((t) => t.code === "T-TUR-01");

    // Station 01 (Motor): Pertalite Motor + Pertamax
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: pertaliteMotorTank.id,
          stationId: station01.id,
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: pertamaxTank.id,
          stationId: station01.id,
          createdById: developer.id,
        },
      })
    );

    // Station 02 (Mobil): Pertalite Mobil + Pertamax
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: pertaliteMobilTank.id,
          stationId: station02.id,
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: pertamaxTank.id,
          stationId: station02.id,
          createdById: developer.id,
        },
      })
    );

    // Station 03 (Solar/Dex): Biosolar + Dexlite
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: biosolarTank.id,
          stationId: station03.id,
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.tankStation.create({
        data: {
          tankId: dexliteTank.id,
          stationId: station03.id,
          createdById: developer.id,
        },
      })
    );

    // Station 04 (Turbo): Pertamax + Turbo (jika ada)
    if (turboTank && stations.length > 3) {
      await retryDatabaseOperation(() =>
        prisma.tankStation.create({
          data: {
            tankId: pertamaxTank.id,
            stationId: stations[3].id,
            createdById: developer.id,
          },
        })
      );
      await retryDatabaseOperation(() =>
        prisma.tankStation.create({
          data: {
            tankId: turboTank.id,
            stationId: stations[3].id,
            createdById: developer.id,
          },
        })
      );
    }

    // Buat nozzles
    // Station 01: Pertalite (2 nozzle) + Pertamax (1 nozzle)
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station01.id,
          tankId: pertaliteMotorTank.id,
          productId: pertalite.id,
          code: "N01-01",
          name: "Nozzle 01 Pertalite",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station01.id,
          tankId: pertaliteMotorTank.id,
          productId: pertalite.id,
          code: "N01-02",
          name: "Nozzle 02 Pertalite",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station01.id,
          tankId: pertamaxTank.id,
          productId: pertamax.id,
          code: "N01-03",
          name: "Nozzle 03 Pertamax",
          createdById: developer.id,
        },
      })
    );

    // Station 02: Pertalite (2 nozzle) + Pertamax (1 nozzle)
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station02.id,
          tankId: pertaliteMobilTank.id,
          productId: pertalite.id,
          code: "N02-01",
          name: "Nozzle 01 Pertalite",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station02.id,
          tankId: pertaliteMobilTank.id,
          productId: pertalite.id,
          code: "N02-02",
          name: "Nozzle 02 Pertalite",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station02.id,
          tankId: pertamaxTank.id,
          productId: pertamax.id,
          code: "N02-03",
          name: "Nozzle 03 Pertamax",
          createdById: developer.id,
        },
      })
    );

    // Station 03: Biosolar (2 nozzle) + Dexlite (1 nozzle)
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station03.id,
          tankId: biosolarTank.id,
          productId: biosolar.id,
          code: "N03-01",
          name: "Nozzle 01 Biosolar",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station03.id,
          tankId: biosolarTank.id,
          productId: biosolar.id,
          code: "N03-02",
          name: "Nozzle 02 Biosolar",
          createdById: developer.id,
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.nozzle.create({
        data: {
          stationId: station03.id,
          tankId: dexliteTank.id,
          productId: dexlite.id,
          code: "N03-03",
          name: "Nozzle 03 Dexlite",
          createdById: developer.id,
        },
      })
    );

    // Station 04: Pertamax (1 nozzle) + Turbo (1 nozzle) - jika ada
    if (turboTank && turbo && stations.length > 3) {
      await retryDatabaseOperation(() =>
        prisma.nozzle.create({
          data: {
            stationId: stations[3].id,
            tankId: pertamaxTank.id,
            productId: pertamax.id,
            code: "N04-01",
            name: "Nozzle 01 Pertamax",
            createdById: developer.id,
          },
        })
      );
      await retryDatabaseOperation(() =>
        prisma.nozzle.create({
          data: {
            stationId: stations[3].id,
            tankId: turboTank.id,
            productId: turbo.id,
            code: "N04-02",
            name: "Nozzle 02 Turbo",
            createdById: developer.id,
          },
        })
      );
    }

    // 3. Buat user dengan berbagai role untuk SPBU ini
    // Nama realistis berdasarkan SPBU
    const userNames = {
      makassar: {
        manager: "Ahmad Rizki",
        finance: "Siti Nurhaliza",
        unloader: "Muhammad Fadli",
        operators: ["Andi Pratama", "Budi Santoso", "Dedi Kurniawan", "Eko Wijaya"],
      },
      surabaya: {
        manager: "Bambang Setyawan",
        finance: "Dewi Lestari",
        unloader: "Joko Widodo",
        operators: ["Ahmad Yani", "Budi Raharjo", "Cahyo Nugroho", "Dian Permata"],
      },
      pangkep: {
        manager: "Muhammad Arif",
        finance: "Nurul Hikmah",
        unloader: "Rahmat Hidayat",
        operators: ["Ahmad Fauzi", "Baharuddin", "Cahya Ramadhan"],
      },
    };

    const stationNameLower = gasStation.name.toLowerCase();
    let names;
    if (stationNameLower.includes("makassar")) {
      names = userNames.makassar;
    } else if (stationNameLower.includes("surabaya")) {
      names = userNames.surabaya;
    } else {
      names = userNames.pangkep;
    }

    // Manager
    const managerPassword = await hashPassword("manager123");
    const manager = await retryDatabaseOperation(() =>
      prisma.user.create({
        data: {
          username: `manager_${gasStation.id.slice(0, 8)}`,
          email: `manager.${gasStation.id.slice(0, 8)}@nozzl.app`,
          password: managerPassword,
          role: "MANAGER",
          profile: {
            create: {
              name: names.manager,
              phone: `0812345${gasStation.id.slice(0, 4)}`,
              avatar: "/avatars/manager-01.svg",
              createdBy: { connect: { id: developer.id } },
            },
          },
          createdBy: { connect: { id: developer.id } },
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.userGasStation.create({
        data: {
          userId: manager.id,
          gasStationId: gasStation.id,
          createdById: developer.id,
        },
      })
    );

    // Finance
    const financePassword = await hashPassword("finance123");
    const finance = await retryDatabaseOperation(() =>
      prisma.user.create({
        data: {
          username: `finance_${gasStation.id.slice(0, 8)}`,
          email: `finance.${gasStation.id.slice(0, 8)}@nozzl.app`,
          password: financePassword,
          role: "FINANCE",
          profile: {
            create: {
              name: names.finance,
              phone: `0812346${gasStation.id.slice(0, 4)}`,
              avatar: "/avatars/finance-01.svg",
              createdBy: { connect: { id: developer.id } },
            },
          },
          createdBy: { connect: { id: developer.id } },
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.userGasStation.create({
        data: {
          userId: finance.id,
          gasStationId: gasStation.id,
          createdById: developer.id,
        },
      })
    );

    // Unloader
    const unloaderPassword = await hashPassword("unloader123");
    const unloader = await retryDatabaseOperation(() =>
      prisma.user.create({
        data: {
          username: `unloader_${gasStation.id.slice(0, 8)}`,
          email: `unloader.${gasStation.id.slice(0, 8)}@nozzl.app`,
          password: unloaderPassword,
          role: "UNLOADER",
          profile: {
            create: {
              name: names.unloader,
              phone: `0812347${gasStation.id.slice(0, 4)}`,
              avatar: "/avatars/unloader-01.svg",
              createdBy: { connect: { id: developer.id } },
            },
          },
          createdBy: { connect: { id: developer.id } },
        },
      })
    );
    await retryDatabaseOperation(() =>
      prisma.userGasStation.create({
        data: {
          userId: unloader.id,
          gasStationId: gasStation.id,
          createdById: developer.id,
        },
      })
    );

    // Operators (sesuai jumlah station per SPBU)
    const operators = [];
    const stationCount = stations.length;
    for (let i = 1; i <= stationCount; i++) {
      const operatorPassword = await hashPassword("operator123");
      const operatorName = names.operators[i - 1] || `Operator ${i}`;
      const operator = await retryDatabaseOperation(() =>
        prisma.user.create({
          data: {
            username: `operator_${gasStation.id.slice(0, 8)}_${i}`,
            email: `operator${i}.${gasStation.id.slice(0, 8)}@nozzl.app`,
            password: operatorPassword,
            role: "OPERATOR",
            profile: {
              create: {
                name: operatorName,
                phone: `081234${i}${gasStation.id.slice(0, 3)}`,
                avatar: `/avatars/operator-0${i <= 3 ? i : (i % 3) + 1}.svg`,
                createdBy: { connect: { id: developer.id } },
              },
            },
            createdBy: { connect: { id: developer.id } },
          },
        })
      );
      await retryDatabaseOperation(() =>
        prisma.userGasStation.create({
          data: {
            userId: operator.id,
            gasStationId: gasStation.id,
            createdById: developer.id,
          },
        })
      );
      operators.push(operator);
    }

    createdGasStations.push({
      gasStation,
      owner,
      products: createdProducts,
      tanks,
      stations,
      users: {
        manager,
        finance,
        unloader,
        operators,
      },
    });

    console.log(`✅ ${gsData.name} created with infrastructure and users`);
  }

  console.log("🎉 Infrastructure seed data generation completed!");
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Run: npm run db:seed:makassar`);
  console.log(`   2. Run: npm run db:seed:surabaya`);
  console.log(`   3. Run: npm run db:seed:pangkep`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

