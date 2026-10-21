// @vitest-environment node
import { describe, expect, it } from "vitest";

import { changeAssetType, createAsset } from "@/lib/catalog/asset-service";
import { AssetNotFoundError, StockRuleError } from "@/lib/stock/errors";

import { assetType, createFakeStockDb, laptop } from "../helpers/fake-stock-db";

const ACTOR = "user-tech-a";

const types = () => [
  assetType({ id: "type-lap", prefix: "LAP", name: "Laptop", categoryId: "cat-info", defaultTrackingMode: "SERIALIZED" }),
  assetType({ id: "type-dsk", prefix: "DSK", name: "Ordinateur de bureau", categoryId: "cat-info", defaultTrackingMode: "SERIALIZED", nextNumber: 235 }),
  assetType({ id: "type-ms", prefix: "MS", name: "Souris", categoryId: "cat-peri", defaultTrackingMode: "BULK" }),
];

async function rule(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(StockRuleError);
  return (error as StockRuleError).message;
}

describe("Creation d'un article : code genere selon le type", () => {
  it("un laptop recoit LAP-0001, sa categorie suit le type, suivi unitaire par defaut", async () => {
    const db = createFakeStockDb({ assetType: types() });

    const asset = await createAsset(db as never, { typeId: "type-lap", name: "HP ProBook 450", serialNumber: "5CD123" }, ACTOR);

    expect(asset).toMatchObject({
      sku: "LAP-0001",
      typeId: "type-lap",
      categoryId: "cat-info",
      trackingMode: "SERIALIZED",
      quantityOnHand: 1,
      status: "AVAILABLE",
      importRef: null,
      createdById: ACTOR,
    });
    expect(db.tables.auditLog[0]).toMatchObject({ action: "CREATE", actorId: ACTOR });
  });

  it("les compteurs avancent par type", async () => {
    const db = createFakeStockDb({ assetType: types() });

    await createAsset(db as never, { typeId: "type-lap", name: "Laptop A" }, ACTOR);
    const second = await createAsset(db as never, { typeId: "type-lap", name: "Laptop B" }, ACTOR);
    const mouse = await createAsset(db as never, { typeId: "type-ms", name: "Souris Logitech", quantityOnHand: 10 }, ACTOR);

    expect(second.sku).toBe("LAP-0002");
    expect(mouse.sku).toBe("MS-0001");
  });

  it("ATTAQUE : un code impose par le client est ignore", async () => {
    const db = createFakeStockDb({ assetType: types() });

    const asset = await createAsset(db as never, { typeId: "type-lap", name: "Laptop", sku: "LAP-9999" } as never, ACTOR);

    expect(asset.sku).toBe("LAP-0001");
  });

  it("un article en vrac garde sa quantite initiale, tracee par une entree de stock", async () => {
    const db = createFakeStockDb({ assetType: types() });

    const asset = await createAsset(
      db as never,
      { typeId: "type-ms", name: "Souris Logitech", quantityOnHand: 25, minQuantity: 5 },
      ACTOR,
    );

    expect(asset).toMatchObject({ trackingMode: "BULK", quantityOnHand: 25, minQuantity: 5 });
    expect(db.tables.stockMovement[0]).toMatchObject({ type: "IN", quantity: 25, performedById: ACTOR });
  });

  it("refuse un type inconnu ou une description vide sans consommer de numero", async () => {
    const db = createFakeStockDb({ assetType: types() });

    expect(await rule(createAsset(db as never, { typeId: "ghost", name: "X" }, ACTOR))).toMatch(/type/i);
    expect(await rule(createAsset(db as never, { typeId: "type-lap", name: "  " }, ACTOR))).toMatch(/description/i);
    expect(db.row("assetType", "type-lap")?.nextNumber).toBe(1);
    expect(db.tables.asset).toHaveLength(0);
  });
});

describe("Correction du type : nouveau code, ancien conserve dans l'historique", () => {
  const seed = () =>
    createFakeStockDb({
      assetType: types().map((type) => (type.id === "type-lap" ? { ...type, nextNumber: 2 } : type)),
      asset: [laptop({ id: "asset-1", sku: "LAP-0001", typeId: "type-lap", categoryId: "cat-info", importRef: "KYC-ITEQUI-0001" })],
    });

  it("attribue un code du nouveau type et trace l'ancien", async () => {
    const db = seed();

    const asset = await changeAssetType(db as never, { assetId: "asset-1", typeId: "type-dsk", reason: "Saisi comme laptop par erreur", actorId: ACTOR });

    expect(asset).toMatchObject({ sku: "DSK-0235", typeId: "type-dsk", importRef: "KYC-ITEQUI-0001", trackingMode: "SERIALIZED" });
    expect(JSON.stringify(db.tables.auditLog[0])).toMatch(/LAP-0001/);
    expect(db.tables.auditLog[0]).toMatchObject({ actorId: ACTOR, assetId: "asset-1" });
  });

  it("un numero libere n'est jamais reattribue", async () => {
    const db = seed();

    await changeAssetType(db as never, { assetId: "asset-1", typeId: "type-dsk", reason: "Erreur", actorId: ACTOR });
    const next = await createAsset(db as never, { typeId: "type-lap", name: "Nouveau laptop" }, ACTOR);

    expect(next.sku).toBe("LAP-0002");
  });

  it("exige un motif, un type different et un article existant", async () => {
    const db = seed();

    expect(await rule(changeAssetType(db as never, { assetId: "asset-1", typeId: "type-dsk", reason: " ", actorId: ACTOR }))).toMatch(/motif/i);
    expect(await rule(changeAssetType(db as never, { assetId: "asset-1", typeId: "type-lap", reason: "x", actorId: ACTOR }))).toMatch(/deja/i);
    await expect(
      changeAssetType(db as never, { assetId: "ghost", typeId: "type-dsk", reason: "x", actorId: ACTOR }),
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    expect(db.row("asset", "asset-1")?.sku).toBe("LAP-0001");
  });
});
