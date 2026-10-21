import { AssetCondition, AssetStatus } from "../generated/prisma/client";
import {
  cell,
  cleanSerial,
  mapStatus,
  parseExcelDate,
  parseMoney,
  serialKey,
} from "./shared";
import type { KycExcelSheetName } from "./sheet-names";

export type ProcoKycCallItEquipementRow = {
  section: string;
  rowNo: number;
  description: string;
  model: string | null;
  serialNumber: string | null;
  systemLabel: string | null;
  hddRam: string | null;
  location: string | null;
  owner: string | null;
  designatedCustodian: string | null;
  relativeValue: string | null;
  lossImplication: string | null;
  riskSecurity: string | null;
  conditionLabel: string | null;
  purchaseDate: Date | null;
  acquisitionDate: Date | null;
  statusLabel: string | null;
};

export type InStoreRow = {
  rowNo: number;
  item: string;
  vendor: string | null;
  number: number;
  condition: string | null;
};

export type OtherAssetsRow = {
  section: string;
  rowNo: number;
  brand: string | null;
  model: string | null;
  vinOrSerial: string | null;
  licensePlate: string | null;
  location: string | null;
  quantity: number;
  condition: string | null;
};

export type WorkstationsRow = {
  side: "KYC" | "CC";
  rank: string | null;
  workStation: string;
  serialNumber: string | null;
  materiels: string | null;
  user: string | null;
  process: string | null;
  status: string | null;
};

export type DispostionKycRow = {
  provisionType: "CURRENT" | "DESIRABLE";
  item: string;
  department: string | null;
  total: string | null;
};

export type PurchaseDeliveredRow = {
  block: "RECEIVED" | "IN_STOCK";
  rowNo: number | null;
  item: string;
  quantity: number;
  blockDate: Date | null;
};

export type MaterialAccountsRow = {
  zone: "KYC" | "CC" | "ARCHIVING";
  rowNo: number;
  item: string;
  quantity: number;
  goodCondition: number;
  badCondition: number;
};

export type EquipmentConditionRow = {
  equipmentType: string;
  management: string | null;
  count: number | null;
  working: number | null;
  notWorking: number | null;
};

export type Feuil1Row = {
  status: string;
  materiels: string | null;
  user: string | null;
  process: string | null;
};

export type KycSheetParseResults = {
  "PROCO KYC & CALL IT EQUIPEMENT": ProcoKycCallItEquipementRow[];
  "IN STORE": InStoreRow[];
  "Dispostion KYC": DispostionKycRow[];
  "Other Assets": OtherAssetsRow[];
  "PURCHASE & DELIVERED": PurchaseDeliveredRow[];
  "MATERIAL ACCOUNTS": MaterialAccountsRow[];
  "Equipment Condition": EquipmentConditionRow[];
  Workstations: WorkstationsRow[];
  Feuil1: Feuil1Row[];
};

function inferBrand(description: string) {
  const upper = description.toUpperCase();
  if (upper.includes("HP ")) return "HP";
  if (upper.includes("DELL")) return "Dell";
  if (upper.includes("LENOVO")) return "Lenovo";
  if (upper.includes("ASUS")) return "Asus";
  if (upper.includes("CANON")) return "Canon";
  if (upper.includes("CISCO")) return "Cisco";
  if (upper.includes("TOYOTA")) return "Toyota";
  if (upper.includes("ACER")) return "Acer";
  if (upper.includes("EPSON")) return "Epson";
  return null;
}

function isOtherAssetsSection(label: string) {
  return /vehicule|other items|cafeteria|training room/i.test(label);
}

function isSectionHeaderRow(row: unknown[]) {
  const no = cell(row, 0);
  const label = cell(row, 1);
  if (!label || /^\d+$/.test(no)) {
    return false;
  }
  return /laptop|desktop|bcp|archive|printer|scanner|server|other|call center|mvr|vehicule|cafeteria|training|mobilier/i.test(
    label,
  );
}

/**
 * Parseurs nommes exactement comme les feuilles Excel (cles de l'objet).
 */
