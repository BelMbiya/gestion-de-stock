import { describe, expect, it } from "vitest";

import { serializeAsset } from "@/lib/stock-serializer";

const base = {
  id: "a1",
  sku: "SW-0001",
  importRef: "KYC-ARCHIV-0350",
  type: { id: "type-sw", prefix: "SW", name: "Switch" },
  barcode: "EAN-001",
  serialNumber: "SN-1",
  name: "Routeur",
  description: null,
  brand: "Cisco",
  model: "4331",
  imageUrl: "https://example.com/router.png",
  systemOs: null,
  storageRam: null,
  ownerLabel: null,
  custodianName: "AGENTS",
  workstationCode: null,
  processLabel: null,
  assetGroup: null,
  condition: "GOOD",
  status: "ASSIGNED",
  trackingMode: "SERIALIZED" as const,
  unit: "unite",
  quantityOnHand: 1,
  minQuantity: 0,
  purchaseValue: { toString: () => "1000" },
  purchaseDate: null,
  warrantyUntil: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
  category: { id: "c1", name: "Network" },
  location: { id: "l1", name: "HQ" },
  supplier: { id: "s1", name: "PROCO", code: "P1" },
  assignments: [
    { id: "asg-1", kind: "DOTATION", expectedReturnAt: null, holder: { id: "h1", fullName: "Jean MUKENDI" } },
  ],
  incidents: [{ reference: "INC-001" }],
};

describe("stock-serializer", () => {
  it("materiel unitaire : detenteur de l'affectation active, aucun niveau de stock", () => {
    const serialized = serializeAsset(base);

    expect(serialized).toMatchObject({
      sku: "SW-0001",
      importRef: "KYC-ARCHIV-0350",
      typeId: "type-sw",
      type: "Switch",
      typePrefix: "SW",
      trackingMode: "SERIALIZED",
      trackingModeLabel: "Unitaire",
      stockStatus: "NONE",
      assignedTo: "Jean MUKENDI",
      holderId: "h1",
      activeAssignmentId: "asg-1",
      status: "Affecte",
      openIncident: "INC-001",
      supplier: "PROCO",
      value: "$1000",
      imageUrl: "https://example.com/router.png",
    });
  });

  it("le nom importe de l'Excel n'est plus pris pour le detenteur : sans affectation, « En stock »", () => {
    expect(serializeAsset({ ...base, status: "AVAILABLE", assignments: [] }).assignedTo).toBe("En stock");
  });

  it("article en vrac sous son seuil : stock bas", () => {
    const serialized = serializeAsset({
      ...base,
      trackingMode: "BULK",
      quantityOnHand: 8,
      minQuantity: 10,
      status: "AVAILABLE",
      assignments: [],
    });

    expect(serialized).toMatchObject({ stockStatus: "LOW", stockStatusLabel: "Stock bas", trackingModeLabel: "En vrac" });
  });
});
