// @vitest-environment node
import { describe, expect, it } from "vitest";

import { StockRuleError } from "@/lib/stock/errors";
import { planMovement } from "@/lib/stock/movement-rules";

const bulk = { trackingMode: "BULK" as const, quantityOnHand: 129, locationId: "loc-mandala" };
const unit = { trackingMode: "SERIALIZED" as const, quantityOnHand: 1, locationId: "loc-mandala" };

function rejects(asset: Parameters<typeof planMovement>[0], input: Parameters<typeof planMovement>[1]) {
  let error: unknown;
  try {
    planMovement(asset, input);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(StockRuleError);
  return (error as StockRuleError).message;
}

describe("S4 — type de mouvement obligatoire", () => {
  it("REGRESSION : un mouvement sans type est refuse (avant : ajustement a 1)", () => {
    expect(rejects(bulk, { quantity: 1 })).toMatch(/type/i);
  });

  it("refuse un type inconnu", () => {
    expect(rejects(bulk, { type: "STEAL", quantity: 1 })).toMatch(/type/i);
  });
});

describe("S4 — articles en vrac", () => {
  it("sortie de 2 souris : 129 -> 127", () => {
    expect(planMovement(bulk, { type: "OUT", quantity: 2 })).toMatchObject({
      type: "OUT",
      change: -2,
      nextQuantity: 127,
    });
  });

  it("entree et retour augmentent le stock", () => {
    expect(planMovement(bulk, { type: "IN", quantity: 5 })).toMatchObject({ change: 5, nextQuantity: 134 });
    expect(planMovement(bulk, { type: "RETURN", quantity: 1 })).toMatchObject({ change: 1, nextQuantity: 130 });
  });

  it("refuse une sortie superieure au stock", () => {
    expect(rejects(bulk, { type: "OUT", quantity: 130 })).toMatch(/stock insuffisant/i);
  });

  it.each([0, -3, 2.5, Number.NaN, "abc"])("refuse une quantite invalide (%s)", (quantity) => {
    expect(rejects(bulk, { type: "OUT", quantity })).toMatch(/quantite/i);
  });

  it("une sortie jusqu'a 0 est permise (rupture, pas reforme)", () => {
    expect(planMovement({ ...bulk, quantityOnHand: 3 }, { type: "OUT", quantity: 3 })).toMatchObject({
      nextQuantity: 0,
    });
  });

  it("l'ajustement est un ecart signe avec motif obligatoire", () => {
    expect(rejects(bulk, { type: "ADJUSTMENT", delta: -2 })).toMatch(/motif/i);
    expect(rejects(bulk, { type: "ADJUSTMENT", delta: -2, reason: "   " })).toMatch(/motif/i);
    expect(
      planMovement(bulk, { type: "ADJUSTMENT", delta: -2, reason: "Recomptage" }),
    ).toMatchObject({ change: -2, nextQuantity: 127, reason: "Recomptage" });
    expect(
      planMovement(bulk, { type: "ADJUSTMENT", delta: 3, reason: "Oubli de saisie" }),
    ).toMatchObject({ change: 3, nextQuantity: 132 });
  });

  it("refuse un ajustement nul ou qui passerait sous 0", () => {
    expect(rejects(bulk, { type: "ADJUSTMENT", delta: 0, reason: "x" })).toMatch(/ecart/i);
    expect(rejects(bulk, { type: "ADJUSTMENT", delta: -130, reason: "x" })).toMatch(/sous 0|negatif/i);
  });

  it("le transfert deplace la ligne entiere vers un autre site", () => {
    expect(
      planMovement(bulk, { type: "TRANSFER", toLocationId: "loc-ats" }),
    ).toMatchObject({ change: 0, nextQuantity: 129, toLocationId: "loc-ats" });
  });

  it("refuse un transfert partiel (un article en vrac est sur un seul site)", () => {
    expect(rejects(bulk, { type: "TRANSFER", quantity: 20, toLocationId: "loc-ats" })).toMatch(
      /ligne entiere|seul site/i,
    );
  });

  it("refuse un transfert sans destination ou vers le meme site", () => {
    expect(rejects(bulk, { type: "TRANSFER" })).toMatch(/destination/i);
    expect(rejects(bulk, { type: "TRANSFER", toLocationId: "loc-mandala" })).toMatch(/meme site|destination/i);
  });

  it("garde le beneficiaire d'une sortie", () => {
    expect(planMovement(bulk, { type: "OUT", quantity: 2, holderId: "holder-1" })).toMatchObject({
      holderId: "holder-1",
    });
  });

  it("n'accepte un beneficiaire que sur une sortie", () => {
    expect(rejects(bulk, { type: "IN", quantity: 2, holderId: "holder-1" })).toMatch(/beneficiaire/i);
  });
});

describe("S4 — materiel unitaire", () => {
  it.each(["IN", "OUT", "RETURN", "ADJUSTMENT"])(
    "refuse le mouvement %s et indique l'action a utiliser",
    (type) => {
      expect(rejects(unit, { type, quantity: 1, delta: 1, reason: "x" })).toMatch(
        /affectation|retour|changer l'etat/i,
      );
    },
  );

  it("accepte le transfert de site, quantite inchangee", () => {
    expect(planMovement(unit, { type: "TRANSFER", toLocationId: "loc-ats" })).toMatchObject({
      type: "TRANSFER",
      change: 0,
      nextQuantity: 1,
      toLocationId: "loc-ats",
    });
  });
});