export const kycSheetParsers: {
  [K in KycExcelSheetName]: (rows: unknown[][]) => KycSheetParseResults[K];
} = {
  "PROCO KYC & CALL IT EQUIPEMENT"(rows) {
    const result: ProcoKycCallItEquipementRow[] = [];
    let section = "IT EQUIPMENT";

    for (const row of rows) {
      if (isSectionHeaderRow(row)) {
        section = cell(row, 1);
        continue;
      }

      const no = cell(row, 0);
      const description = cell(row, 1);
      if (!/^\d+$/.test(no) || !description) {
        continue;
      }

      result.push({
        section,
        rowNo: Number.parseInt(no, 10),
        description,
        model: cell(row, 2) || null,
        serialNumber: cleanSerial(cell(row, 3)),
        systemLabel: cell(row, 4) || null,
        hddRam: cell(row, 5) || null,
        location: cell(row, 6) || "Mandala Square",
        owner: cell(row, 7) || null,
        designatedCustodian: cell(row, 8) || null,
        relativeValue: parseMoney(cell(row, 9)),
        lossImplication: cell(row, 10) || null,
        riskSecurity: cell(row, 11) || null,
        conditionLabel: cell(row, 12) || null,
        purchaseDate: parseExcelDate(row[13]),
        acquisitionDate: parseExcelDate(row[14]),
        statusLabel: cell(row, 15) || cell(row, 12) || "Good",
      });
    }

    return result;
  },

  "IN STORE"(rows) {
    const result: InStoreRow[] = [];

    for (const row of rows) {
      const no = cell(row, 0);
      const item = cell(row, 1);
      if (!/^\d+$/.test(no) || !item) {
        continue;
      }

      const quantity = Number.parseInt(cell(row, 3), 10);
      result.push({
        rowNo: Number.parseInt(no, 10),
        item,
        vendor: cell(row, 2) || null,
        number: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        condition: cell(row, 4) || null,
      });
    }

    return result;
  },

  "Dispostion KYC"(rows) {
    const result: DispostionKycRow[] = [];

    for (const row of rows) {
      const currentItem = cell(row, 0);
      const desirableItem = cell(row, 6);

      if (currentItem && currentItem !== "ITEM" && !/^desirable/i.test(currentItem)) {
        result.push({
          provisionType: "CURRENT",
          item: currentItem,
          department: cell(row, 1) || null,
          total: cell(row, 3) || null,
        });
      }

      if (desirableItem && desirableItem !== "ITEM") {
        result.push({
          provisionType: "DESIRABLE",
          item: desirableItem,
          department: cell(row, 7) || null,
          total: cell(row, 9) || null,
        });
      }
    }

    return result;
  },

  "Other Assets"(rows) {
    const result: OtherAssetsRow[] = [];
    let section = "OTHER ASSETS";

    for (const row of rows) {
      const first = cell(row, 0);
      const second = cell(row, 1);

      if (!first && second && isOtherAssetsSection(second)) {
        section = second;
        continue;
      }

      const index = /^\d+$/.test(first) ? first : /^\d+$/.test(second) ? second : "";
      if (!index) {
        continue;
      }

      const isVehicle = /vehicule/i.test(section);
      const brand = cell(row, 1) || null;
      const model = cell(row, 2) || null;
      if (!brand && !model) {
        continue;
      }

      const quantityRaw = isVehicle ? 1 : Number.parseInt(cell(row, 2), 10);

      result.push({
        section,
        rowNo: Number.parseInt(index, 10),
        brand,
        model,
        vinOrSerial: cleanSerial(cell(row, 3)),
        licensePlate: isVehicle ? cell(row, 4) || null : null,
        location: cell(row, 5) || cell(row, 6) || "Mandala Square",
        quantity:
          Number.isFinite(quantityRaw) && quantityRaw > 0 && !isVehicle
            ? quantityRaw
            : 1,
        condition: cell(row, 7) || cell(row, 8) || "Good",
      });
    }

    return result;
  },

  "PURCHASE & DELIVERED"(rows) {
    const result: PurchaseDeliveredRow[] = [];

    for (const row of rows) {
      const receivedNo = cell(row, 1);
      const receivedItem = cell(row, 2);
      const receivedQty = Number.parseInt(cell(row, 3), 10);
      if (/^\d+$/.test(receivedNo) && receivedItem) {
        result.push({
          block: "RECEIVED",
          rowNo: Number.parseInt(receivedNo, 10),
          item: receivedItem,
          quantity: Number.isFinite(receivedQty) ? receivedQty : 0,
          blockDate: parseExcelDate(row[0]),
        });
      }

      const stockNo = cell(row, 5);
      const stockItem = cell(row, 6);
      const stockQty = Number.parseInt(cell(row, 7), 10);
      if (/^\d+$/.test(stockNo) && stockItem) {
        result.push({
          block: "IN_STOCK",
          rowNo: Number.parseInt(stockNo, 10),
          item: stockItem,
          quantity: Number.isFinite(stockQty) ? stockQty : 0,
          blockDate: parseExcelDate(row[4]),
        });
      }
    }

    return result;
  },

  "MATERIAL ACCOUNTS"(rows) {
    const result: MaterialAccountsRow[] = [];

    for (const row of rows) {
      const zones = [
        { zone: "KYC" as const, no: cell(row, 0), item: cell(row, 1), qty: cell(row, 3), good: cell(row, 4), bad: cell(row, 5) },
        { zone: "CC" as const, no: cell(row, 7), item: cell(row, 8), qty: cell(row, 10), good: cell(row, 11), bad: cell(row, 12) },
        { zone: "ARCHIVING" as const, no: cell(row, 14), item: cell(row, 15), qty: cell(row, 17), good: cell(row, 18), bad: cell(row, 19) },
      ];

      for (const z of zones) {
        if (!/^\d+$/.test(z.no) || !z.item) {
          continue;
        }
        result.push({
          zone: z.zone,
          rowNo: Number.parseInt(z.no, 10),
          item: z.item,
          quantity: Number.parseInt(z.qty, 10) || 0,
          goodCondition: Number.parseInt(z.good, 10) || 0,
          badCondition: Number.parseInt(z.bad, 10) || 0,
        });
      }
    }

    return result;
  },

  "Equipment Condition"(rows) {
    const result: EquipmentConditionRow[] = [];
    const managements = ["MANAGEMENT", "PROCO", "KYC", "CONTACT CENTER", "WAREHOUSE", "TOTAL"];

    for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const equipmentType = cell(row, 0);
      if (!equipmentType || equipmentType === "COUNT") {
        continue;
      }

      const blocks = [
        { start: 1, label: "MANAGEMENT" },
        { start: 4, label: "PROCO" },
        { start: 7, label: "KYC" },
        { start: 10, label: "CONTACT CENTER" },
        { start: 13, label: "WAREHOUSE" },
        { start: 17, label: "TOTAL" },
      ];

      for (const block of blocks) {
        const count = Number.parseInt(cell(row, block.start), 10);
        const working = Number.parseInt(cell(row, block.start + 1), 10);
        const notWorking = Number.parseInt(cell(row, block.start + 2), 10);
        if (!Number.isFinite(count) && !Number.isFinite(working)) {
          continue;
        }
        result.push({
          equipmentType,
          management: block.label,
          count: Number.isFinite(count) ? count : null,
          working: Number.isFinite(working) ? working : null,
          notWorking: Number.isFinite(notWorking) ? notWorking : null,
        });
      }

      void managements;
    }

    return result;
  },

  Workstations(rows) {
    const result: WorkstationsRow[] = [];

    for (const row of rows) {
      const sides = [
        {
          side: "KYC" as const,
          rank: cell(row, 1) || null,
          workStation: cell(row, 2),
          serialNumber: cleanSerial(cell(row, 3)),
          materiels: cell(row, 4) || null,
          user: cell(row, 5) || null,
          process: cell(row, 6) || null,
          status: cell(row, 7) || null,
        },
        {
          side: "CC" as const,
          rank: cell(row, 10) || null,
          workStation: cell(row, 11),
          serialNumber: cleanSerial(cell(row, 12)),
          materiels: cell(row, 13) || null,
          user: null,
          process: cell(row, 14) || null,
          status: cell(row, 15) || null,
        },
      ];

      for (const side of sides) {
        if (!side.workStation || !/^(KYC|CC)/i.test(side.workStation)) {
          continue;
        }
        result.push({
          ...side,
          workStation: side.workStation.toUpperCase(),
        });
      }
    }

    return result;
  },

  Feuil1(rows) {
    const result: Feuil1Row[] = [];

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const status = cell(row, 0);
      if (!status || status === "STATUS") {
        continue;
      }
      result.push({
        status,
        materiels: cell(row, 1) || null,
        user: cell(row, 2) || null,
        process: cell(row, 3) || null,
      });
    }

    return result;
  },
};

