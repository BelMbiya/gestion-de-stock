// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertAssetDeletable, assertEditableFields, changeAssetState } from "@/lib/stock/asset-state";
import { AssetHasHistoryError, StockRuleError } from "@/lib/stock/errors";

import { createFakeStockDb, laptop, mice, person } from "../helpers/fake-stock-db";

const ACTOR = "user-manager";
const activeAssignment = { id: "asg-1", assetId: "laptop-1", holderId: "holder-papy", status: "ACTIVE", kind: "DOTATION" };

async function rule(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(StockRuleError);
  return (error as StockRuleError).message;
}

describe("S5 — changer l'etat (action tracee)", () => {
  it("passe un laptop disponible en Maintenance avec motif, trace dans le journal", async () => {
    const db = createFakeStockDb({ asset: [laptop()] });

    await changeAssetState(db as never, { assetId: "laptop-1", target: "MAINTENANCE", reason: "Ecran casse", actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.status).toBe("MAINTENANCE");
    expect(db.tables.auditLog[0]).toMatchObject({
      action: "STATUS_CHANGE",
      actorId: ACTOR,
      assetId: "laptop-1",
    });
    expect(JSON.stringify(db.tables.auditLog[0])).toMatch(/Ecran casse/);
  });

  it("exige un motif", async () => {
    const db = createFakeStockDb({ asset: [laptop()] });

    expect(await rule(changeAssetState(db as never, { assetId: "laptop-1", target: "BROKEN", reason: " ", actorId: ACTOR }))).toMatch(
      /motif/i,
    );
    expect(db.row("asset", "laptop-1")?.status).toBe("AVAILABLE");
  });

  it("garde le detenteur d'un laptop affecte envoye en maintenance", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeAssignment],
    });

    await changeAssetState(db as never, { assetId: "laptop-1", target: "MAINTENANCE", reason: "Clavier", actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.status).toBe("MAINTENANCE");
    expect(db.row("assetAssignment", "asg-1")?.status).toBe("ACTIVE");
  });

  it.each(["RETIRED", "LOST"])("refuse %s tant qu'une affectation est active", async (target) => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeAssignment],
    });

    expect(
      await rule(changeAssetState(db as never, { assetId: "laptop-1", target: target as never, reason: "x", actorId: ACTOR })),
    ).toMatch(/recuperez|retour/i);
    expect(db.row("asset", "laptop-1")?.status).toBe("ASSIGNED");
  });

  it("remise en service : Disponible sans detenteur, Affecte s'il en a un", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "MAINTENANCE" }), laptop({ id: "laptop-2", status: "MAINTENANCE" })],
      holder: [person()],
      assetAssignment: [{ ...activeAssignment, assetId: "laptop-2" }],
    });

    await changeAssetState(db as never, { assetId: "laptop-1", target: "IN_SERVICE", reason: "Repare", actorId: ACTOR });
    await changeAssetState(db as never, { assetId: "laptop-2", target: "IN_SERVICE", reason: "Repare", actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.status).toBe("AVAILABLE");
    expect(db.row("asset", "laptop-2")?.status).toBe("ASSIGNED");
  });

  it.each(["ASSIGNED", "AVAILABLE"])("refuse la cible %s (passer par affectation / retour)", async (target) => {
    const db = createFakeStockDb({ asset: [laptop({ status: "MAINTENANCE" })] });

    expect(
      await rule(changeAssetState(db as never, { assetId: "laptop-1", target: target as never, reason: "x", actorId: ACTOR })),
    ).toMatch(/affectation|retour|remise en service/i);
  });
});

describe("S5 — la fiche article ne modifie plus statut, site, quantite ni mode", () => {
  it.each([
    [{ status: "AVAILABLE" }, /changer l'etat|affectation|retour/i],
    [{ locationId: "loc-ats" }, /transfert/i],
    [{ quantityOnHand: 50 }, /mouvement|ajustement/i],
    [{ trackingMode: "BULK" }, /mode de suivi/i],
  ])("ATTAQUE : refuse %o et indique l'action a utiliser", (body, message) => {
    expect(() => assertEditableFields(body)).toThrow(StockRuleError);
    expect(() => assertEditableFields(body)).toThrow(message);
  });

  it("accepte les champs descriptifs", () => {
    expect(() =>
      assertEditableFields({ name: "HP ProBook", model: "450 G8", serialNumber: "5CD123", minQuantity: 10 }),
    ).not.toThrow();
  });
});

describe("S5 — suppression d'un actif", () => {
  it("refuse (409) un actif qui a un historique", async () => {
    const db = createFakeStockDb({
      asset: [mice()],
      stockMovement: [{ id: "mv-1", assetId: "mice-1", type: "IN", quantity: 1 }],
    });

    const error = await assertAssetDeletable(db as never, "mice-1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AssetHasHistoryError);
    expect((error as AssetHasHistoryError).status).toBe(409);
    expect((error as AssetHasHistoryError).message).toMatch(/historique/i);
  });

  it.each([
    ["assetAssignment", { id: "a", assetId: "laptop-1", status: "RETURNED" }],
    ["incident", { id: "i", assetId: "laptop-1" }],
    ["inventoryCheck", { id: "c", assetId: "laptop-1" }],
    ["supportTicket", { id: "t", assetId: "laptop-1" }],
    ["auditLog", { id: "l", assetId: "laptop-1" }],
  ])("tient compte de l'historique %s", async (model, row) => {
    const db = createFakeStockDb({ asset: [laptop()], [model]: [row] });

    await expect(assertAssetDeletable(db as never, "laptop-1")).rejects.toBeInstanceOf(AssetHasHistoryError);
  });

  it("autorise la suppression d'une saisie erronee sans historique", async () => {
    const db = createFakeStockDb({ asset: [laptop()] });

    await expect(assertAssetDeletable(db as never, "laptop-1")).resolves.toBeUndefined();
  });
});
