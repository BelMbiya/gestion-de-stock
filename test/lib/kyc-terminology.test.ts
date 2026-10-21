import { describe, expect, it } from "vitest";

import {
  filterKycAssets,
  KYC_SHEET_LABELS,
  KYC_NAV,
  KYC_UI,
} from "@/lib/kyc-excel/terminology";

describe("kyc terminology", () => {
  it("utilise DESCRIPTION comme libelle article Excel", () => {
    expect(KYC_UI.DESCRIPTION).toBe("DESCRIPTION");
    expect(KYC_UI.SERIAL_NUMBER).toBe("SERIAL NUMBER");
    expect(KYC_NAV.STOCK).toBe(KYC_SHEET_LABELS.IN_STORE);
    expect(KYC_NAV.INVENTORY).toBe(KYC_SHEET_LABELS.PROCO_KYC_CALL_IT_EQUIPEMENT);
  });

  it("filtre les articles par saisie", () => {
    const assets = [
      { id: "1", sku: "KYC-001", name: "HP LAPTOP I5", serialNumber: "ABC123" },
      { id: "2", sku: "STO-0001", name: "Mouse", serialNumber: null },
    ];

    expect(filterKycAssets(assets, "hp laptop")).toHaveLength(1);
    expect(filterKycAssets(assets, "ABC123")).toHaveLength(1);
    expect(filterKycAssets(assets, "mouse")).toHaveLength(1);
  });
});