export type WorkstationEntry = {
  code: string;
  serialNumber: string | null;
  material: string | null;
  custodianName: string | null;
  processLabel: string | null;
  statusLabel: string | null;
  side: "KYC" | "CC";
};

export function workstationsToEntries(rows: WorkstationsRow[]): WorkstationEntry[] {
  return rows.map((row) => ({
    code: row.workStation,
    serialNumber: row.serialNumber,
    material: row.materiels,
    custodianName: row.user,
    processLabel: row.process,
    statusLabel: row.status,
    side: row.side,
  }));
}

export type KycImportRow = {
  assetGroup: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  systemOs: string | null;
  storageRam: string | null;
  locationName: string | null;
  ownerLabel: string | null;
  custodianName: string | null;
  purchaseValue: string | null;
  purchaseDate: Date | null;
  description: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  quantityOnHand: number;
  unit: string;
  brand: string | null;
  workstationCode: string | null;
  processLabel: string | null;
  sku: string;
};

export function inferCategory(description: string, group: string) {
  const text = `${group} ${description}`.toUpperCase();
  if (text.includes("LAPTOP") || text.includes("NOTEBOOK")) return "Laptop";
  if (text.includes("DESKTOP") || text.includes("CPU") || text.includes("TOWER"))
    return "Desktop";
  if (text.includes("HEADSET") || text.includes("MOUSE") || text.includes("KEYBOARD"))
    return "Accessoire";
  if (text.includes("MONITOR")) return "Ecran";
  if (text.includes("PRINTER") || text.includes("LASER") || text.includes("DESKJET"))
    return "Imprimante";
  if (text.includes("SCANNER")) return "Scanner";
  if (
    text.includes("SWITCH") ||
    text.includes("FIREWALL") ||
    text.includes("FORTINET") ||
    text.includes("ROUTER") ||
    text.includes("MODEM") ||
    text.includes("MVR")
  )
    return "Reseau";
  if (text.includes("SERVER") || text.includes("NVR") || text.includes("RACK"))
    return "Serveur";
  if (text.includes("CHAIR") || text.includes("TABLE") || text.includes("DESK"))
    return "Mobilier";
  if (text.includes("VEHICLE") || text.includes("TOYOTA") || text.includes("VEHICULE"))
    return "Vehicule";
  if (text.includes("CAMERA") || text.includes("DOME")) return "Video";
  if (text.includes("BLOWER") || text.includes("DRILL") || text.includes("GRINDER"))
    return "Outillage";
  return "Autre";
}

