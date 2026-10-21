// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AssetNotFoundError, StockConflictError, StockRuleError } from "@/lib/stock/errors";
import { recordStockMovement } from "@/lib/stock/movement-service";

import { createFakeStockDb, laptop, mice, person } from "../helpers/fake-stock-db";

const ACTOR = "user-tech-a";

describe("S4 — service de mouvements", () => {
  it("sortie de 2 souris pour un beneficiaire, auteur = utilisateur connecte", async () => {
    const db = createFakeStockDb({ asset: [mice()], holder: [person({ fullName: "HUGUETTE LEPELE", id: "h-hug" })] });

    const result = await recordStockMovement(db as never, {
      assetId: "mice-1",
      input: { type: "OUT", quantity: 2, holderId: "h-hug" },
      actorId: ACTOR,
    });

    expect(result.quantityOnHand).toBe(127);
    expect(db.row("asset", "mice-1")?.quantityOnHand).toBe(127);
    expect(db.tables.stockMovement).toHaveLength(1);
    expect(db.tables.stockMovement[0]).toMatchObject({
      assetId: "mice-1",
      type: "OUT",
      quantity: 2,
      holderId: "h-hug",
      performedById: ACTOR,
    });
    expect(db.tables.auditLog[0]).toMatchObject({ actorId: ACTOR, assetId: "mice-1" });
  });

  it("ATTAQUE : un auteur fourni dans la saisie est ignore", async () => {
    const db = createFakeStockDb({ asset: [mice()] });

    await recordStockMovement(db as never, {
      assetId: "mice-1",
      input: { type: "IN", quantity: 1, performedById: "user-b" } as never,
      actorId: ACTOR,
    });

    expect(db.tables.stockMovement[0].performedById).toBe(ACTOR);
  });

  it("REGRESSION : une sortie jusqu'a 0 ne reforme pas l'article", async () => {
    const db = createFakeStockDb({ asset: [mice({ quantityOnHand: 3, name: "CHAIR" })] });

    await recordStockMovement(db as never, {
      assetId: "mice-1",
      input: { type: "OUT", quantity: 3 },
      actorId: ACTOR,
    });

    expect(db.row("asset", "mice-1")).toMatchObject({ quantityOnHand: 0, status: "AVAILABLE" });
  });

  it("enregistre l'ajustement comme un ecart signe avec son motif", async () => {
    const db = createFakeStockDb({ asset: [mice()] });

    await recordStockMovement(db as never, {
      assetId: "mice-1",
      input: { type: "ADJUSTMENT", delta: -2, reason: "Recomptage" },
      actorId: ACTOR,
    });

    expect(db.row("asset", "mice-1")?.quantityOnHand).toBe(127);
    expect(db.tables.stockMovement[0]).toMatchObject({ type: "ADJUSTMENT", quantity: -2, reason: "Recomptage" });
  });

  it("transfert d'un laptop : site change, mouvement trace avec origine et destination", async () => {
    const db = createFakeStockDb({ asset: [laptop()] });

    await recordStockMovement(db as never, {
      assetId: "laptop-1",
      input: { type: "TRANSFER", toLocationId: "loc-ats" },
      actorId: ACTOR,
    });

    expect(db.row("asset", "laptop-1")).toMatchObject({ locationId: "loc-ats", quantityOnHand: 1 });
    expect(db.tables.stockMovement[0]).toMatchObject({
      type: "TRANSFER",
      fromLocationId: "loc-mandala",
      toLocationId: "loc-ats",
    });
  });

  it("refuse un mouvement interdit sans rien ecrire", async () => {
    const db = createFakeStockDb({ asset: [laptop()] });

    await expect(
      recordStockMovement(db as never, {
        assetId: "laptop-1",
        input: { type: "OUT", quantity: 1 },
        actorId: ACTOR,
      }),
    ).rejects.toBeInstanceOf(StockRuleError);
    expect(db.tables.stockMovement).toHaveLength(0);
    expect(db.row("asset", "laptop-1")?.quantityOnHand).toBe(1);
  });

  it("refuse un beneficiaire inconnu ou inactif", async () => {
    const db = createFakeStockDb({ asset: [mice()], holder: [person({ id: "h-off", active: false })] });

    for (const holderId of ["h-missing", "h-off"]) {
      await expect(
        recordStockMovement(db as never, {
          assetId: "mice-1",
          input: { type: "OUT", quantity: 1, holderId },
          actorId: ACTOR,
        }),
      ).rejects.toBeInstanceOf(StockRuleError);
    }
    expect(db.row("asset", "mice-1")?.quantityOnHand).toBe(129);
  });

  it("signale un article introuvable (404)", async () => {
    const db = createFakeStockDb();

    const error = await recordStockMovement(db as never, {
      assetId: "ghost",
      input: { type: "IN", quantity: 1 },
      actorId: ACTOR,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AssetNotFoundError);
    expect((error as AssetNotFoundError).status).toBe(404);
  });

  it("CONCURRENCE : deux sorties de 100 sur 129 -> une seule passe, jamais de stock negatif", async () => {
    const db = createFakeStockDb({ asset: [mice()] });
    const exit = () =>
      recordStockMovement(db as never, {
        assetId: "mice-1",
        input: { type: "OUT", quantity: 100 },
        actorId: ACTOR,
      });

    const results = await Promise.allSettled([exit(), exit()]);

    const rejected = results.filter((r) => r.status === "rejected");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(StockConflictError);
    expect(((rejected[0] as PromiseRejectedResult).reason as StockConflictError).status).toBe(409);
    expect(db.row("asset", "mice-1")?.quantityOnHand).toBe(29);
    expect(db.tables.stockMovement).toHaveLength(1);
  });
});
