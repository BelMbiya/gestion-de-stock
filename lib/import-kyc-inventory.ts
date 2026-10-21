import { existsSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import type { PrismaClient } from "./generated/prisma/client";

import { KYC_EXCEL_FILE, KYC_EXCEL_SHEET_NAMES } from "./kyc-excel/sheet-names";
import {
  inferCategory,
  parseAllKycSheets,
  projectSheetsToAssets,
} from "./kyc-excel/sheet-parsers";
import { locationCode } from "./kyc-excel/shared";
import type { KycExcelSheetName } from "./kyc-excel/sheet-names";

export {
  inferCategory,
  kycSheetParsers,
  type KycImportRow,
  parseAllKycSheets,
  projectSheetsToAssets,
} from "./kyc-excel/sheet-parsers";
export { KYC_EXCEL_FILE, KYC_EXCEL_SHEET_NAMES } from "./kyc-excel/sheet-names";
export { KYC_UI, KYC_PROCO_COLUMNS, KYC_IN_STORE_COLUMNS, KYC_WORKSTATION_COLUMNS, KYC_SHEET_LABELS } from "./kyc-excel/terminology";

export class KycWorkbookMissingError extends Error {
  constructor(filePath: string) {
    super(
      `Classeur KYC introuvable : ${filePath}. ` +
        `Placez "${KYC_EXCEL_FILE}" a la racine du projet (fichier non versionne : donnees reelles).`,
    );
    this.name = "KycWorkbookMissingError";
  }
}

function kycWorkbookPath(baseDir: string) {
  return path.join(baseDir, KYC_EXCEL_FILE);
}

export function hasKycWorkbook(baseDir = process.cwd()) {
  return existsSync(kycWorkbookPath(baseDir));
}

export function loadKycWorkbookRows(baseDir = process.cwd()) {
  const filePath = kycWorkbookPath(baseDir);
  if (!existsSync(filePath)) {
    throw new KycWorkbookMissingError(filePath);
  }
  const workbook = XLSX.readFile(filePath);
  const sheets = {} as Record<KycExcelSheetName, unknown[][]>;

  for (const name of KYC_EXCEL_SHEET_NAMES) {
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: "",
    });
  }

  return sheets;
}

export function loadKycInventoryFromExcel(baseDir = process.cwd()) {
  const parsed = parseAllKycSheets(loadKycWorkbookRows(baseDir));
  return projectSheetsToAssets(parsed);
}

export class SeedRefusedError extends Error {
  constructor(assetCount: number) {
    super(
      `Seed refuse : la base contient deja ${assetCount} actifs. ` +
        "Le reimport KYC efface actifs, affectations, mouvements, pannes et journal d'audit. " +
        "Relancez avec --reset pour confirmer (npm run prisma:seed -- --reset).",
    );
    this.name = "SeedRefusedError";
  }
}

/** Le reimport est destructif : il n'est autorise que sur une base vide ou avec reset explicite. */
export async function assertSeedAllowed(
  prisma: PrismaClient,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    return;
  }

  const assetCount = await prisma.asset.count();
  if (assetCount > 0) {
    throw new SeedRefusedError(assetCount);
  }
}

export async function seedKycInventory(
  prisma: PrismaClient,
  adminUserId: string,
  options: { reset?: boolean } = {},
) {
  await assertSeedAllowed(prisma, options);

  const parsed = parseAllKycSheets(loadKycWorkbookRows());
  const items = projectSheetsToAssets(parsed);

  await prisma.auditLog.deleteMany();
  await prisma.maintenancePart.deleteMany();
  await prisma.incidentUpdate.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.inventoryCheck.deleteMany();
  await prisma.inventorySession.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.assetAssignment.deleteMany();
  await prisma.asset.deleteMany();

  const locationNames = new Set<string>();
  const categoryNames = new Set<string>();

  for (const item of items) {
    locationNames.add(item.locationName ?? "Mandala Square");
    categoryNames.add(inferCategory(item.name, item.assetGroup));
  }

  const locations = new Map<string, string>();
  for (const name of [...locationNames].sort()) {
    const code = locationCode(name) || "DEFAULT";
    const location = await prisma.location.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
    locations.set(name, location.id);
  }

  const categories = new Map<string, string>();
  for (const name of [...categoryNames].sort()) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories.set(name, category.id);
  }

  const supplier = await prisma.supplier.upsert({
    where: { code: "PROCO" },
    update: { name: "PROCO IT" },
    create: {
      code: "PROCO",
      name: "PROCO IT",
      email: "it@procordc.com",
    },
  });

  const usedSerials = new Map<string, number>();
  let created = 0;

  for (const item of items) {
    const baseSerial = item.serialNumber;
    let serialNumber = baseSerial;
    if (baseSerial) {
      const count = usedSerials.get(baseSerial) ?? 0;
      if (count > 0) {
        serialNumber = `${baseSerial}-DUP${count + 1}`;
      }
      usedSerials.set(baseSerial, count + 1);
    }

    const categoryName = inferCategory(item.name, item.assetGroup);
    const asset = await prisma.asset.create({
      data: {
        sku: item.sku,
        serialNumber,
        name: item.name,
        description: item.description,
        brand: item.brand,
        model: item.model,
        systemOs: item.systemOs,
        storageRam: item.storageRam,
        ownerLabel: item.ownerLabel,
        custodianName: item.custodianName,
        workstationCode: item.workstationCode,
        processLabel: item.processLabel,
        assetGroup: item.assetGroup,
        status: item.status,
        condition: item.condition,
        quantityOnHand: item.quantityOnHand,
        minQuantity: 0,
        reorderPoint: 1,
        unit: item.unit,
        purchaseValue: item.purchaseValue,
        purchaseDate: item.purchaseDate,
        categoryId: categories.get(categoryName)!,
        locationId: locations.get(item.locationName ?? "Mandala Square"),
        supplierId: supplier.id,
        createdById: adminUserId,
      },
    });

    if (item.custodianName) {
      await prisma.assetAssignment.create({
        data: {
          assetId: asset.id,
          status: "ACTIVE",
          notes: `Import KYC — ${item.custodianName}`,
        },
      });
    }

    created += 1;
  }

  return {
    created,
    items: items.length,
    locations: locations.size,
    categories: categories.size,
  };
}