function procoRowsToAssets(rows: ProcoKycCallItEquipementRow[]): KycImportRow[] {
  return rows.map((row, index) => {
    const groupKey =
      row.section.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase() || "MAIN";
    const mapped = mapStatus(row.statusLabel ?? "Good", row.designatedCustodian);
    const descriptionParts = [row.lossImplication, row.riskSecurity].filter(Boolean);

    return {
      assetGroup: row.section,
      name: row.description,
      model: row.model,
      serialNumber: row.serialNumber,
      systemOs: row.systemLabel,
      storageRam: row.hddRam,
      locationName: row.location,
      ownerLabel: row.owner,
      custodianName: row.designatedCustodian,
      purchaseValue: row.relativeValue,
      purchaseDate: row.purchaseDate ?? row.acquisitionDate,
      description: descriptionParts.length ? descriptionParts.join(" · ") : null,
      condition: mapped.condition,
      status: mapped.status,
      quantityOnHand: 1,
      unit: "unite",
      brand: inferBrand(row.description),
      workstationCode: null,
      processLabel: null,
      sku: `KYC-${groupKey}-${String(index + 1).padStart(4, "0")}`,
    };
  });
}

function inStoreRowsToAssets(rows: InStoreRow[]): KycImportRow[] {
  return rows.map((row, index) => {
    const mapped = mapStatus(row.condition ?? "Good", null);
    return {
      assetGroup: "IN STORE",
      name: row.item,
      model: row.vendor,
      serialNumber: null,
      systemOs: null,
      storageRam: null,
      locationName: "Mandala Square",
      ownerLabel: "Stock IT",
      custodianName: null,
      purchaseValue: null,
      purchaseDate: null,
      description: row.vendor ? `Fournisseur: ${row.vendor}` : null,
      condition: mapped.condition,
      status: AssetStatus.AVAILABLE,
      quantityOnHand: row.number,
      unit: "piece",
      brand: row.vendor,
      workstationCode: null,
      processLabel: null,
      sku: `STO-${String(index + 1).padStart(4, "0")}`,
    };
  });
}

