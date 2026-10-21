import { existsSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import type { PrismaClient } from "./generated/prisma/client";

import { KYC_EXCEL_FILE, KYC_EXCEL_SHEET_NAMES } from "./kyc-excel/sheet-names";
import {
  parseAllKycSheets,
  projectSheetsToAssets,
} from "./kyc-excel/sheet-parsers";
import { KYC_TYPE_OVERRIDES } from "./catalog/type-overrides";
import { locationCode } from "./kyc-excel/shared";
import { planAssetCodesMigration } from "./migrations/asset-codes";
import {
  holderKeyFor,
  planTrackingAndHoldersMigration,
  trackingModeForGroup,
} from "./migrations/tracking-and-holders";
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
  await prisma.holder.deleteMany();

  // Memes regles que la migration du lot 3 : un detenteur par nom distinct de l'Excel.
  const holderPlan = planTrackingAndHoldersMigration({
    assets: items.map((item, index) => ({
      id: String(index),
      assetGroup: item.assetGroup,
      custodianName: item.custodianName,
      processLabel: item.processLabel,
      status: item.status,
      trackingMode: null,
    })),
    assignments: [],
    holders: [],
  });
  const holderIds = new Map<string, string>();
  for (const holder of holderPlan.holdersToCreate) {
    const createdHolder = await prisma.holder.create({
      data: { type: holder.type, fullName: holder.fullName, process: holder.process },
    });
    holderIds.set(holder.key, createdHolder.id);
  }

  const locationNames = new Set(items.map((item) => item.locationName ?? "Mandala Square"));
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

  const supplier = await prisma.supplier.upsert({
    where: { code: "PROCO" },
    update: { name: "PROCO IT" },
    create: {
      code: "PROCO",
      name: "PROCO IT",
      email: "it@procordc.com",
    },
  });

  // Numeros de serie en double dans l'Excel : suffixe -DUPn (le champ est unique).
  const usedSerials = new Map<string, number>();
  const serials = items.map((item) => {
    if (!item.serialNumber) return null;
    const count = usedSerials.get(item.serialNumber) ?? 0;
    usedSerials.set(item.serialNumber, count + 1);
    return count > 0 ? `${item.serialNumber}-DUP${count + 1}` : item.serialNumber;
  });

  // Memes regles que la migration du lot 4 : type, code, decoupage des lignes multiples, famille.
  const types = await prisma.assetType.findMany();
  const typesByPrefix = new Map(types.map((type) => [type.prefix, type]));
  const codePlan = planAssetCodesMigration(
    {
      assets: items.map((item, index) => ({
        id: String(index),
        sku: item.sku,
        importRef: null,
        name: item.name,
        trackingMode: trackingModeForGroup(item.assetGroup),
        status: item.status,
        serialNumber: serials[index],
        typePrefix: null,
        hasActiveAssignment: holderKeyFor(item.custodianName) !== null,
        categoryName: "",
      })),
      categories: [],
      types: [],
    },
    KYC_TYPE_OVERRIDES,
  );
  if (codePlan.blocking) {
    throw new Error(
      `Materiels sans type : ${codePlan.unclassified.map((item) => `${item.name} (${item.sku})`).join(", ")}. ` +
        "Fixez leur type dans lib/catalog/type-overrides.ts.",
    );
  }

  let created = 0;
  for (const planned of codePlan.codes) {
    const index = Number(planned.sourceAssetId);
    const item = items[index];
    const type = typesByPrefix.get(planned.prefix);
    if (!type) {
      throw new Error(`Type ${planned.prefix} absent de la base : appliquez les migrations avant le seed.`);
    }
    const trackingMode = trackingModeForGroup(item.assetGroup);
    const asset = await prisma.asset.create({
      data: {
        sku: planned.code,
        importRef: planned.importRef,
        typeId: type.id,
        categoryId: type.categoryId,
        serialNumber: planned.isCopy ? null : serials[index],
        name: planned.name,
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
        trackingMode,
        status: item.status,
        condition: item.condition,
        quantityOnHand: trackingMode === "SERIALIZED" ? 1 : item.quantityOnHand,
        minQuantity: 0,
        unit: item.unit,
        purchaseValue: item.purchaseValue,
        purchaseDate: item.purchaseDate,
        locationId: locations.get(item.locationName ?? "Mandala Square"),
        supplierId: supplier.id,
        createdById: adminUserId,
      },
    });

    const holderKey = holderKeyFor(item.custodianName);
    const holderId = holderKey && !planned.isCopy ? holderIds.get(holderKey.key) : undefined;
    if (holderId) {
      await prisma.assetAssignment.create({
        data: { assetId: asset.id, holderId, kind: "DOTATION", status: "ACTIVE", notes: "Import KYC" },
      });
    }

    created += 1;
  }

  for (const [prefix, nextNumber] of Object.entries(codePlan.typeCounters)) {
    await prisma.assetType.update({ where: { prefix }, data: { nextNumber } });
  }

  return {
    created,
    items: items.length,
    locations: locations.size,
    holders: holderIds.size,
  };
}
