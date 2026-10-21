// @vitest-environment node
import { describe, expect, it } from "vitest";

import { allocateAssetCode, formatAssetCode, parseAssetCode } from "@/lib/catalog/asset-code";
import { StockRuleError } from "@/lib/stock/errors";

import { assetType, createFakeStockDb } from "../helpers/fake-stock-db";

describe("Format du code materiel", () => {
  it.each([
    ["MS", 1, "MS-0001"],
    ["LAP", 42, "LAP-0042"],
    ["DSK", 9999, "DSK-9999"],
    ["DSK", 10000, "DSK-10000"],
  ])("%s + %i -> %s", (prefix, number, code) => {
    expect(formatAssetCode(prefix, number)).toBe(code);
  });

  it.each([
    ["ms", 1],
    ["M", 1],
    ["MS", 0],
    ["MS", -3],
    ["MS", 1.5],
  ])("refuse un prefixe ou un numero invalide (%s, %s)", (prefix, number) => {
    expect(() => formatAssetCode(prefix, number)).toThrow();
  });

  it("relit un code", () => {
    expect(parseAssetCode("MS-0042")).toEqual({ prefix: "MS", number: 42 });
    expect(parseAssetCode("DSK-10000")).toEqual({ prefix: "DSK", number: 10000 });
  });

  it.each(["KYC-ITEQUI-0046", "MS0042", "ms-0001", "MS-12", ""])("ne reconnait pas %s comme un code", (value) => {
    expect(parseAssetCode(value)).toBeNull();
  });
});

describe("Attribution d'un code", () => {
  it("attribue le numero suivant du type et avance le compteur", async () => {
    const db = createFakeStockDb({ assetType: [assetType({ id: "type-ms", prefix: "MS", nextNumber: 3 })] });

    expect(await allocateAssetCode(db as never, "type-ms")).toBe("MS-0003");
    expect(await allocateAssetCode(db as never, "type-ms")).toBe("MS-0004");
    expect(db.row("assetType", "type-ms")?.nextNumber).toBe(5);
  });

  it("chaque type a son propre compteur", async () => {
    const db = createFakeStockDb({
      assetType: [assetType(), assetType({ id: "type-ms", prefix: "MS", nextNumber: 1 })],
    });

    expect(await allocateAssetCode(db as never, "type-lap")).toBe("LAP-0001");
    expect(await allocateAssetCode(db as never, "type-ms")).toBe("MS-0001");
    expect(await allocateAssetCode(db as never, "type-lap")).toBe("LAP-0002");
  });

  it("CONCURRENCE : 5 creations simultanees obtiennent 5 codes distincts", async () => {
    const db = createFakeStockDb({ assetType: [assetType({ id: "type-ms", prefix: "MS", nextNumber: 1 })] });

    const codes = await Promise.all(Array.from({ length: 5 }, () => allocateAssetCode(db as never, "type-ms")));

    expect(new Set(codes).size).toBe(5);
    expect([...codes].sort()).toEqual(["MS-0001", "MS-0002", "MS-0003", "MS-0004", "MS-0005"]);
    expect(db.row("assetType", "type-ms")?.nextNumber).toBe(6);
  });

  it("refuse un type inconnu ou desactive", async () => {
    const db = createFakeStockDb({ assetType: [assetType({ active: false })] });

    await expect(allocateAssetCode(db as never, "ghost")).rejects.toBeInstanceOf(StockRuleError);
    await expect(allocateAssetCode(db as never, "type-lap")).rejects.toThrow(/type/i);
    expect(db.row("assetType", "type-lap")?.nextNumber).toBe(1);
  });
});
