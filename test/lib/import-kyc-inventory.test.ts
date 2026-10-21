import { describe, expect, it } from "vitest";

import {
  KYC_EXCEL_SHEET_NAMES,
  kycSheetParsers,
  loadKycInventoryFromExcel,
  parseAllKycSheets,
  loadKycWorkbookRows,
} from "@/lib/import-kyc-inventory";

describe("import-kyc-inventory", () => {
  it("expose un parseur pour chaque feuille Excel", () => {
    for (const sheetName of KYC_EXCEL_SHEET_NAMES) {
      expect(typeof kycSheetParsers[sheetName]).toBe("function");
    }
  });

  it("parse toutes les feuilles du classeur KYC", () => {
    const parsed = parseAllKycSheets(loadKycWorkbookRows());
    expect(parsed["PROCO KYC & CALL IT EQUIPEMENT"].length).toBeGreaterThan(300);
    expect(parsed["IN STORE"].length).toBeGreaterThan(10);
    expect(parsed["Other Assets"].length).toBeGreaterThan(10);
    expect(parsed.Workstations.length).toBeGreaterThan(150);
    expect(parsed["MATERIAL ACCOUNTS"].length).toBeGreaterThan(10);
    expect(parsed["Equipment Condition"].length).toBeGreaterThan(10);
    expect(parsed.Feuil1.length).toBeGreaterThanOrEqual(3);
  });

  it("charge les actifs depuis le fichier Excel KYC", () => {
    const items = loadKycInventoryFromExcel();

    expect(items.length).toBeGreaterThan(400);
    expect(items.some((item) => item.assetGroup.includes("OTHER"))).toBe(true);
    expect(items.some((item) => item.assetGroup.includes("WORKSTATIONS"))).toBe(
      true,
    );
    expect(items.some((item) => item.name.includes("HP LAPTOP"))).toBe(true);
    expect(items.some((item) => item.workstationCode?.startsWith("KYC"))).toBe(
      true,
    );
    expect(items.some((item) => item.workstationCode?.startsWith("CC"))).toBe(
      true,
    );
    expect(items.filter((item) => item.workstationCode).length).toBeGreaterThan(
      150,
    );
    for (const item of items) {
      if (!item.purchaseDate) {
        continue;
      }
      const year = item.purchaseDate.getFullYear();
      expect(year).toBeGreaterThan(1990);
      expect(year).toBeLessThan(2100);
    }
    expect(items.some((item) => item.quantityOnHand > 1)).toBe(true);
  });
});
