// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hasKycWorkbook, loadKycInventoryFromExcel } from "@/lib/import-kyc-inventory";
import {
  type MigrationSnapshot,
  normalizeHolderName,
  planTrackingAndHoldersMigration,
  UNKNOWN_HOLDER_NAME,
} from "@/lib/migrations/tracking-and-holders";

const asset = (id: string, overrides: Partial<MigrationSnapshot["assets"][number]> = {}) => ({
  id,
  assetGroup: "IT EQUIPMENT",
  custodianName: null,
  processLabel: null,
  status: "AVAILABLE",
  trackingMode: "SERIALIZED",
  ...overrides,
});

const assignment = (id: string, assetId: string, overrides = {}) => ({
  id,
  assetId,
  status: "ACTIVE",
  holderId: null,
  kind: null,
  ...overrides,
});

function snapshot(partial: Partial<MigrationSnapshot>): MigrationSnapshot {
  return { assets: [], assignments: [], holders: [], ...partial };
}

describe("Migration — normalisation des noms", () => {
  it("supprime les espaces superflus et compare sans tenir compte de la casse", () => {
    expect(normalizeHolderName("  PAPY   ADIKAKA ")).toEqual({ display: "PAPY ADIKAKA", key: "PAPY ADIKAKA" });
    expect(normalizeHolderName("Papy Adikaka").key).toBe("PAPY ADIKAKA");
  });
});

describe("Migration — mode de suivi", () => {
  it("IN STORE et OTHER ASSETS passent en vrac, le reste en unitaire", () => {
    const plan = planTrackingAndHoldersMigration(
      snapshot({
        assets: [
          asset("a1", { assetGroup: "IN STORE" }),
          asset("a2", { assetGroup: "OTHER ASSETS" }),
          asset("a3", { assetGroup: "CALL CENTER" }),
          asset("a4", { assetGroup: "WORKSTATIONS KYC", trackingMode: null }),
        ],
      }),
    );

    expect(plan.assetModes).toEqual([
      { assetId: "a1", trackingMode: "BULK" },
      { assetId: "a2", trackingMode: "BULK" },
      { assetId: "a4", trackingMode: "SERIALIZED" },
    ]);
    expect(plan.summary).toMatchObject({ serialized: 2, bulk: 2 });
  });
});