function otherAssetsRowsToAssets(rows: OtherAssetsRow[]): KycImportRow[] {
  return rows.map((row, index) => {
    const isVehicle = /vehicule/i.test(row.section);
    const name = isVehicle
      ? `Vehicule ${row.brand ?? ""} ${row.model ?? ""}`.trim()
      : (row.brand ?? row.model ?? "Autre");
    const mapped = mapStatus(row.condition ?? "Good", null);

    return {
      assetGroup: row.section,
      name,
      model: isVehicle ? row.model : null,
      serialNumber: row.vinOrSerial,
      systemOs: null,
      storageRam: null,
      locationName: row.location,
      ownerLabel: "Administration",
      custodianName: null,
      purchaseValue: null,
      purchaseDate: null,
      description: row.licensePlate ? `Plaque: ${row.licensePlate}` : null,
      condition: mapped.condition,
      status: mapped.status,
      quantityOnHand: row.quantity,
      unit: isVehicle ? "unite" : "piece",
      brand: inferBrand(name),
      workstationCode: null,
      processLabel: null,
      sku: `OTH-${String(index + 1).padStart(4, "0")}`,
    };
  });
}

export function applyWorkstations(items: KycImportRow[], entries: WorkstationEntry[]) {
  const bySerial = new Map<string, WorkstationEntry[]>();
  for (const entry of entries) {
    if (entry.serialNumber) {
      const key = serialKey(entry.serialNumber);
      const list = bySerial.get(key) ?? [];
      list.push(entry);
      bySerial.set(key, list);
    }
  }

  const knownSerials = new Set<string>();

  for (const item of items) {
    if (item.serialNumber) {
      const key = serialKey(item.serialNumber);
      knownSerials.add(key);
      const matches = bySerial.get(key) ?? [];
      const match =
        matches.find((entry) => entry.side === "KYC") ?? matches[0] ?? null;
      if (match) {
        item.workstationCode = match.code;
        item.processLabel = match.processLabel ?? item.processLabel;
        if (match.custodianName && !item.custodianName) {
          item.custodianName = match.custodianName;
        }
        if (item.custodianName && item.status === AssetStatus.AVAILABLE) {
          item.status = AssetStatus.ASSIGNED;
        }
      }
    }
  }

  let wsCounter = 0;
  const usedCodes = new Set(
    items.map((item) => item.workstationCode).filter(Boolean) as string[],
  );

  for (const entry of entries) {
    if (entry.serialNumber) {
      const key = serialKey(entry.serialNumber);
      if (knownSerials.has(key)) {
        continue;
      }
      knownSerials.add(key);
      usedCodes.add(entry.code);
      wsCounter += 1;
      const mapped = mapStatus(entry.statusLabel ?? "Good", entry.custodianName);
      items.push({
        assetGroup: `WORKSTATIONS ${entry.side}`,
        name: entry.material ?? `Poste ${entry.code}`,
        model: entry.material,
        serialNumber: entry.serialNumber,
        systemOs: null,
        storageRam: null,
        locationName: "Mandala Square",
        ownerLabel: entry.side === "KYC" ? "Backoffice" : "Call Center",
        custodianName: entry.custodianName,
        purchaseValue: null,
        purchaseDate: null,
        description: `Import poste ${entry.side}`,
        condition: mapped.condition,
        status: mapped.status,
        quantityOnHand: 1,
        unit: "unite",
        brand: null,
        workstationCode: entry.code,
        processLabel: entry.processLabel,
        sku: `WS-${entry.side}-${String(wsCounter).padStart(4, "0")}`,
      });
      continue;
    }

    if (usedCodes.has(entry.code)) {
      continue;
    }

    usedCodes.add(entry.code);
    wsCounter += 1;
    const mapped = mapStatus(entry.statusLabel ?? "Good", entry.custodianName);
    items.push({
      assetGroup: `WORKSTATIONS ${entry.side}`,
      name: entry.material ?? `Poste ${entry.code}`,
      model: entry.material,
      serialNumber: null,
      systemOs: null,
      storageRam: null,
      locationName: "Mandala Square",
      ownerLabel: entry.side === "KYC" ? "Backoffice" : "Call Center",
      custodianName: entry.custodianName,
      purchaseValue: null,
      purchaseDate: null,
      description: `Import poste ${entry.side} (sans serie)`,
      condition: mapped.condition,
      status: mapped.status,
      quantityOnHand: 1,
      unit: "unite",
      brand: null,
      workstationCode: entry.code,
      processLabel: entry.processLabel,
      sku: `WS-${entry.side}-${String(wsCounter).padStart(4, "0")}`,
    });
  }
}

