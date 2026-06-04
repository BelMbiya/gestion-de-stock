import { describe, expect, it } from "vitest";

import { serializeAsset } from "@/lib/stock-serializer";

describe("stock-serializer", () => {
  it("serialise un article avec alerte stock et panne ouverte", () => {
    const serialized = serializeAsset({
      id: "a1",
      sku: "IT-001",
      barcode: "EAN-001",
      serialNumber: "SN-1",
      name: "Routeur",
      description: null,
      brand: "Cisco",
      model: "4331",
      imageUrl: "https://example.com/router.png",
      condition: "GOOD",
      status: "BROKEN",
      unit: "piece",
      quantityOnHand: 1,
      minQuantity: 2,
      reorderPoint: 3,
      maxQuantity: null,
      purchaseValue: { toString: () => "1000" },
      purchaseDate: null,
      warrantyUntil: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-06-01"),
      category: { id: "c1", name: "Network" },
      location: { id: "l1", name: "HQ" },
      supplier: { id: "s1", name: "PROCO", code: "P1" },
      assignments: [
        {
          assignedTo: { name: "Jean" },
          department: null,
        },
      ],
      incidents: [{ reference: "INC-001" }],
    });

    expect(serialized.stockStatus).toBe("LOW");
    expect(serialized.openIncident).toBe("INC-001");
    expect(serialized.assignedTo).toBe("Jean");
    expect(serialized.supplier).toBe("PROCO");
    expect(serialized.value).toBe("$1000");
    expect(serialized.imageUrl).toBe("https://example.com/router.png");
  });
});
