// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AssignmentNotFoundError, AssignmentRuleError } from "@/lib/assignments/errors";
import { assignAsset, reassignAsset, returnAsset } from "@/lib/assignments/assignment-service";

import { createFakeStockDb, laptop, mice, person } from "../helpers/fake-stock-db";

const ACTOR = "user-tech-a";
const NEXT_WEEK = new Date(Date.now() + 7 * 86_400_000);

const activeDotation = (overrides = {}) => ({
  id: "asg-1",
  assetId: "laptop-1",
  holderId: "holder-papy",
  kind: "DOTATION",
  status: "ACTIVE",
  assignedAt: new Date("2026-06-12"),
  expectedReturnAt: null,
  returnedAt: null,
  ...overrides,
});

async function rule(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AssignmentRuleError);
  return (error as AssignmentRuleError).message;
}

describe("S3 — affecter un materiel unitaire", () => {
  it("REGRESSION : une dotation passe le laptop en Affecte, quantite 1, sans mouvement de stock", async () => {
    const db = createFakeStockDb({ asset: [laptop()], holder: [person()] });

    const assignment = await assignAsset(db as never, {
      assetId: "laptop-1",
      holderId: "holder-papy",
      kind: "DOTATION",
      actorId: ACTOR,
    });

    expect(db.row("asset", "laptop-1")).toMatchObject({ status: "ASSIGNED", quantityOnHand: 1 });
    expect(db.tables.stockMovement).toHaveLength(0);
    expect(assignment).toMatchObject({
      assetId: "laptop-1",
      holderId: "holder-papy",
      kind: "DOTATION",
      status: "ACTIVE",
      expectedReturnAt: null,
      issuedById: ACTOR,
    });
    expect(db.tables.auditLog[0]).toMatchObject({ action: "ASSIGN", actorId: ACTOR, assetId: "laptop-1" });
  });

  it("un pret exige une date de retour, pas une dotation", async () => {
    const db = createFakeStockDb({ asset: [laptop()], holder: [person()] });

    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "holder-papy", kind: "LOAN", actorId: ACTOR })),
    ).toMatch(/date de retour/i);

    const loan = await assignAsset(db as never, {
      assetId: "laptop-1",
      holderId: "holder-papy",
      kind: "LOAN",
      expectedReturnAt: NEXT_WEEK,
      actorId: ACTOR,
    });
    expect(loan).toMatchObject({ kind: "LOAN", expectedReturnAt: NEXT_WEEK });
  });

  it("refuse une date de retour dans le passe pour un pret", async () => {
    const db = createFakeStockDb({ asset: [laptop()], holder: [person()] });

    expect(
      await rule(
        assignAsset(db as never, {
          assetId: "laptop-1",
          holderId: "holder-papy",
          kind: "LOAN",
          expectedReturnAt: new Date("2020-01-01"),
          actorId: ACTOR,
        }),
      ),
    ).toMatch(/date de retour/i);
  });

  it("refuse un materiel deja affecte", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person(), person({ id: "holder-2", fullName: "ALAIN AMISI" })],
      assetAssignment: [activeDotation()],
    });

    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "holder-2", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/deja affecte/i);
  });

  it("refuse un article en vrac et oriente vers une sortie de stock", async () => {
    const db = createFakeStockDb({ asset: [mice()], holder: [person()] });

    expect(
      await rule(assignAsset(db as never, { assetId: "mice-1", holderId: "holder-papy", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/sortie/i);
  });

  it.each(["MAINTENANCE", "BROKEN", "RETIRED", "LOST"])("refuse un materiel au statut %s", async (status) => {
    const db = createFakeStockDb({ asset: [laptop({ status })], holder: [person()] });

    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "holder-papy", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/disponible/i);
  });

  it("refuse un detenteur inactif ou inconnu", async () => {
    const db = createFakeStockDb({ asset: [laptop()], holder: [person({ active: false })] });

    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "holder-papy", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/inactif/i);
    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "nobody", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/detenteur/i);
    expect(db.row("asset", "laptop-1")?.status).toBe("AVAILABLE");
  });

  it("refuse un type d'affectation inconnu", async () => {
    const db = createFakeStockDb({ asset: [laptop()], holder: [person()] });

    expect(
      await rule(assignAsset(db as never, { assetId: "laptop-1", holderId: "holder-papy", kind: "GIFT" as never, actorId: ACTOR })),
    ).toMatch(/type/i);
  });
});

