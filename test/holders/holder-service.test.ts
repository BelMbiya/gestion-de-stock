// @vitest-environment node
import { describe, expect, it } from "vitest";

import { HolderHasHistoryError, HolderRuleError } from "@/lib/holders/errors";
import {
  createHolder,
  deleteHolder,
  holderFlags,
  setHolderActive,
  updateHolder,
} from "@/lib/holders/holder-service";

import { createFakeStockDb, person } from "../helpers/fake-stock-db";

async function rule(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HolderRuleError);
  return (error as HolderRuleError).message;
}

describe("S2 — creer et modifier un detenteur", () => {
  it("cree une personne en normalisant le nom", async () => {
    const db = createFakeStockDb();

    const holder = await createHolder(db as never, {
      type: "PERSON",
      fullName: "  Jean   MUKENDI ",
      process: "INBOUND",
      matricule: " M-0042 ",
    });

    expect(holder).toMatchObject({
      type: "PERSON",
      fullName: "Jean MUKENDI",
      process: "INBOUND",
      matricule: "M-0042",
      active: true,
    });
  });

  it("cree un detenteur collectif (poste partage)", async () => {
    const db = createFakeStockDb();

    expect(await createHolder(db as never, { type: "COLLECTIVE", fullName: "AGENTS" })).toMatchObject({
      type: "COLLECTIVE",
      fullName: "AGENTS",
    });
  });

  it("refuse un nom vide et un type inconnu", async () => {
    const db = createFakeStockDb();

    expect(await rule(createHolder(db as never, { type: "PERSON", fullName: "   " }))).toMatch(/nom/i);
    expect(await rule(createHolder(db as never, { type: "ROBOT" as never, fullName: "R2D2" }))).toMatch(/type/i);
  });

  it("un matricule vide devient absent, un matricule existant est refuse", async () => {
    const db = createFakeStockDb({ holder: [person({ matricule: "M-0042" })] });

    expect(await createHolder(db as never, { type: "PERSON", fullName: "A", matricule: "  " })).toMatchObject({
      matricule: null,
    });
    expect(await rule(createHolder(db as never, { type: "PERSON", fullName: "B", matricule: "M-0042" }))).toMatch(
      /matricule/i,
    );
  });

  it("modifier garde son propre matricule sans conflit", async () => {
    const db = createFakeStockDb({ holder: [person({ matricule: "M-0042" })] });

    await expect(
      updateHolder(db as never, "holder-papy", { type: "PERSON", fullName: "Papy ADIKAKA", matricule: "M-0042" }),
    ).resolves.toMatchObject({ fullName: "Papy ADIKAKA" });
  });
});

describe("S2 — desactiver et supprimer", () => {
  it("desactive puis reactive un detenteur", async () => {
    const db = createFakeStockDb({ holder: [person()] });

    expect(await setHolderActive(db as never, "holder-papy", false)).toMatchObject({ active: false });
    expect(await setHolderActive(db as never, "holder-papy", true)).toMatchObject({ active: true });
  });

  it("refuse (409) de supprimer un detenteur qui a un historique d'affectation ou de sortie", async () => {
    for (const seed of [
      { assetAssignment: [{ id: "a", holderId: "holder-papy", status: "RETURNED" }] },
      { stockMovement: [{ id: "m", holderId: "holder-papy", type: "OUT" }] },
    ]) {
      const db = createFakeStockDb({ holder: [person()], ...seed });
      const error = await deleteHolder(db as never, "holder-papy").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HolderHasHistoryError);
      expect((error as HolderHasHistoryError).status).toBe(409);
      expect(db.tables.holder).toHaveLength(1);
    }
  });

  it("supprime un detenteur sans historique", async () => {
    const db = createFakeStockDb({ holder: [person()] });

    await deleteHolder(db as never, "holder-papy");

    expect(db.tables.holder).toHaveLength(0);
  });
});

describe("S2 — materiel a recuperer", () => {
  it("signale un detenteur inactif qui detient encore du materiel", () => {
    expect(holderFlags({ active: false }, 2)).toEqual({ toRecover: true });
    expect(holderFlags({ active: false }, 0)).toEqual({ toRecover: false });
    expect(holderFlags({ active: true }, 3)).toEqual({ toRecover: false });
  });
});
