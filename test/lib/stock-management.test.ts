import { describe, expect, it } from "vitest";

import {
  computeQuantityAfterMovement,
  getStockLevelLabel,
  getStockLevelStatus,
  normalizeAssetCondition,
  normalizeAssetStatus,
  normalizeMovementType,
} from "@/lib/stock-management";

describe("stock-management", () => {
  it("calcule les niveaux de stock", () => {
    expect(getStockLevelStatus(0, 2, 1, 10)).toBe("OUT");
    expect(getStockLevelStatus(2, 3, 2, 10)).toBe("LOW");
    expect(getStockLevelStatus(15, 3, 2, 10)).toBe("OVER");
    expect(getStockLevelStatus(8, 3, 2, 10)).toBe("OK");
  });

  it("retourne les libelles de niveau", () => {
    expect(getStockLevelLabel("OUT")).toBe("Rupture");
    expect(getStockLevelLabel("LOW")).toBe("Stock bas");
    expect(getStockLevelLabel("OK")).toBe("OK");
  });

  it("normalise statut, condition et type de mouvement", () => {
    expect(normalizeAssetStatus("BROKEN")).toBe("BROKEN");
    expect(normalizeAssetStatus("invalid")).toBe("AVAILABLE");
    expect(normalizeAssetCondition("NEW")).toBe("NEW");
    expect(normalizeMovementType("OUT")).toBe("OUT");
    expect(normalizeMovementType("unknown")).toBe("ADJUSTMENT");
  });

  it("calcule la quantite apres chaque type de mouvement", () => {
    expect(computeQuantityAfterMovement(10, "IN", 3)).toBe(13);
    expect(computeQuantityAfterMovement(10, "OUT", 4)).toBe(6);
    expect(computeQuantityAfterMovement(10, "OUT", 20)).toBe(0);
    expect(computeQuantityAfterMovement(10, "RETURN", 2)).toBe(12);
    expect(computeQuantityAfterMovement(10, "ADJUSTMENT", 5)).toBe(5);
    expect(computeQuantityAfterMovement(10, "TRANSFER", 3)).toBe(10);
  });
});