describe("S3 — retour d'un materiel", () => {
  it.each([
    ["GOOD", "AVAILABLE"],
    ["TO_REPAIR", "MAINTENANCE"],
    ["LOST", "LOST"],
  ])("retour %s -> statut %s", async (outcome, expectedStatus) => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeDotation()],
    });

    const assignment = await returnAsset(db as never, { assignmentId: "asg-1", outcome: outcome as never, actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.status).toBe(expectedStatus);
    expect(assignment).toMatchObject({ status: "RETURNED", returnedById: ACTOR, returnOutcome: outcome });
    expect(assignment.returnedAt).toBeInstanceOf(Date);
  });

  it("REGRESSION : rendre un poste importe (quantite 1) laisse la quantite a 1", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED", quantityOnHand: 1 })],
      holder: [person()],
      assetAssignment: [activeDotation()],
    });

    await returnAsset(db as never, { assignmentId: "asg-1", outcome: "GOOD", actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.quantityOnHand).toBe(1);
    expect(db.tables.stockMovement).toHaveLength(0);
  });

  it("met a jour la condition du materiel si elle est indiquee", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeDotation()],
    });

    await returnAsset(db as never, { assignmentId: "asg-1", outcome: "TO_REPAIR", condition: "DAMAGED", actorId: ACTOR });

    expect(db.row("asset", "laptop-1")?.condition).toBe("DAMAGED");
  });

  it("refuse de rendre deux fois, ou une affectation inconnue", async () => {
    const db = createFakeStockDb({
      asset: [laptop()],
      holder: [person()],
      assetAssignment: [activeDotation({ status: "RETURNED", returnedAt: new Date() })],
    });

    expect(await rule(returnAsset(db as never, { assignmentId: "asg-1", outcome: "GOOD", actorId: ACTOR }))).toMatch(
      /deja/i,
    );
    await expect(
      returnAsset(db as never, { assignmentId: "ghost", outcome: "GOOD", actorId: ACTOR }),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });

  it("refuse un etat de retour inconnu", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeDotation()],
    });

    expect(
      await rule(returnAsset(db as never, { assignmentId: "asg-1", outcome: "STOLEN?" as never, actorId: ACTOR })),
    ).toMatch(/etat/i);
    expect(db.row("assetAssignment", "asg-1")?.status).toBe("ACTIVE");
  });
});

describe("S3 — reaffectation", () => {
  it("cloture l'ancienne (Transfere) et ouvre la nouvelle, le materiel reste Affecte", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person(), person({ id: "holder-alain", fullName: "ALAIN AMISI" })],
      assetAssignment: [activeDotation()],
    });

    const next = await reassignAsset(db as never, {
      assignmentId: "asg-1",
      holderId: "holder-alain",
      kind: "DOTATION",
      actorId: ACTOR,
    });

    expect(db.row("assetAssignment", "asg-1")).toMatchObject({ status: "TRANSFERRED", returnedById: ACTOR });
    expect(next).toMatchObject({ holderId: "holder-alain", status: "ACTIVE", issuedById: ACTOR });
    expect(db.row("asset", "laptop-1")?.status).toBe("ASSIGNED");
    expect(db.tables.assetAssignment.filter((a) => a.status === "ACTIVE")).toHaveLength(1);
  });

  it("refuse vers un detenteur inactif sans toucher l'affectation en cours", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person(), person({ id: "holder-off", active: false })],
      assetAssignment: [activeDotation()],
    });

    expect(
      await rule(reassignAsset(db as never, { assignmentId: "asg-1", holderId: "holder-off", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/inactif/i);
    expect(db.row("assetAssignment", "asg-1")?.status).toBe("ACTIVE");
    expect(db.tables.assetAssignment).toHaveLength(1);
  });

  it("refuse de reaffecter au meme detenteur", async () => {
    const db = createFakeStockDb({
      asset: [laptop({ status: "ASSIGNED" })],
      holder: [person()],
      assetAssignment: [activeDotation()],
    });

    expect(
      await rule(reassignAsset(db as never, { assignmentId: "asg-1", holderId: "holder-papy", kind: "DOTATION", actorId: ACTOR })),
    ).toMatch(/meme detenteur/i);
  });
});