export function projectSheetsToAssets(parsed: KycSheetParseResults): KycImportRow[] {
  const items = [
    ...procoRowsToAssets(parsed["PROCO KYC & CALL IT EQUIPEMENT"]),
    ...inStoreRowsToAssets(parsed["IN STORE"]),
    ...otherAssetsRowsToAssets(parsed["Other Assets"]),
  ];
  applyWorkstations(items, workstationsToEntries(parsed.Workstations));
  return items;
}

export function parseAllKycSheets(
  sheets: Record<KycExcelSheetName, unknown[][]>,
): KycSheetParseResults {
  return {
    "PROCO KYC & CALL IT EQUIPEMENT": kycSheetParsers["PROCO KYC & CALL IT EQUIPEMENT"](
      sheets["PROCO KYC & CALL IT EQUIPEMENT"] ?? [],
    ),
    "IN STORE": kycSheetParsers["IN STORE"](sheets["IN STORE"] ?? []),
    "Dispostion KYC": kycSheetParsers["Dispostion KYC"](sheets["Dispostion KYC"] ?? []),
    "Other Assets": kycSheetParsers["Other Assets"](sheets["Other Assets"] ?? []),
    "PURCHASE & DELIVERED": kycSheetParsers["PURCHASE & DELIVERED"](
      sheets["PURCHASE & DELIVERED"] ?? [],
    ),
    "MATERIAL ACCOUNTS": kycSheetParsers["MATERIAL ACCOUNTS"](
      sheets["MATERIAL ACCOUNTS"] ?? [],
    ),
    "Equipment Condition": kycSheetParsers["Equipment Condition"](
      sheets["Equipment Condition"] ?? [],
    ),
    Workstations: kycSheetParsers.Workstations(sheets.Workstations ?? []),
    Feuil1: kycSheetParsers.Feuil1(sheets.Feuil1 ?? []),
  };
}

export { inferBrand, isOtherAssetsSection, isSectionHeaderRow as isSectionHeader };
