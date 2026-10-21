import { describe, expect, it } from "vitest";

import { conditionLabels, normalizeAssetCondition } from "@/lib/stock-management";

describe("stock-management", () => {
  it("normalise la condition du materiel", () => {
    expect(normalizeAssetCondition("NEW")).toBe("NEW");
    expect(normalizeAssetCondition("DAMAGED")).toBe("DAMAGED");
    expect(normalizeAssetCondition("invalid")).toBe("GOOD");
  });

  it("expose les libelles francais des conditions", () => {
    expect(conditionLabels.GOOD).toBe("Bon etat");
    expect(conditionLabels.DAMAGED).toBe("Endommage");
  });
});
