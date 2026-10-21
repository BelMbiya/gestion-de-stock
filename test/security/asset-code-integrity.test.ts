// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assertEditableFields } from "@/lib/stock/asset-state";
import { StockRuleError } from "@/lib/stock/errors";

const root = path.resolve(__dirname, "../..");
const source = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("Garde-fou : le code materiel est genere par le serveur et definitif", () => {
  it("la creation ne lit jamais un code envoye par le client", () => {
    expect(source("app/api/stock/route.ts")).not.toMatch(/body\.sku\b/);
  });

  it("ATTAQUE : la fiche refuse une modification du code", () => {
    expect(() => assertEditableFields({ sku: "LAP-9999" })).toThrow(StockRuleError);
    expect(() => assertEditableFields({ sku: "LAP-9999" })).toThrow(/code/i);
  });

  it("ATTAQUE : la fiche refuse un changement de type direct (passer par la correction tracee)", () => {
    expect(() => assertEditableFields({ typeId: "type-dsk" })).toThrow(/type/i);
  });

  it("la correction de type passe par une route dediee et tracee", () => {
    const route = "app/api/stock/[id]/type/route.ts";
    expect(existsSync(path.join(root, route))).toBe(true);
    expect(source(route)).toMatch(/changeAssetType\(/);
  });
});
