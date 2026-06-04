import { describe, expect, it } from "vitest";

import {
  resolveAssetStatusAfterMovement,
  validateStockMovement,
} from "@/lib/apply-stock-movement";

describe("apply-stock-movement", () => {
  it("refuse une sortie superieure au stock", () => {
    expect(validateStockMovement("OUT", 5, 6)).toMatch(/insuffisant/i);
    expect(validateStockMovement("OUT", 5, 5)).toBeNull();
  });

  it("exige une destination pour les transferts", () => {
    expect(validateStockMovement("TRANSFER", 10, 1, null)).toMatch(/destination/i);
    expect(validateStockMovement("TRANSFER", 10, 1, "loc-2")).toBeNull();
  });

  it("autorise un ajustement a zero", () => {
    expect(validateStockMovement("ADJUSTMENT", 10, 0)).toBeNull();
    expect(validateStockMovement("ADJUSTMENT", 10, -1)).toMatch(/negative/i);
  });

  it("met en retraite apres rupture et reactive au retour", () => {
    expect(resolveAssetStatusAfterMovement("AVAILABLE", "OUT", 0)).toBe("RETIRED");
    expect(resolveAssetStatusAfterMovement("RETIRED", "IN", 2)).toBe("AVAILABLE");
    expect(resolveAssetStatusAfterMovement("ASSIGNED", "IN", 2)).toBeUndefined();
  });
});
