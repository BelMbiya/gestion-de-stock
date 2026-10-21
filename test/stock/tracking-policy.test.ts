// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getTrackingPolicy } from "@/lib/stock/tracking-policy";

describe("S1 — strategie de suivi unitaire (SERIALIZED)", () => {
  const policy = getTrackingPolicy("SERIALIZED");

  it("n'autorise que le transfert de site comme mouvement", () => {
    expect(policy.allowedMovements).toEqual(["TRANSFER"]);
  });

  it("peut etre affecte a un detenteur", () => {
    expect(policy.canAssign).toBe(true);
  });

  it("ne produit jamais de niveau de stock (pas d'alerte sur un laptop)", () => {
    expect(policy.stockLevel({ quantityOnHand: 1, minQuantity: 0 })).toBe("NONE");
    expect(policy.stockLevel({ quantityOnHand: 1, minQuantity: 1 })).toBe("NONE");
    expect(policy.stockLevel({ quantityOnHand: 0, minQuantity: 5 })).toBe("NONE");
  });
});

describe("S1 — strategie de suivi en vrac (BULK)", () => {
  const policy = getTrackingPolicy("BULK");

  it("autorise entree, sortie, retour, ajustement et transfert", () => {
    expect([...policy.allowedMovements].sort()).toEqual(
      ["ADJUSTMENT", "IN", "OUT", "RETURN", "TRANSFER"].sort(),
    );
  });

  it("ne peut pas etre affecte (on fait une sortie de stock)", () => {
    expect(policy.canAssign).toBe(false);
  });

  it.each([
    [0, 0, "OUT"],
    [0, 10, "OUT"],
    [8, 10, "LOW"],
    [10, 10, "LOW"],
    [11, 10, "OK"],
    [1, 0, "OK"],
    [129, 0, "OK"],
  ])("quantite %i avec seuil %i -> %s", (quantityOnHand, minQuantity, expected) => {
    expect(policy.stockLevel({ quantityOnHand, minQuantity })).toBe(expected);
  });
});

describe("S1 — mode inconnu", () => {
  it("refuse un mode non prevu plutot que de deviner", () => {
    expect(() => getTrackingPolicy("WHATEVER" as never)).toThrow(/mode de suivi/i);
  });
});
