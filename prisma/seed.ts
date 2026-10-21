import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, UserRole } from "../lib/generated/prisma/client";

import {
  KycWorkbookMissingError,
  SeedRefusedError,
  seedKycInventory,
} from "../lib/import-kyc-inventory";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const itDepartment = await prisma.department.upsert({
    where: { name: "Departement IT" },
    update: {},
    create: {
      name: "Departement IT",
      description: "Gestion du parc IT PROCO KYC & Call Center.",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "it.admin@procordc.com" },
    update: {},
    create: {
      firebaseUid: "seed-it-admin",
      email: "it.admin@procordc.com",
      name: "Administrateur IT",
      role: UserRole.IT_MANAGER,
      departmentId: itDepartment.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "reseau.tech@procordc.com" },
    update: {},
    create: {
      firebaseUid: "seed-reseau-tech",
      email: "reseau.tech@procordc.com",
      name: "Technicien Reseau",
      role: UserRole.TECHNICIAN,
      departmentId: itDepartment.id,
    },
  });

  const reset = process.argv.includes("--reset");
  const result = await seedKycInventory(prisma, admin.id, { reset });
  console.log(
    `Seed KYC termine: ${result.created} actifs codes, ${result.locations} sites, ${result.holders} detenteurs.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    const isExpected =
      error instanceof SeedRefusedError || error instanceof KycWorkbookMissingError;
    console.error(isExpected ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
