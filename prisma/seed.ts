import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  AssetStatus,
  AuditAction,
  IncidentSeverity,
  IncidentStatus,
  MovementType,
  PrismaClient,
  UserRole,
} from "../lib/generated/prisma/client";

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
      description: "Gestion du stock, support et infrastructure IT.",
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

  const networkTechnician = await prisma.user.upsert({
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

  await prisma.user.upsert({
    where: { email: "support.it@procordc.com" },
    update: {},
    create: {
      firebaseUid: "seed-support-it",
      email: "support.it@procordc.com",
      name: "Support IT Terrain",
      role: UserRole.TECHNICIAN,
      departmentId: itDepartment.id,
    },
  });

  const locations = await Promise.all(
    [
      ["HQ", "Kinshasa HQ"],
      ["DTC", "Datacenter"],
      ["MINE-A", "Site Mining A"],
      ["OPS", "Operations terrain"],
    ].map(([code, name]) =>
      prisma.location.upsert({
        where: { code },
        update: {},
        create: { code, name },
      }),
    ),
  );

  const categories = await Promise.all(
    ["Laptop", "Network", "Power", "Telecom", "Server", "Radio"].map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const categoryByName = Object.fromEntries(
    categories.map((category) => [category.name, category]),
  );
  const locationByCode = Object.fromEntries(
    locations.map((location) => [location.code, location]),
  );

  const defaultSupplier = await prisma.supplier.upsert({
    where: { code: "PROC-IT" },
    update: {},
    create: {
      code: "PROC-IT",
      name: "PROCO IT Supply",
      email: "supply@procordc.com",
      phone: "+243 000 000 000",
    },
  });

  const router = await prisma.asset.upsert({
    where: { sku: "IT-RTR-015" },
    update: {},
    create: {
      sku: "IT-RTR-015",
      serialNumber: "RTR-4331-00015",
      name: "Cisco ISR 4331",
      status: AssetStatus.BROKEN,
      purchaseValue: "3820.00",
      quantityOnHand: 1,
      reorderPoint: 1,
      minQuantity: 0,
      supplierId: defaultSupplier.id,
      categoryId: categoryByName.Network.id,
      locationId: locationByCode["MINE-A"].id,
      createdById: admin.id,
    },
  });

  const laptop = await prisma.asset.upsert({
    where: { sku: "IT-LAP-042" },
    update: {},
    create: {
      sku: "IT-LAP-042",
      barcode: "EAN-LAP-7420",
      serialNumber: "DL-7420-00042",
      name: "Dell Latitude 7420",
      brand: "Dell",
      model: "7420",
      status: AssetStatus.AVAILABLE,
      purchaseValue: "1240.00",
      quantityOnHand: 8,
      reorderPoint: 3,
      minQuantity: 2,
      maxQuantity: 20,
      supplierId: defaultSupplier.id,
      categoryId: categoryByName.Laptop.id,
      locationId: locationByCode.HQ.id,
      createdById: admin.id,
    },
  });

  await prisma.asset.upsert({
    where: { sku: "IT-UPS-028" },
    update: {},
    create: {
      sku: "IT-UPS-028",
      serialNumber: "APC-UPS-00028",
      name: "APC Smart UPS",
      status: AssetStatus.MAINTENANCE,
      purchaseValue: "920.00",
      quantityOnHand: 2,
      reorderPoint: 2,
      minQuantity: 1,
      supplierId: defaultSupplier.id,
      categoryId: categoryByName.Power.id,
      locationId: locationByCode.DTC.id,
      createdById: admin.id,
    },
  });

  await prisma.stockMovement.create({
    data: {
      assetId: laptop.id,
      type: MovementType.IN,
      quantity: 8,
      toLocationId: locationByCode.HQ.id,
      performedById: admin.id,
      reason: "Reception initiale stock laptops",
    },
  });

  await prisma.stockMovement.create({
    data: {
      assetId: router.id,
      type: MovementType.TRANSFER,
      fromLocationId: locationByCode.HQ.id,
      toLocationId: locationByCode["MINE-A"].id,
      performedById: admin.id,
      reason: "Affectation reseau au site Mining A.",
    },
  });

  const incident = await prisma.incident.upsert({
    where: { reference: "INC-2406-018" },
    update: {},
    create: {
      reference: "INC-2406-018",
      assetId: router.id,
      title: "Perte intermittente de liaison WAN",
      description: "Instabilite observee sur la liaison principale du site.",
      severity: IncidentSeverity.HIGH,
      status: IncidentStatus.DIAGNOSING,
      reporterId: admin.id,
      assigneeId: networkTechnician.id,
    },
  });

  await prisma.incidentUpdate.create({
    data: {
      incidentId: incident.id,
      authorId: networkTechnician.id,
      statusFrom: IncidentStatus.IDENTIFIED,
      statusTo: IncidentStatus.DIAGNOSING,
      comment: "Incident identifie et diagnostic reseau en cours.",
    },
  });

  const session = await prisma.inventorySession.create({
    data: {
      name: "Inventaire trimestriel Q2",
      description: "Controle terrain du parc IT",
      checks: {
        create: [
          {
            assetId: router.id,
            expectedLocationId: locationByCode["MINE-A"].id,
            status: "FOUND",
            checkedById: admin.id,
          },
          {
            assetId: laptop.id,
            expectedLocationId: locationByCode.HQ.id,
            status: "FOUND",
            checkedById: admin.id,
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.INCIDENT_UPDATE,
      entityType: "Incident",
      entityId: incident.id,
      assetId: router.id,
      actorId: admin.id,
      description: "Creation du suivi de panne seed.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