describe("Migration — detenteurs et dotations", () => {
  const base = snapshot({
    assets: [
      asset("p1", { custodianName: "PAPY ADIKAKA", processLabel: "INBOUND" }),
      asset("p2", { custodianName: " papy  adikaka", processLabel: "INBOUND" }),
      asset("p3", { custodianName: "ALAIN AMISI", processLabel: "INBOUND" }),
      asset("p4", { custodianName: "ALAIN AMISI", processLabel: "VALIDATION" }),
      asset("g1", { custodianName: "AGENTS", assetGroup: "CALL CENTER" }),
      asset("g2", { custodianName: "Agents Backoffice" }),
      asset("u1", { custodianName: "-", status: "MAINTENANCE" }),
      asset("x1", { custodianName: "TAVARES J", status: "LOST" }),
      asset("m1", { custodianName: "HUGUETTE LEPELE", status: "MAINTENANCE" }),
    ],
    assignments: ["p1", "p2", "p3", "p4", "g1", "g2", "u1", "x1", "m1"].map((id) => assignment(`asg-${id}`, id)),
  });
  const plan = planTrackingAndHoldersMigration(base);
  const byName = (name: string) => plan.holdersToCreate.find((h) => h.fullName === name);

  it("cree un detenteur par nom distinct (sans doublon de casse ou d'espaces)", () => {
    expect(plan.holdersToCreate.map((h) => h.fullName).sort()).toEqual(
      ["AGENTS", "ALAIN AMISI", "Agents Backoffice", "HUGUETTE LEPELE", "PAPY ADIKAKA", "TAVARES J", UNKNOWN_HOLDER_NAME].sort(),
    );
  });

  it("AGENTS, Agents Backoffice et « A identifier » sont collectifs, les autres des personnes", () => {
    expect(byName("AGENTS")?.type).toBe("COLLECTIVE");
    expect(byName("Agents Backoffice")?.type).toBe("COLLECTIVE");
    expect(byName(UNKNOWN_HOLDER_NAME)?.type).toBe("COLLECTIVE");
    expect(byName("PAPY ADIKAKA")?.type).toBe("PERSON");
  });

  it("reprend le process quand il est unique pour ce detenteur", () => {
    expect(byName("PAPY ADIKAKA")?.process).toBe("INBOUND");
    expect(byName("ALAIN AMISI")?.process).toBeNull();
  });

  it("relie chaque affectation a son detenteur en dotation", () => {
    expect(plan.assignmentLinks).toHaveLength(9);
    expect(plan.assignmentLinks.every((link) => link.kind === "DOTATION")).toBe(true);
    const papy = plan.assignmentLinks.filter((link) => link.holderKey === "PAPY ADIKAKA");
    expect(papy.map((link) => link.assignmentId).sort()).toEqual(["asg-p1", "asg-p2"]);
    expect(plan.assignmentLinks.find((link) => link.assignmentId === "asg-u1")?.holderKey).toBe(
      normalizeHolderName(UNKNOWN_HOLDER_NAME).key,
    );
  });

  it("rapporte les anomalies : detenteur inconnu et perdu encore affecte (pas la maintenance)", () => {
    expect(plan.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "HOLDER_UNKNOWN", assignmentId: "asg-u1" }),
        expect.objectContaining({ type: "LOST_WITH_ACTIVE_ASSIGNMENT", assignmentId: "asg-x1" }),
      ]),
    );
    expect(plan.anomalies).toHaveLength(2);
    expect(plan.anomalies.some((a) => a.assignmentId === "asg-m1")).toBe(false);
  });

  it("rapporte une affectation dont l'actif n'a aucun nom de detenteur", () => {
    const orphan = planTrackingAndHoldersMigration(
      snapshot({ assets: [asset("n1")], assignments: [assignment("asg-n1", "n1")] }),
    );

    expect(orphan.assignmentLinks).toHaveLength(0);
    expect(orphan.anomalies).toEqual([expect.objectContaining({ type: "NO_CUSTODIAN", assignmentId: "asg-n1" })]);
  });

  it("IDEMPOTENT : rejouee sur une base deja migree, elle ne change rien", () => {
    const migrated = snapshot({
      assets: base.assets,
      holders: plan.holdersToCreate.map((h, index) => ({ id: `h-${index}`, fullName: h.fullName, type: h.type })),
      assignments: base.assignments.map((a) => ({ ...a, holderId: "h-x", kind: "DOTATION" })),
    });

    const replay = planTrackingAndHoldersMigration(migrated);

    expect(replay.assetModes).toEqual([]);
    expect(replay.holdersToCreate).toEqual([]);
    expect(replay.assignmentLinks).toEqual([]);
    expect(replay.summary.changes).toBe(0);
  });
});

// Donnees reelles : tourne en local quand le classeur est present, ignore en CI.
describe.skipIf(!hasKycWorkbook())("Migration — sur le classeur KYC reel", () => {
  it("donne 389 unitaires, 33 vrac, 104 detenteurs, 303 dotations et 6 anomalies", () => {
    const items = loadKycInventoryFromExcel();
    const assets = items.map((item, index) => ({
      id: `a-${index}`,
      assetGroup: item.assetGroup,
      custodianName: item.custodianName,
      processLabel: item.processLabel,
      status: item.status,
      trackingMode: "SERIALIZED",
    }));
    const assignments = assets
      .filter((a) => a.custodianName)
      .map((a) => assignment(`asg-${a.id}`, a.id));

    const plan = planTrackingAndHoldersMigration(snapshot({ assets, assignments }));

    expect(plan.summary).toMatchObject({ serialized: 389, bulk: 33, dotations: 303, anomalies: 6 });
    expect(plan.holdersToCreate).toHaveLength(104);
    expect(plan.holdersToCreate.filter((h) => h.type === "PERSON")).toHaveLength(101);
    expect(plan.holdersToCreate.filter((h) => h.type === "COLLECTIVE")).toHaveLength(3);
  });
});
